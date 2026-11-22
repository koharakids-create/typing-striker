// =============================================================
//  タイピングストライカー  メイン
// =============================================================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem('ts_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ts_' + k, JSON.stringify(v)); } catch (e) { /* ほぞんできない環境 */ } },
};

// ---------- リーグせってい ----------
// cpu: あいての はやさ（かな文字/びょう）  def: ディフェンスの人数
const LEAGUES = [
  { name: '地域リーグ',       short: '地域', levels: [0],    def: 2, cpu: 0.8, rival: 'ひまわりキッズFC',    color: '#59b84f' },
  { name: '県リーグ',         short: '県',   levels: [0, 1], def: 2, cpu: 1.1, rival: 'あおぞらSC',          color: '#2fa6b8' },
  { name: '関東リーグ',       short: '関東', levels: [1],    def: 3, cpu: 1.4, rival: 'いなずまユナイテッド', color: '#3d78d8' },
  { name: 'JFL',              short: 'JFL',  levels: [1, 2], def: 3, cpu: 1.8, rival: 'みなとFC',            color: '#7a55d6' },
  { name: 'J3',               short: 'J3',   levels: [2],    def: 4, cpu: 2.2, rival: 'やまびこSC',          color: '#d0508a' },
  { name: 'J2',               short: 'J2',   levels: [2, 3], def: 4, cpu: 2.7, rival: 'はやぶさFC',          color: '#e0702a' },
  { name: 'J1',               short: 'J1',   levels: [3],    def: 5, cpu: 3.2, rival: 'スターライト東京',    color: '#d9a01e' },
  { name: 'ヨーロッパリーグ', short: 'EU',   levels: [3, 4], def: 5, cpu: 3.9, rival: 'ロイヤル・ユーロFC',  color: '#1d3ba8' },
];

const TITLES = [
  [0, 'たまごストライカー'], [60, 'ルーキー'], [100, 'レギュラー'],
  [150, 'エースストライカー'], [200, 'にほんだいひょう'], [260, 'ワールドクラス'], [330, 'レジェンド'],
];

// ---------- べんり ----------
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
  window.scrollTo(0, 0);
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickWords(levels, n, seed) {
  const rnd = mulberry32(seed);
  const pool = WORDS.filter(w => levels.includes(w.level));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = [];
  while (out.length < n) out.push(pool[out.length % pool.length]);
  return out;
}
const randSeed = () => Math.floor(Math.random() * 2 ** 31);

// 文字が はみださないように font-size を ちいさくする（それでも むりなら おりかえす）
function fit(el, max, min) {
  if (!el || !el.clientWidth) return;
  el.classList.remove('wrap');
  let s = Math.round(max);
  el.style.fontSize = s + 'px';
  while (s > min && el.scrollWidth > el.clientWidth + 1) {
    s -= 2;
    el.style.fontSize = s + 'px';
  }
  if (el.scrollWidth > el.clientWidth + 1) el.classList.add('wrap');
}

// ---------- かざり（SVG） ----------
function jerseySvg(color, num) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M22 6 L32 11 L42 6 L58 16 L52 28 L46 25 L46 58 L18 58 L18 25 L12 28 L6 16 Z" fill="${color}" stroke="#18223a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 6 L32 11 L42 6" fill="none" stroke="#fff" stroke-width="3"/>
    <text x="32" y="46" text-anchor="middle" font-size="20" font-weight="900" fill="#fff" stroke="#18223a" stroke-width="1" font-family="sans-serif">${num}</text>
  </svg>`;
}
function emblemSvg(L, i) {
  const star = i === 7 ? '<path d="M32 6 l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffd21a"/>' : '';
  const fs = L.short.length >= 3 ? 15 : 19;
  return `<svg class="emblem" viewBox="0 0 64 72" aria-hidden="true">
    <path d="M32 3 L59 12 V36 C59 54 46 64 32 69 C18 64 5 54 5 36 V12 Z" fill="${L.color}" stroke="#18223a" stroke-width="3"/>
    <path d="M32 9 L53 16 V36 C53 50 43 58 32 62 C21 58 11 50 11 36 V16 Z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/>
    ${star}
    <text x="32" y="${i === 7 ? 48 : 44}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="#fff" font-family="sans-serif">${esc(L.short)}</text>
  </svg>`;
}

// ---------- うしろの スタジアム ----------
function drawStadium() {
  const cv = $('#bg');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rnd = mulberry32(42);
  // そら
  let g = c.createLinearGradient(0, 0, 0, H * 0.4);
  g.addColorStop(0, '#2f86ff'); g.addColorStop(1, '#9fd6ff');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 5; i++) {
    const x = rnd() * W, y = H * (0.03 + rnd() * 0.1), r = 18 + rnd() * 26;
    c.beginPath(); c.ellipse(x, y, r * 2, r * 0.7, 0, 0, Math.PI * 2); c.ellipse(x + r, y - r * 0.4, r, r * 0.7, 0, 0, Math.PI * 2); c.fill();
  }
  // かんきゃくせき
  const y0 = H * 0.17, y1 = H * 0.5;
  c.fillStyle = '#16264b'; c.fillRect(0, y0 - 14, W, 14);
  g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#263d72'); g.addColorStop(1, '#3a568f');
  c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0);
  const shirt = ['#ff4d6d', '#ffd21a', '#1e7bff', '#ffffff', '#ff8a00', '#22c55e', '#e5323e', '#7b4dff'];
  const skin = ['#ffd7b0', '#f2c094', '#d9a06e', '#ffe2c6'];
  const rowH = Math.max(14, (y1 - y0) / 11);
  for (let y = y0 + rowH * 0.6; y < y1 - 4; y += rowH) {
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, y + rowH * 0.45, W, 2);
    const step = rowH * 0.9;
    for (let x = (rnd() * step); x < W; x += step * (0.85 + rnd() * 0.3)) {
      if (rnd() < 0.08) continue;
      c.fillStyle = shirt[(rnd() * shirt.length) | 0];
      c.fillRect(x - rowH * 0.28, y, rowH * 0.56, rowH * 0.45);
      c.fillStyle = skin[(rnd() * skin.length) | 0];
      c.beginPath(); c.arc(x, y - rowH * 0.08, rowH * 0.22, 0, Math.PI * 2); c.fill();
      if (rnd() < 0.12) { c.fillStyle = shirt[(rnd() * shirt.length) | 0]; c.fillRect(x + rowH * 0.2, y - rowH * 0.7, rowH * 0.5, rowH * 0.32); }
    }
  }
  // ライト
  for (const fx of [W * 0.06, W * 0.94]) {
    c.fillStyle = '#9aa7bf'; c.fillRect(fx - 3, H * 0.02, 6, y0);
    const lg = c.createRadialGradient(fx, H * 0.03, 4, fx, H * 0.03, 110);
    lg.addColorStop(0, 'rgba(255,255,230,.95)'); lg.addColorStop(1, 'rgba(255,255,230,0)');
    c.fillStyle = lg; c.fillRect(fx - 110, H * 0.03 - 110, 220, 220);
    c.fillStyle = '#e8eefc';
    for (let r = 0; r < 2; r++) for (let k = -2; k <= 2; k++) { c.beginPath(); c.arc(fx + k * 9, H * 0.02 + r * 9, 3.5, 0, Math.PI * 2); c.fill(); }
  }
  // かんばん
  const adH = Math.max(16, H * 0.035);
  const ads = ['#ff4d6d', '#ffd21a', '#1e7bff', '#22c55e', '#ff8a00'];
  for (let x = 0, i = 0; x < W; x += 150, i++) { c.fillStyle = ads[i % ads.length]; c.fillRect(x, y1, 150, adH); }
  c.fillStyle = 'rgba(255,255,255,.4)';
  for (let x = 40; x < W; x += 150) c.fillRect(x, y1 + adH * 0.35, 70, adH * 0.3);
  // ピッチ
  const py = y1 + adH;
  let bandY = py, bh = 14, k = 0;
  while (bandY < H) {
    c.fillStyle = k % 2 ? '#3a9e48' : '#45b153';
    c.fillRect(0, bandY, W, bh + 1);
    bandY += bh; bh *= 1.22; k++;
  }
  c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(0, py + 10, W, 3);
}
let bgTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(bgTimer);
  bgTimer = setTimeout(() => { drawStadium(); if (G && G.matcher) fitWord(); }, 120);
});
drawStadium();

// ---------- せってい ----------
const styleSel = $('#set-style');
styleSel.value = store.get('style', 'hepburn');
Romaji.setStyle(styleSel.value);
styleSel.onchange = () => { Romaji.setStyle(styleSel.value); store.set('style', styleSel.value); renderPractice(); };
const soundChk = $('#set-sound');
soundChk.checked = store.get('sound', true);
SFX.enabled = soundChk.checked;
soundChk.onchange = () => { SFX.enabled = soundChk.checked; store.set('sound', soundChk.checked); };
const kbChk = $('#set-kb');
kbChk.checked = store.get('kb', true);
kbChk.onchange = () => store.set('kb', kbChk.checked);

document.addEventListener('click', e => {
  SFX.unlock();
  const go = e.target.closest('[data-go]');
  if (go) {
    const to = go.dataset.go;
    if (to === 'league') renderLeagues();
    if (to === 'practice') renderPractice();
    if (to === 'online') openOnline();
    show(to);
  }
});

// ---------- リーグ画面 ----------
function renderLeagues() {
  const prog = store.get('progress', { cleared: 0, best: {} });
  $('#league-list').innerHTML = LEAGUES.map((L, i) => {
    const locked = i > prog.cleared;
    const best = prog.best[i];
    const lv = L.levels.map(x => LEVELS[x].label).join('・');
    const cls = [locked ? 'locked' : '', i === 7 ? 'euro' : '', i === prog.cleared ? 'next' : ''].join(' ');
    return `<button class="league-card ${cls}" data-league="${i}" ${locked ? 'disabled' : ''}>
      ${emblemSvg(L, i)}
      <div>
        <h3>${locked ? '🔒 ' : ''}${esc(L.name)}</h3>
        <div class="meta">${lv}<br>ディフェンス ${L.def}人<br>あいて：${esc(L.rival)}</div>
        ${best ? `<span class="pill">★ ベスト ${best.toFixed(1)}びょう</span>` : (locked ? '' : (i === prog.cleared ? '<span class="pill">チャレンジ！</span>' : ''))}
      </div>
    </button>`;
  }).join('');
  $$('#league-list [data-league]').forEach(b => b.onclick = () => startLeague(+b.dataset.league));
}

function startLeague(i) {
  const L = LEAGUES[i];
  const seed = randSeed();
  startGame({
    mode: 'league', league: i, seed, levels: L.levels, defenders: L.def,
    title: `${L.name}　vs ${L.rival}`,
    lanes: [
      { id: 'me', name: store.get('name', '') || 'きみ', color: PLAYER_COLORS[0], isMe: true },
      { id: 'cpu', name: L.rival, color: '#5b6577', cpuRate: L.cpu, seed: seed + 7 },
    ],
  });
}

// ---------- れんしゅう ----------
function renderPractice() {
  $('#practice-list').innerHTML = LEVELS.map(l => {
    const ex = WORDS.find(w => w.level === l.id);
    const dots = [0, 1, 2, 3, 4].map(d => `<i class="${d <= l.id ? 'on' : ''}"></i>`).join('');
    return `<button class="level-card" data-lv="${l.id}">
      <div class="lv-dots">${dots}</div>
      <h3>${l.label}</h3><p>${l.name}・${l.desc}</p>
      <div class="ex">${esc(ex.text)}<small>${Romaji.sample(ex.yomi)}</small></div>
    </button>`;
  }).join('');
  $$('#practice-list [data-lv]').forEach(b => b.onclick = () => {
    const lv = +b.dataset.lv;
    startGame({
      mode: 'practice', level: lv, seed: randSeed(), levels: [lv], defenders: 3,
      title: `れんしゅう：${LEVELS[lv].label}`,
      lanes: [{ id: 'me', name: store.get('name', '') || 'きみ', color: PLAYER_COLORS[0], isMe: true }],
    });
  });
}

// =============================================================
//  オンスクリーン キーボード
// =============================================================
const KB_ROWS = ['1234567890-', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const FINGER = {};
const FINGER_INFO = {
  lp: ['ひだり', 'こゆび', '#ff9aa8'], lr: ['ひだり', 'くすりゆび', '#ffc98a'], lm: ['ひだり', 'なかゆび', '#b6e58f'], li: ['ひだり', 'ひとさしゆび', '#8fd0ff'],
  ri: ['みぎ', 'ひとさしゆび', '#c3b1ff'], rm: ['みぎ', 'なかゆび', '#b6e58f'], rr: ['みぎ', 'くすりゆび', '#ffc98a'], rp: ['みぎ', 'こゆび', '#ff9aa8'],
};
[['lp', '1qaz'], ['lr', '2wsx'], ['lm', '3edc'], ['li', '45rtfgvb'], ['ri', '67yuhjnm'], ['rm', '8ik'], ['rr', '9ol'], ['rp', '0p-']]
  .forEach(([f, keys]) => [...keys].forEach(k => { FINGER[k] = f; }));

function buildKeyboard() {
  $('#kb').innerHTML = KB_ROWS.map((row, r) => `<div class="row" style="padding-left:${[0, 12, 22, 40][r]}px">${
    [...row].map(k => `<span class="k ${/[0-9]/.test(k) ? 'dim' : ''} ${k === 'f' || k === 'j' ? 'home' : ''}" data-k="${k}" style="--f:${FINGER_INFO[FINGER[k]][2]}">${k === '-' ? 'ー' : k}</span>`).join('')
  }</div>`).join('');
}
buildKeyboard();

function highlightKey(ch) {
  $$('#kb .k.next').forEach(k => k.classList.remove('next'));
  const el = ch && $(`#kb .k[data-k="${CSS.escape(ch)}"]`);
  const f = FINGER_INFO[FINGER[ch]];
  if (el) el.classList.add('next');
  $('#kb-finger').innerHTML = f ? `つぎは <b>${ch === '-' ? 'ー' : ch.toUpperCase()}</b>　${f[0]}の ${f[1]}` : '';
}
function flashKey(ch, ok) {
  const el = $(`#kb .k[data-k="${CSS.escape(ch)}"]`);
  if (!el) return;
  const cls = ok ? 'hit-ok' : 'hit-ng';
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 150);
}

// =============================================================
//  しあい
// =============================================================
let G = null;
let lastGame = null;

function startGame(cfg) {
  if (G && G.match) G.match.stop();
  lastGame = cfg;
  show('game');
  $('#field-wrap').className = 'lanes-' + cfg.lanes.length;
  $('#hud-title').textContent = cfg.title;
  $('#hud-time').textContent = '0.0';
  $('#banner').classList.add('hidden');
  $('#kb-wrap').classList.toggle('hidden', !kbChk.checked);
  $('#play-area').classList.toggle('with-kb', kbChk.checked);
  $('#hud-bars').innerHTML = cfg.lanes.map(l => `<span class="b"><i style="background:${l.color}"></i></span>`).join('');
  const total = cfg.defenders * 2 + 1;
  const words = pickWords(cfg.levels, total, cfg.seed);
  const me = cfg.lanes.find(l => l.isMe);
  G = {
    cfg, words, total, myId: me.id, idx: 0, matcher: null,
    keys: 0, miss: 0, combo: 0, maxCombo: 0,
    started: false, finished: false, lost: false, time: 0, lastSend: 0,
  };
  G.match = new Match($('#field'), {
    lanes: cfg.lanes, defenders: cfg.defenders, words,
    onEvent: onMatchEvent,
  });
  setWord();
  countdown(() => {
    G.started = true;
    G.match.start();
    tickTimer();
  });
}

function countdown(done) {
  const el = $('#countdown');
  el.classList.remove('hidden', 'small');
  let n = 3;
  const step = () => {
    if (!G) { el.classList.add('hidden'); return; }
    if (n > 0) { el.innerHTML = `<span>${n}</span>`; SFX.count(); n--; setTimeout(step, 800); }
    else {
      el.innerHTML = '<span>キックオフ！</span>'; el.classList.add('small'); SFX.whistle();
      setTimeout(() => el.classList.add('hidden'), 650);
      done();
    }
  };
  step();
}

function tickTimer() {
  if (!G || !G.started) return;
  if (!G.finished) $('#hud-time').textContent = G.match.elapsed().toFixed(1);
  const bars = $$('#hud-bars .b i');
  G.match.lanes.forEach((l, i) => {
    if (bars[i]) bars[i].style.width = Math.min(100, ((l.done + l.frac) / G.total) * 100) + '%';
  });
  requestAnimationFrame(tickTimer);
}

function setWord() {
  const w = G.words[G.idx];
  G.matcher = new Romaji.Matcher(w.yomi);
  const isShot = G.idx === G.total - 1;
  $('#type-panel').classList.toggle('shoot', isShot);
  $('#w-cat').textContent = w.cat;
  const passed = Math.floor(G.idx / 2);
  $('#w-step').textContent = isShot ? '⚡ シュート！' : `のこり DF ${G.cfg.defenders - passed}人`;
  $('#w-text').textContent = w.text;
  const nx = G.words[G.idx + 1];
  $('#w-next').textContent = nx ? `つぎ：${nx.text}` : 'これを うてば ゴール！';
  renderWord();
  fitWord();
}

function renderWord() {
  const m = G.matcher;
  const y = [...G.words[G.idx].yomi];
  $('#w-yomi').innerHTML = y.map((ch, i) => `<span class="t ${i < m.i ? 'ok' : (i === m.i ? 'now' : '')}">${esc(ch)}</span>`).join('');
  const g = m.guide();
  $('#w-roma').innerHTML =
    `<span class="ok">${esc(g.typed)}</span>` +
    (g.rest ? `<span class="cur">${esc(g.rest[0])}</span><span class="rest">${esc(g.rest.slice(1))}</span>` : '');
  $('#w-bar').style.width = (m.ratio * 100) + '%';
  highlightKey(g.rest[0]);
  fit($('#w-roma'), G.fit ? G.fit.roma : 40, 14);
}

// 画面の 大きさに あわせて もじの サイズを きめる
function fitWord() {
  const vh = window.innerHeight;
  G.fit = { text: Math.min(66, vh * 0.075), yomi: Math.min(30, vh * 0.036), roma: Math.min(40, vh * 0.05) };
  fit($('#w-text'), G.fit.text, 18);
  fit($('#w-yomi'), G.fit.yomi, 12);
  fit($('#w-roma'), G.fit.roma, 14);
}

let imeTimer = null;
function imeWarn() {
  $('#ime-warn').classList.remove('hidden');
  clearTimeout(imeTimer);
  imeTimer = setTimeout(() => $('#ime-warn').classList.add('hidden'), 2500);
}

function setCombo() {
  const el = $('#w-combo');
  if (G.combo >= 5) {
    el.textContent = `🔥 ${G.combo}コンボ`;
    if (G.combo % 10 === 0) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  } else el.textContent = '';
  G.match.setBoost(G.myId, G.combo >= 15);
}

document.addEventListener('keydown', e => {
  if (!G || !$('#scr-game').classList.contains('active')) return;
  if (e.key === 'Escape') { quitGame(); return; }
  if (!G.started || G.finished) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.isComposing || e.key === 'Process' || e.keyCode === 229) { imeWarn(); e.preventDefault(); return; }
  if (e.key.length !== 1) return;
  e.preventDefault();
  const ch = e.key.toLowerCase();
  if (/[^\x00-\x7f]/.test(ch)) { imeWarn(); return; }
  if (!/[a-z\-']/.test(ch)) return;

  if (G.matcher.input(ch)) {
    G.keys++;
    G.combo++;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    SFX.key();
    flashKey(ch, true);
    setCombo();
    if (G.matcher.done) wordDone();
    else { renderWord(); G.match.setProgress(G.myId, G.idx, G.matcher.ratio); sendProgress(false); }
  } else {
    G.miss++;
    G.combo = 0;
    setCombo();
    SFX.miss();
    flashKey(ch, false);
    G.match.stumble(G.myId);
    const p = $('#type-panel');
    p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake');
  }
});

function wordDone() {
  G.idx++;
  if (G.idx >= G.total) { finishMe(); return; }
  SFX.word();
  G.match.setProgress(G.myId, G.idx, 0);
  sendProgress(true);
  setWord();
}

function sendProgress(force) {
  if (G.cfg.mode !== 'online') return;
  const now = performance.now();
  if (!force && now - G.lastSend < 90) return;
  G.lastSend = now;
  Net.send({ t: 'p', done: G.idx, frac: +G.matcher.ratio.toFixed(2) });
}

function finishMe() {
  G.finished = true;
  G.time = G.match.elapsed();
  $('#hud-time').textContent = G.time.toFixed(1);
  $('#w-yomi').innerHTML = '';
  $('#w-roma').innerHTML = '<span class="rest">ナイスシュート！</span>';
  $('#w-bar').style.width = '100%';
  $('#w-next').textContent = '';
  highlightKey(null);
  G.match.finishLane(G.myId, G.time);
  if (G.cfg.mode === 'online') {
    Net.send({ t: 'fin', time: +G.time.toFixed(2), keys: G.keys, miss: G.miss });
    setTimeout(() => { if (G && !G.resultShown) banner('ゴール！ みんなを まってるよ…'); }, 1500);
  } else {
    setTimeout(() => showResult(), 2000);
  }
}

function onMatchEvent(type, lane) {
  if (!G) return;
  if (type === 'pass') SFX.pass();
  if (type === 'shot') SFX.kick();
  if (type === 'goal') {
    if (lane.isMe || G.cfg.mode !== 'league') SFX.goal();
    // ひとりプレイ：あいてが さきに ゴール → まけ
    if (G.cfg.mode === 'league' && lane.cpuRate && !G.finished) {
      G.finished = true; G.lost = true;
      G.time = G.match.elapsed();
      highlightKey(null);
      SFX.lose();
      setTimeout(() => showResult(), 1800);
    }
  }
}

function banner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.classList.remove('hidden');
}

let quitArmed = 0;
function quitGame() {
  if (!G) return;
  // confirm() がつかえない環境もあるので「2かい おすと やめる」方式
  if (performance.now() - quitArmed > 2500) {
    quitArmed = performance.now();
    banner('もういちど「やめる」（Esc）を おすと しあいを やめるよ');
    setTimeout(() => { if (G && performance.now() - quitArmed >= 2400) $('#banner').classList.add('hidden'); }, 2500);
    return;
  }
  quitArmed = 0;
  G.match.stop();
  const mode = G.cfg.mode;
  G = null;
  $('#countdown').classList.add('hidden');
  if (mode === 'online') { Net.leave(); showJoin(); show('online'); }
  else if (mode === 'league') { renderLeagues(); show('league'); }
  else { renderPractice(); show('practice'); }
}

// ---------- けっか ----------
function fillStats() {
  const t = G.time || G.match.elapsed();
  const acc = G.keys + G.miss ? Math.round((G.keys / (G.keys + G.miss)) * 100) : 0;
  const kpm = t > 0 ? Math.round((G.keys / t) * 60) : 0;
  $('#rs-time').innerHTML = `${t.toFixed(1)}<small>びょう</small>`;
  $('#rs-keys').textContent = G.keys;
  $('#rs-miss').textContent = G.miss;
  $('#rs-acc').textContent = acc + '%';
  $('#rs-kpm').textContent = kpm;
  $('#rs-combo').textContent = G.maxCombo;
  let title = TITLES[0][1];
  for (const [min, name] of TITLES) if (kpm >= min) title = name;
  const goal = G.finished && !G.lost && (G.cfg.mode !== 'online' || G.match.lane(G.myId).finished);
  $('#rs-badge').textContent = goal ? `しょうごう：${title}` : '';
  // ほし（ゴール / せいかくさ90%いじょう / せいかくさ95%いじょう＆はやい）
  let stars = 0;
  if (goal) { stars = 1; if (acc >= 90) stars = 2; if (acc >= 95 && kpm >= 120) stars = 3; }
  $('#rs-stars').innerHTML = [0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</i>`).join('');
  return { stars, goal };
}

function showResult(ranking) {
  if (!G) return;
  G.resultShown = true;
  const mode = G.cfg.mode;
  const h = $('#rs-title');
  h.className = '';
  $('#rs-rank').innerHTML = '';
  $('#rs-next').classList.add('hidden');
  $('#rs-retry').classList.remove('hidden');
  $('#rs-retry-label').textContent = 'もういちど';
  let win = false;

  if (mode === 'league') {
    const i = G.cfg.league;
    const L = LEAGUES[i];
    if (G.lost) {
      h.textContent = 'おしい…！'; h.classList.add('lose');
      $('#rs-sub').textContent = `${L.rival} に さきに ゴールされちゃった。もういちど チャレンジ！`;
    } else {
      win = true;
      h.textContent = 'しょうり！'; h.classList.add('win');
      const prog = store.get('progress', { cleared: 0, best: {} });
      const first = prog.cleared <= i;
      prog.cleared = Math.max(prog.cleared, i + 1);
      if (!prog.best[i] || G.time < prog.best[i]) prog.best[i] = G.time;
      store.set('progress', prog);
      if (i < LEAGUES.length - 1) {
        $('#rs-sub').textContent = first ? `${L.name} クリア！ ${LEAGUES[i + 1].name} に しょうかく！` : `${L.name} クリア！`;
        $('#rs-next').classList.remove('hidden');
      } else {
        $('#rs-sub').textContent = 'ヨーロッパリーグ せいは！ きみは せかいの ストライカーだ！';
      }
    }
  } else if (mode === 'practice') {
    win = true;
    h.textContent = 'ゴール！'; h.classList.add('win');
    $('#rs-sub').textContent = `れんしゅう（${LEVELS[G.cfg.level].label}）クリア！`;
  } else {
    const myRank = ranking ? ranking.findIndex(r => r.id === G.myId) + 1 : 0;
    win = myRank === 1;
    h.textContent = myRank ? `${myRank}い` : 'しあいしゅうりょう';
    h.classList.add(win ? 'win' : 'lose');
    $('#rs-sub').textContent = win ? 'いちばん はやく ゴール！' : 'ナイスファイト！';
    $('#rs-rank').innerHTML = (ranking || []).map((r, k) => `<li style="background:${PLAYER_COLORS[r.color]}">
      <span class="r">${k + 1}い</span><span class="n">${esc(r.name)}${r.id === G.myId ? '（きみ）' : ''}</span>
      <span class="t">${r.finished ? r.time.toFixed(1) + 'びょう' : 'のこり ' + Math.max(0, G.total - r.done) + 'ご'}</span></li>`).join('');
    const isHost = Net.room && Net.room.players.find(p => p.id === Net.id && p.host);
    $('#rs-retry-label').textContent = 'へやに もどる';
    $('#rs-retry').classList.toggle('hidden', !isHost);
  }
  $('#rs-trophy').classList.toggle('gray', !win);
  fillStats();
  show('result');
  if (win) confetti();
}

// かみふぶき
function confetti() {
  const cv = $('#confetti');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#ff4d6d', '#ffd21a', '#1e7bff', '#22c55e', '#ff8a00', '#b14dff'];
  const ps = Array.from({ length: 140 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 2,
    vy: 2 + Math.random() * 3, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    c: cols[(Math.random() * cols.length) | 0], w: 6 + Math.random() * 6,
  }));
  const end = performance.now() + 3500;
  const frame = now => {
    c.clearRect(0, 0, W, H);
    if (now > end || !$('#scr-result').classList.contains('active')) return;
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c; c.fillRect(-p.w / 2, -3, p.w, 6); c.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

$('#hud-quit').onclick = quitGame;
$('#rs-retry').onclick = () => {
  if (!lastGame) return;
  if (lastGame.mode === 'online') { Net.send({ t: 'lobby' }); return; }
  if (lastGame.mode === 'league') startLeague(lastGame.league);
  else startGame({ ...lastGame, seed: randSeed() });
};
$('#rs-next').onclick = () => startLeague(Math.min(lastGame.league + 1, LEAGUES.length - 1));
$('#rs-menu').onclick = () => {
  if (G) G.match.stop();
  if (lastGame && lastGame.mode === 'online') { Net.leave(); showJoin(); }
  G = null;
  show('title');
};

// =============================================================
//  オンラインたいせん（Cloudflare Workers + Durable Objects）
// =============================================================
const Net = {
  ws: null, id: null, room: null, code: null, intentional: false,
  connect(code, name) {
    this.leave();
    this.code = code;
    this.intentional = false;
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    let ws;
    try { ws = new WebSocket(`${proto}${location.host}/api/room/${code}`); }
    catch (e) { onlineMsg('せつぞく できませんでした'); return; }
    this.ws = ws;
    let opened = false;
    ws.onopen = () => { opened = true; this.send({ t: 'join', name }); };
    ws.onmessage = ev => { try { handleNet(JSON.parse(ev.data)); } catch (e) { console.error(e); } };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.intentional) return;
      onlineMsg(opened ? 'せつぞくが きれました' : 'オンラインたいせんは Cloudflare に こうかいした ページで つかえるよ');
      showJoin();
      if (G && G.cfg.mode === 'online') { G.match.stop(); G = null; show('online'); }
    };
  },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  leave() {
    this.intentional = true;
    if (this.ws) { try { this.ws.close(); } catch (e) { /* noop */ } }
    this.ws = null; this.room = null;
  },
};

let deadlineTimer = null;
function handleNet(m) {
  if (m.t === 'error') { onlineMsg(m.msg); Net.leave(); showJoin(); return; }
  if (m.t === 'room') {
    Net.id = m.you; Net.room = m;
    if (m.phase === 'lobby') {
      if (G && G.cfg.mode === 'online') { G.match.stop(); G = null; }
      clearInterval(deadlineTimer);
      renderLobby();
      if (!$('#scr-online').classList.contains('active')) show('online');
    }
    return;
  }
  if (m.t === 'start') {
    clearInterval(deadlineTimer);
    const lanes = m.players.map(p => ({ id: p.id, name: p.name, color: PLAYER_COLORS[p.color], isMe: p.id === Net.id }));
    startGame({
      mode: 'online', seed: m.seed, levels: [m.cfg.level], defenders: m.cfg.def, level: m.cfg.level,
      title: `たいせん（${LEVELS[m.cfg.level].label}）へや ${Net.code}`,
      lanes,
    });
    return;
  }
  if (!G || G.cfg.mode !== 'online') return;
  if (m.t === 'p' && m.id !== Net.id) G.match.setProgress(m.id, m.done, m.frac);
  if (m.t === 'fin' && m.id !== Net.id) G.match.finishLane(m.id, m.time);
  if (m.t === 'deadline') {
    let left = Math.round(m.ms / 1000);
    clearInterval(deadlineTimer);
    if (!G.finished) banner(`ゴールが でた！ のこり ${left}びょう`);
    deadlineTimer = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(deadlineTimer); return; }
      if (G && !G.finished) banner(`ゴールが でた！ のこり ${left}びょう`);
    }, 1000);
  }
  if (m.t === 'result') {
    clearInterval(deadlineTimer);
    if (!G.finished) { G.finished = true; G.time = G.match.elapsed(); highlightKey(null); }
    setTimeout(() => showResult(m.ranking), 1500);
  }
}

function onlineMsg(t) { $('#on-msg').textContent = t; }
function showJoin() { $('#on-join').classList.remove('hidden'); $('#on-lobby').classList.add('hidden'); }

function openOnline() {
  $('#on-name').value = store.get('name', '');
  onlineMsg('');
  if (Net.ws && Net.room) renderLobby(); else showJoin();
}

function getName() {
  const n = $('#on-name').value.trim().slice(0, 8);
  if (!n) { onlineMsg('なまえを いれてね'); $('#on-name').focus(); return null; }
  store.set('name', n);
  return n;
}
$('#on-create').onclick = () => {
  const n = getName(); if (!n) return;
  const code = String(1000 + Math.floor(Math.random() * 9000));
  onlineMsg('せつぞくちゅう…');
  Net.connect(code, n);
};
$('#on-join-btn').onclick = () => {
  const n = getName(); if (!n) return;
  const code = $('#on-code').value.replace(/[^0-9]/g, '');
  if (code.length !== 4) { onlineMsg('ばんごうは 4けた だよ'); return; }
  onlineMsg('せつぞくちゅう…');
  Net.connect(code, n);
};
$('#on-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#on-join-btn').click(); });
$('#online-back').onclick = () => { Net.leave(); showJoin(); show('title'); };

function renderLobby() {
  const r = Net.room; if (!r) return;
  onlineMsg('');
  $('#on-join').classList.add('hidden');
  $('#on-lobby').classList.remove('hidden');
  $('#lb-code').textContent = Net.code;
  $('#lb-players').innerHTML = [0, 1, 2, 3].map(i => {
    const p = r.players.find(x => x.color === i);
    if (!p) return `<li class="empty">${jerseySvg('#d5dbe5', '?')}<div class="pname">あき</div><small>まってるよ</small></li>`;
    return `<li class="${p.id === Net.id ? 'me' : ''}">${jerseySvg(PLAYER_COLORS[i], i + 1)}
      <div class="pname">${esc(p.name)}</div>
      <small>${p.host ? '👑 ホスト' : ''}${p.id === Net.id ? ' きみ' : ''}${!p.host && p.id !== Net.id ? PLAYER_COLOR_NAMES[i] : ''}</small></li>`;
  }).join('');
  const me = r.players.find(p => p.id === Net.id);
  const isHost = me && me.host;
  $('#lb-host').classList.toggle('hidden', !isHost);
  $('#lb-guest').classList.toggle('hidden', !!isHost);
  $('#lb-cfg').textContent = `レベル：${LEVELS[r.cfg.level].label} ／ ディフェンス：${r.cfg.def}人`;
  if (isHost) {
    $('#lb-levels').innerHTML = LEVELS.map(l => `<button class="chip ${r.cfg.level === l.id ? 'on' : ''}" data-l="${l.id}">${l.label}</button>`).join('');
    $('#lb-defs').innerHTML = [2, 3, 4, 5].map(d => `<button class="chip ${r.cfg.def === d ? 'on' : ''}" data-d="${d}">${d}人</button>`).join('');
    $$('#lb-levels [data-l]').forEach(b => b.onclick = () => Net.send({ t: 'cfg', level: +b.dataset.l, def: r.cfg.def }));
    $$('#lb-defs [data-d]').forEach(b => b.onclick = () => Net.send({ t: 'cfg', level: r.cfg.level, def: +b.dataset.d }));
    const enough = r.players.length >= 2;
    $('#lb-start').disabled = !enough;
    $('#lb-start-note').textContent = enough ? '' : 'あと1人 はいると スタートできるよ';
  }
}
$('#lb-start').onclick = () => Net.send({ t: 'start' });
