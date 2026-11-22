// =============================================================
//  こうかおん（WebAudioで その場でつくるので 音ファイル不要）
// =============================================================
const SFX = (() => {
  let ac = null;
  let on = true;
  function ctx() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, slideTo = null, delay = 0) {
    if (!on) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.2, freq = 1200, delay = 0) {
    if (!on) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }
  return {
    unlock: ctx,
    set enabled(v) { on = v; },
    get enabled() { return on; },
    key()   { tone(1250, 0.035, 'square', 0.035); },
    miss()  { tone(160, 0.14, 'sawtooth', 0.09, 90); },
    word()  { tone(660, 0.08, 'triangle', 0.12); tone(990, 0.1, 'triangle', 0.12, null, 0.06); },
    pass()  { tone(420, 0.18, 'triangle', 0.14, 1100); noise(0.15, 0.08, 2500); },
    kick()  { noise(0.12, 0.35, 500); tone(120, 0.12, 'sine', 0.25, 60); },
    whistle(long = false) {
      const d = long ? 0.7 : 0.35;
      tone(2350, d, 'sine', 0.12); tone(2480, d, 'sine', 0.06);
    },
    count() { tone(880, 0.12, 'square', 0.06); },
    goal()  {
      noise(1.6, 0.25, 900);
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13, null, i * 0.11));
    },
    lose()  { [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, null, i * 0.2)); },
  };
})();
