// =============================================================
//  しあい画面のびょうが（ドリブル → ディフェンスをぬく → シュート）
// =============================================================
const PLAYER_COLORS = ['#1e7bff', '#ff7a00', '#b14dff', '#ffcf1a'];
const PLAYER_COLOR_NAMES = ['あお', 'オレンジ', 'むらさき', 'きいろ'];

// ばしょ（コートのよこはば に たいする わりあい）
const X_START = 0.07;
const X_SHOOT = 0.78;
const X_GOAL  = 0.955;

class Match {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{lanes:Array, defenders:number, words:Array}} opt
   *   lanes: [{id,name,color,isMe,cpuRate?}]
   */
  constructor(canvas, opt) {
    this.cv = canvas;
    this.cx = canvas.getContext('2d');
    this.D = opt.defenders;
    this.words = opt.words;
    this.total = this.D * 2 + 1;          // さいごの1語がシュート
    this.onEvent = opt.onEvent || (() => {});
    this.lanes = opt.lanes.map((l, idx) => ({
      ...l,
      idx,
      done: 0, frac: 0,
      finished: false, time: null, rank: null,
      vx: X_START,             // ひょうじ上の x（なめらかに動かす）
      passT: new Array(this.D).fill(null),
      shotT: null,
      stumbleT: -9,
      boost: false,
      dust: [],
      trail: [],
      keeperY: 0, keeperDir: Math.random() < 0.5 ? -1 : 1,
      shotDir: Math.random() < 0.5 ? -1 : 1,
      cpuPlan: l.cpuRate ? this.makeCpuPlan(l.cpuRate, l.seed || 1) : null,
    }));
    this.started = false;
    this.t0 = 0;
    this.particles = [];
    this.popups = [];
    this.running = true;
    this.finishCount = 0;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------- CPU（ひとりプレイのライバル） ----------
  makeCpuPlan(rate, seed) {
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const plan = [];
    let t = 0;
    for (const w of this.words) {
      const react = 0.45 + rnd() * 0.35;
      const type = (w.len / rate) * (0.85 + rnd() * 0.3);
      plan.push({ start: t + react, end: t + react + type });
      t += react + type;
    }
    return plan;
  }
  cpuProgress(lane, sec) {
    const p = lane.cpuPlan;
    for (let i = 0; i < p.length; i++) {
      if (sec < p[i].end) {
        const f = sec < p[i].start ? 0 : (sec - p[i].start) / (p[i].end - p[i].start);
        return { done: i, frac: Math.max(0, Math.min(0.99, f)) };
      }
    }
    return { done: p.length, frac: 0, end: p[p.length - 1].end };
  }

  start() { this.started = true; this.t0 = performance.now(); }
  elapsed() { return this.started ? (performance.now() - this.t0) / 1000 : 0; }
  lane(id) { return this.lanes.find(l => l.id === id); }

  setProgress(id, done, frac) {
    const l = this.lane(id); if (!l || l.finished) return;
    l.done = Math.min(done, this.total);
    l.frac = frac;
    for (let j = 0; j < this.D; j++) {
      if (l.passT[j] === null && l.done >= 2 * j + 2) {
        l.passT[j] = performance.now();
        this.popup(l, this.defX(j), 'ぬいた！', '#fff');
        if (l.isMe) this.onEvent('pass', l);
      }
    }
  }
  setBoost(id, on) { const l = this.lane(id); if (l) l.boost = on; }
  stumble(id) { const l = this.lane(id); if (l) l.stumbleT = performance.now(); }

  finishLane(id, time) {
    const l = this.lane(id); if (!l || l.finished) return;
    this.setProgress(id, this.total, 0);
    l.finished = true;
    l.time = time;
    l.rank = ++this.finishCount;
    l.shotT = performance.now();
    this.onEvent('shot', l);
    setTimeout(() => {
      this.onEvent('goal', l);
      this.burst(l);
    }, 520);
  }

  stop() { this.running = false; window.removeEventListener('resize', this.resize); }

  // ---------- けいさん ----------
  defX(j) { return X_START + (X_SHOOT - X_START) * (2 * j + 1.75) / (2 * this.D); }
  targetX(l) {
    const P = Math.min(l.done + l.frac, 2 * this.D);
    let x = X_START + (X_SHOOT - X_START) * P / (2 * this.D);
    for (let j = 0; j < this.D; j++) {
      if (l.passT[j] === null) { x = Math.min(x, this.defX(j) - 0.04); break; }
    }
    return x;
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(300, r.width);
    this.H = Math.max(200, r.height);
    this.cv.width = this.W * dpr;
    this.cv.height = this.H * dpr;
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  popup(l, x, text, color) { this.popups.push({ lane: l.idx, x, text, color, t: performance.now() }); }
  burst(l) {
    const h = this.H / this.lanes.length;
    const cy = h * l.idx + h / 2;
    const cols = [l.color, '#fff', '#ffe14d', '#ff4d6d', '#4dd2ff'];
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        x: this.W * X_GOAL - 20, y: cy,
        vx: -Math.random() * 6 - 1, vy: (Math.random() - 0.5) * 8,
        c: cols[i % cols.length], life: 1,
      });
    }
  }

  // ---------- びょうが ----------
  loop(now) {
    if (!this.running) return;
    if (this.started) {
      const sec = this.elapsed();
      for (const l of this.lanes) {
        if (!l.cpuPlan || l.finished) continue;
        const p = this.cpuProgress(l, sec);
        if (p.done >= this.total) this.finishLane(l.id, p.end);
        else this.setProgress(l.id, p.done, p.frac);
      }
    }
    this.draw(now);
    requestAnimationFrame(this.loop);
  }

  draw(now) {
    const c = this.cx, W = this.W, H = this.H, n = this.lanes.length;
    const h = H / n;
    c.clearRect(0, 0, W, H);
    this.lanes.forEach((l, i) => {
      c.save();
      c.translate(0, i * h);
      this.drawPitch(c, W, h, l);
      this.drawLane(c, W, h, l, now);
      c.restore();
    });
    // ぬいた！ などの文字
    this.popups = this.popups.filter(p => now - p.t < 900);
    for (const p of this.popups) {
      const k = (now - p.t) / 900;
      c.globalAlpha = 1 - k;
      c.fillStyle = p.color;
      c.font = `900 ${Math.max(13, Math.min(h * 0.17, W * 0.035))}px "M PLUS Rounded 1c", sans-serif`;
      c.textAlign = 'center';
      c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 4;
      const y = p.lane * h + Math.max(h * 0.22, 18) - k * h * 0.12;
      c.strokeText(p.text, p.x * W, y);
      c.fillText(p.text, p.x * W, y);
      c.globalAlpha = 1;
    }
    // かみふぶき
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.012;
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.c;
      c.fillRect(p.x, p.y, 6, 4);
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);
  }

  drawPitch(c, W, h, l) {
    // しばふのしま
    const stripes = 12;
    for (let s = 0; s < stripes; s++) {
      c.fillStyle = s % 2 ? '#3fa34d' : '#4cb85a';
      c.fillRect((W / stripes) * s, 0, W / stripes + 1, h);
    }
    c.strokeStyle = 'rgba(255,255,255,.85)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, W - 2, h - 2);
    // ハーフウェーライン と センターサークル
    c.beginPath(); c.moveTo(W * 0.03, 0); c.lineTo(W * 0.03, h); c.stroke();
    c.beginPath(); c.arc(W * 0.03, h / 2, h * 0.28, -Math.PI / 2, Math.PI / 2); c.stroke();
    // ペナルティエリア
    const gx = W * X_GOAL;
    c.strokeRect(W * 0.83, h * 0.12, gx - W * 0.83, h * 0.76);
    c.strokeRect(W * 0.91, h * 0.3, gx - W * 0.91, h * 0.4);
    c.beginPath(); c.arc(W * 0.83, h / 2, h * 0.17, Math.PI / 2, -Math.PI / 2); c.stroke();
    // ゴール
    const gy1 = h * 0.3, gy2 = h * 0.7, depth = W * 0.035;
    const shake = l.shotT && performance.now() - l.shotT > 500 && performance.now() - l.shotT < 1100
      ? Math.sin(performance.now() / 30) * 3 : 0;
    c.fillStyle = 'rgba(255,255,255,.15)';
    c.fillRect(gx, gy1, depth + shake, gy2 - gy1);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
    for (let y = gy1; y <= gy2; y += 6) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx + depth + shake, y); c.stroke(); }
    for (let x = gx; x <= gx + depth; x += 6) { c.beginPath(); c.moveTo(x + shake * (x - gx) / depth, gy1); c.lineTo(x + shake * (x - gx) / depth, gy2); c.stroke(); }
    c.strokeStyle = '#fff'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(gx + depth, gy1); c.lineTo(gx, gy1); c.lineTo(gx, gy2); c.lineTo(gx + depth, gy2); c.stroke();
    // ひかりと かげ
    const vg = c.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, 'rgba(255,255,255,.10)'); vg.addColorStop(.5, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(0,0,0,.14)');
    c.fillStyle = vg; c.fillRect(0, 0, W, h);
    // レーンのいろ
    c.fillStyle = l.color;
    c.fillRect(0, 0, 8, h);
    c.fillStyle = 'rgba(14,28,58,.9)';
    c.fillRect(0, h - 2, W, 2);
  }

  drawPerson(c, x, y, s, color, o = {}) {
    const run = o.run || 0;
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    // かげ
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.beginPath(); c.ellipse(0, s * 0.95, s * 0.45, s * 0.12, 0, 0, Math.PI * 2); c.fill();
    // あし
    c.strokeStyle = o.sock || '#fff'; c.lineWidth = s * 0.16; c.lineCap = 'round';
    const sw = Math.sin(run) * s * 0.35;
    c.beginPath(); c.moveTo(-s * 0.1, s * 0.35); c.lineTo(-s * 0.1 + sw, s * 0.9); c.stroke();
    c.beginPath(); c.moveTo(s * 0.1, s * 0.35); c.lineTo(s * 0.1 - sw, s * 0.9); c.stroke();
    // からだ
    c.fillStyle = color;
    c.beginPath(); c.roundRect(-s * 0.3, -s * 0.25, s * 0.6, s * 0.65, s * 0.15); c.fill();
    if (o.num !== undefined && s > 14) {
      c.fillStyle = o.numColor || '#fff';
      c.font = `900 ${Math.round(s * 0.32)}px sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(o.num), 0, s * 0.08);
      c.textBaseline = 'alphabetic';
    }
    // うで
    c.strokeStyle = color; c.lineWidth = s * 0.14;
    c.beginPath(); c.moveTo(-s * 0.28, -s * 0.1); c.lineTo(-s * 0.45 - sw * 0.4, s * 0.25); c.stroke();
    c.beginPath(); c.moveTo(s * 0.28, -s * 0.1); c.lineTo(s * 0.45 + sw * 0.4, s * 0.25); c.stroke();
    // あたま
    c.fillStyle = '#ffd7b0';
    c.beginPath(); c.arc(0, -s * 0.48, s * 0.25, 0, Math.PI * 2); c.fill();
    c.fillStyle = o.hair || '#2b1d14';
    c.beginPath(); c.arc(0, -s * 0.55, s * 0.25, Math.PI, Math.PI * 2); c.fill();
    // め
    c.fillStyle = '#222';
    const f = o.face || 1;
    c.beginPath(); c.arc(s * 0.1 * f, -s * 0.46, s * 0.04, 0, Math.PI * 2); c.fill();
    if (o.gloves) {
      c.fillStyle = '#7df9a0';
      c.beginPath(); c.arc(-s * 0.48, s * 0.28, s * 0.1, 0, Math.PI * 2); c.arc(s * 0.48, s * 0.28, s * 0.1, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  drawBall(c, x, y, r, spin) {
    c.save();
    c.translate(x, y);
    c.rotate(spin);
    c.fillStyle = '#fff';
    c.strokeStyle = '#222'; c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#222';
    c.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      c.lineTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
    }
    c.fill();
    c.restore();
  }

  // ラベルを はばに おさめる（ながい なまえは …）
  fitLabel(c, text, maxW) {
    if (c.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  drawLane(c, W, h, l, now) {
    const s = Math.min(h * 0.3, W * 0.045);
    const cy = h * 0.52;
    const t = now / 1000;

    // ゴールキーパー
    const gkx = W * (X_GOAL - 0.02);
    let gky = cy + Math.sin(t * 1.5 + l.idx) * h * 0.08;
    let gkRot = 0;
    if (l.shotT) {
      const k = Math.min(1, (now - l.shotT) / 450);
      gky = cy + l.keeperDir * k * h * 0.2;
      gkRot = l.keeperDir * k * 1.2;
    }
    this.drawPerson(c, gkx, gky - s * 0.2, s * 0.95, '#21262e', { gloves: true, face: -1, rot: gkRot, sock: '#21262e', num: 1, numColor: '#7df9a0' });

    // ディフェンダー
    for (let j = 0; j < this.D; j++) {
      const dx = this.defX(j) * W;
      const pt = l.passT[j];
      if (pt === null) {
        const wob = Math.sin(t * 3 + j) * 3;
        this.drawPerson(c, dx + wob, cy - s * 0.2, s, '#d8232f', { face: -1, run: Math.sin(t * 6 + j) * 0.3, hair: '#111', num: j + 2 });
      } else {
        const k = Math.min(1, (now - pt) / 500);
        this.drawPerson(c, dx - k * 6, cy - s * 0.2 + k * s * 0.3, s, '#d8232f',
          { face: -1, rot: -k * 1.3, alpha: 1 - k * 0.55, hair: '#111' });
      }
    }

    // じぶん（ドリブル）
    let tx = this.targetX(l);
    if (l.shotT) tx = X_SHOOT;
    l.vx += (tx - l.vx) * 0.14;
    let px = l.vx * W;
    let py = cy - s * 0.2;
    for (let j = 0; j < this.D; j++) {
      const pt = l.passT[j];
      if (pt !== null && now - pt < 450) {
        py += (j % 2 ? -1 : 1) * Math.sin(((now - pt) / 450) * Math.PI) * h * 0.16;
      }
    }
    const moving = Math.abs(tx - l.vx) > 0.0015;
    // つちけむり
    if (moving && Math.random() < 0.5) l.dust.push({ x: px - s * 0.2, y: py + s * 0.9, life: 1, r: s * 0.08 });
    l.dust = l.dust.filter(d => (d.life -= 0.05) > 0);
    for (const d of l.dust) {
      c.fillStyle = `rgba(235,245,220,${d.life * 0.5})`;
      c.beginPath(); c.arc(d.x - (1 - d.life) * 10, d.y - (1 - d.life) * 4, d.r * (2 - d.life), 0, Math.PI * 2); c.fill();
    }
    // コンボ中の スピードせん
    if (l.boost && moving) {
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const yy = py - s * 0.6 + k * s * 0.45 + Math.sin(t * 20 + k) * 2;
        const len = s * (0.8 + ((t * 7 + k * 0.3) % 1) * 0.8);
        c.beginPath(); c.moveTo(px - s * 0.5, yy); c.lineTo(px - s * 0.5 - len, yy); c.stroke();
      }
    }
    const st = now - l.stumbleT;
    let rot = 0;
    if (st < 250) { px -= Math.sin(st / 250 * Math.PI) * 6; rot = -0.15; }
    const runPhase = moving ? t * (l.boost ? 22 : 16) : Math.sin(t * 4) * 0.2;
    this.drawPerson(c, px, py, s, l.color, { run: runPhase, rot, num: 10 });

    // ボール
    let bx = px + s * 0.55 + (moving ? Math.abs(Math.sin(t * 8)) * s * 0.25 : 0);
    let by = py + s * 0.82;
    const groundY = by + s * 0.18;
    let spin = l.vx * 60;
    const br = s * 0.2;
    if (l.shotT) {
      const k = Math.min(1, (now - l.shotT) / 520);
      const ex = W * (X_GOAL + 0.02), ey = cy + (l.shotDir * -1) * h * 0.12;
      bx = bx + (ex - bx) * k;
      const base = by + (ey - by) * k;
      by = base - Math.sin(k * Math.PI) * h * 0.25;
      spin = k * 20;
      if (k < 1) l.trail.push({ x: bx, y: by, life: 1 });
      c.fillStyle = 'rgba(0,0,0,.22)';
      c.beginPath(); c.ellipse(bx, base + br, br * 0.9, br * 0.3, 0, 0, Math.PI * 2); c.fill();
    } else {
      c.fillStyle = 'rgba(0,0,0,.22)';
      c.beginPath(); c.ellipse(bx, groundY, br * 0.9, br * 0.3, 0, 0, Math.PI * 2); c.fill();
    }
    l.trail = l.trail.filter(p => (p.life -= 0.06) > 0);
    for (const p of l.trail) {
      c.fillStyle = `rgba(255,240,150,${p.life * 0.6})`;
      c.beginPath(); c.arc(p.x, p.y, br * p.life, 0, Math.PI * 2); c.fill();
    }
    this.drawBall(c, bx, by, br, spin);

    // なまえ（レーンの なかに おさめる）
    const fs = Math.max(11, Math.min(h * 0.11, 16));
    c.font = `800 ${fs}px "M PLUS Rounded 1c", sans-serif`;
    c.textAlign = 'center';
    const raw = l.name + (l.isMe && l.name !== 'きみ' ? '（きみ）' : '');
    const label = this.fitLabel(c, raw, Math.max(60, W * 0.2));
    const tw = c.measureText(label).width + 16;
    const lx = Math.max(tw / 2 + 12, Math.min(W - tw / 2 - 4, px));
    const top = Math.max(3, py - s * 1.25 - fs - 2);
    c.fillStyle = l.isMe ? l.color : 'rgba(0,0,0,.55)';
    c.beginPath(); c.roundRect(lx - tw / 2, top, tw, fs + 8, 8); c.fill();
    if (l.isMe) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
    c.fillStyle = '#fff';
    c.fillText(label, lx, top + fs + 1);

    // ゴール！ と じゅんい
    if (l.shotT && now - l.shotT > 520) {
      const k = Math.min(1, (now - l.shotT - 520) / 300);
      const gsize = Math.min(h * 0.36, W * 0.085);
      c.save();
      c.translate(W * 0.6, h * 0.5);
      c.scale(0.6 + k * 0.4, 0.6 + k * 0.4);
      c.font = `900 ${gsize}px "M PLUS Rounded 1c", sans-serif`;
      c.lineWidth = Math.max(4, gsize * 0.12); c.strokeStyle = '#111'; c.lineJoin = 'round';
      c.fillStyle = '#ffe14d';
      c.strokeText('GOAL!!', 0, gsize * 0.35);
      c.fillText('GOAL!!', 0, gsize * 0.35);
      c.restore();
      if (this.lanes.length > 1 && l.rank) {
        const rs = Math.min(h * 0.22, W * 0.05);
        c.font = `900 ${rs}px "M PLUS Rounded 1c", sans-serif`;
        c.fillStyle = l.rank === 1 ? '#ffd21a' : '#fff'; c.strokeStyle = '#111'; c.lineWidth = 5;
        c.textAlign = 'right';
        c.strokeText(`${l.rank}い`, W - 10, rs + 4);
        c.fillText(`${l.rank}い`, W - 10, rs + 4);
        c.textAlign = 'center';
      }
    }
  }
}
