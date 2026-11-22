// =============================================================
//  タイピングストライカー  サーバー（Cloudflare Workers）
//  - /api/room/1234  … WebSocket で へや(Durable Object)に つなぐ
//  - それ以外        … public/ の ファイルを かえす
// =============================================================
import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 4;
const AFTER_FIRST_GOAL_MS = 30000; // 1人目が ゴールしてから しめきりまで

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    const m = url.pathname.match(/^\/api\/room\/(\d{4})$/);
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('WebSocket only', { status: 426 });
      }
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  // ---------- べんり ----------
  sockets(exclude) {
    return this.ctx.getWebSockets().filter(ws => ws !== exclude && ws.readyState === 1);
  }
  info(ws) { try { return ws.deserializeAttachment() || null; } catch { return null; } }
  save(ws, data) { ws.serializeAttachment(data); }
  players(exclude) {
    return this.sockets(exclude)
      .map(ws => ({ ws, p: this.info(ws) }))
      .filter(x => x.p && x.p.joined)
      .sort((a, b) => a.p.joinedAt - b.p.joinedAt);
  }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* きれた */ } }
  broadcast(obj, exclude) {
    const s = JSON.stringify(obj);
    for (const { ws } of this.players(exclude)) { try { ws.send(s); } catch { /* きれた */ } }
  }
  async meta() {
    return (await this.ctx.storage.get('meta')) || { phase: 'lobby', cfg: { level: 0, def: 3 }, firstGoal: false };
  }
  async setMeta(m) { await this.ctx.storage.put('meta', m); }

  publicList(exclude) {
    return this.players(exclude).map(({ p }, i) => ({
      id: p.id, name: p.name, color: p.color, host: i === 0,
      done: p.done, frac: p.frac, finished: p.finished, time: p.time,
    }));
  }
  async broadcastRoom(exclude) {
    const meta = await this.meta();
    const list = this.publicList(exclude);
    for (const { ws, p } of this.players(exclude)) {
      this.send(ws, { t: 'room', you: p.id, phase: meta.phase, cfg: meta.cfg, players: list });
    }
  }

  // ---------- せつぞく ----------
  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.save(server, { joined: false });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const me = this.info(ws) || {};
    let meta = await this.meta();

    if (m.t === 'join') {
      const others = this.players(ws);
      if (others.length === 0 && meta.phase !== 'lobby') {
        meta = { ...meta, phase: 'lobby', firstGoal: false };
        await this.setMeta(meta);
      }
      if (others.length >= MAX_PLAYERS) {
        this.send(ws, { t: 'error', msg: 'このへやは いっぱい（4人）だよ' });
        ws.close(1000, 'full');
        return;
      }
      if (meta.phase !== 'lobby') {
        this.send(ws, { t: 'error', msg: 'いま しあいちゅう だよ。おわるまで まってね' });
        ws.close(1000, 'playing');
        return;
      }
      const used = others.map(o => o.p.color);
      const color = [0, 1, 2, 3].find(c => !used.includes(c));
      const name = String(m.name || 'プレイヤー').replace(/[\u0000-\u001f<>]/g, '').slice(0, 8) || 'プレイヤー';
      this.save(ws, {
        joined: true, id: crypto.randomUUID().slice(0, 8), name, color,
        joinedAt: Date.now(), done: 0, frac: 0, finished: false, time: null,
      });
      await this.broadcastRoom();
      return;
    }
    if (!me.joined) return;
    const isHost = this.players()[0]?.p.id === me.id;

    switch (m.t) {
      case 'cfg': {
        if (!isHost || meta.phase !== 'lobby') return;
        const level = Math.max(0, Math.min(4, m.level | 0));
        const def = Math.max(2, Math.min(5, m.def | 0));
        meta.cfg = { level, def };
        await this.setMeta(meta);
        await this.broadcastRoom();
        return;
      }
      case 'start': {
        if (!isHost || meta.phase !== 'lobby') return;
        const ps = this.players();
        if (ps.length < 2) return;
        for (const { ws: w, p } of ps) this.save(w, { ...p, done: 0, frac: 0, finished: false, time: null });
        meta.phase = 'playing';
        meta.firstGoal = false;
        await this.setMeta(meta);
        const seed = Math.floor(Math.random() * 2 ** 31);
        this.broadcast({ t: 'start', seed, cfg: meta.cfg, players: this.publicList() });
        return;
      }
      case 'p': {
        if (meta.phase !== 'playing' || me.finished) return;
        const done = Math.max(0, Math.min(99, m.done | 0));
        const frac = Math.max(0, Math.min(1, Number(m.frac) || 0));
        this.save(ws, { ...me, done, frac });
        this.broadcast({ t: 'p', id: me.id, done, frac }, ws);
        return;
      }
      case 'fin': {
        if (meta.phase !== 'playing' || me.finished) return;
        const time = Math.max(0, Number(m.time) || 0);
        this.save(ws, { ...me, finished: true, time, done: 99 });
        this.broadcast({ t: 'fin', id: me.id, time });
        if (!meta.firstGoal) {
          meta.firstGoal = true;
          await this.setMeta(meta);
          this.broadcast({ t: 'deadline', ms: AFTER_FIRST_GOAL_MS });
          await this.ctx.storage.setAlarm(Date.now() + AFTER_FIRST_GOAL_MS);
        }
        await this.checkAllFinished();
        return;
      }
      case 'lobby': {
        if (!isHost || meta.phase !== 'result') return;
        meta.phase = 'lobby';
        meta.firstGoal = false;
        await this.setMeta(meta);
        await this.broadcastRoom();
        return;
      }
    }
  }

  async checkAllFinished(exclude) {
    const ps = this.players(exclude);
    if (ps.length && ps.every(x => x.p.finished)) await this.endGame(exclude);
  }

  async endGame(exclude) {
    const meta = await this.meta();
    if (meta.phase !== 'playing') return;
    meta.phase = 'result';
    await this.setMeta(meta);
    await this.ctx.storage.deleteAlarm();
    const ranking = this.publicList(exclude).sort((a, b) => {
      if (a.finished && b.finished) return a.time - b.time;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return (b.done + b.frac) - (a.done + a.frac);
    });
    this.broadcast({ t: 'result', ranking }, exclude);
  }

  async alarm() { await this.endGame(); }

  async webSocketClose(ws) {
    try { ws.close(); } catch { /* すでに とじている */ }
    await this.onLeave(ws);
  }
  async webSocketError(ws) { await this.onLeave(ws); }

  async onLeave(ws) {
    const rest = this.players(ws);
    const meta = await this.meta();
    if (rest.length === 0) {
      await this.setMeta({ ...meta, phase: 'lobby', firstGoal: false });
      await this.ctx.storage.deleteAlarm();
      return;
    }
    if (meta.phase === 'playing') await this.checkAllFinished(ws);
    await this.broadcastRoom(ws);
  }
}
