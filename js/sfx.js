// Stadium sound effects for the matchups replay, synthesized with the Web Audio API:
// an air horn, a crowd roar and a referee's whistle. No audio files.

const SFX = (() => {
  let ctx = null, out = null, noise = null;
  let enabled = true;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function ready() {
    if (!enabled) return false;
    init();
    ctx.resume();
    return true;
  }

  // Air horn: a stack of detuned sawtooth waves with a little wobble.
  function horn(duration = 0.9, pitch = 1) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 2600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.04);
    g.gain.setValueAtTime(0.28, t + duration - 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    lp.connect(g).connect(out);
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 6; lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    [233, 294, 349, 466].forEach((f) => {
      [-7, 7].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f * pitch;
        o.detune.value = det;
        lfoGain.connect(o.detune);
        o.connect(lp);
        o.start(t); o.stop(t + duration + 0.05);
      });
    });
    lfo.start(t); lfo.stop(t + duration + 0.05);
  }

  // Crowd roar: band-passed noise that swells and fades.
  function crowd(duration = 2.2, level = 0.5) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noise; s.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level * 0.5, t + duration * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    s.connect(bp).connect(g).connect(out);
    s.start(t); s.stop(t + duration + 0.05);
  }

  // Referee's whistle: a high sine with a fast trill.
  function whistle() {
    if (!ready()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.frequency.value = 2900;
    lfo.frequency.value = 38; lg.gain.value = 120;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.setValueAtTime(0.12, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.5);
    lfo.start(t); lfo.stop(t + 0.5);
  }

  // Short scoreboard "tick" when a number changes
  function tick() {
    if (!ready()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square"; o.frequency.value = 1200;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.06);
  }

  return {
    horn, crowd, whistle, tick,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
  };
})();
