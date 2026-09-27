// Original stadium-style beat, synthesized live with the Web Audio API.
// No audio files: every drum, bass note and brass hit is generated in the browser.
// Adds itself to the button with id="music-toggle" in the navigation bar.

(function () {
  const BPM = 96;
  const STEP = 60 / BPM / 4;          // one 16th note, in seconds
  const LOOKAHEAD = 0.12;             // schedule this far ahead (seconds)

  // A minor stadium progression: Am - F - C - G, one chord per bar
  const CHORDS = [
    [57, 60, 64], // A minor
    [53, 57, 60], // F major
    [48, 52, 55], // C major
    [55, 59, 62], // G major
  ];
  const BASS = [45, 41, 36, 43];
  //                       1 e + a 2 e + a 3 e + a 4 e + a
  const KICK  = pattern("x . . . . . x . x . . . . . . .");
  const CLAP  = pattern(". . . . x . . . . . . . x . . .");
  const HAT   = pattern("x . x . x . x x x . x . x . x x");
  const BASSP = pattern("x . . x . . x . x . . x . . x .");
  const STAB  = pattern("x . . . . . . . . . x . . . . .");
  const LEAD  = [76, null, 74, null, 72, null, 74, 76, null, null, 79, null, 76, null, null, null];

  let ctx = null, master = null, noise = null;
  let playing = false, step = 0, bar = 0, nextTime = 0, timer = null;

  function pattern(s) { return s.split(" ").map((c) => c === "x"); }
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function setup() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function env(gainNode, t, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    env(g, t, 0.9, 0.45);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.5);
  }

  function noiseHit(t, type, f, q, peak, decay) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    env(g, t, peak, decay);
    s.connect(fl).connect(g).connect(master);
    s.start(t); s.stop(t + decay + 0.05);
  }

  function clap(t) {
    // three quick bursts sound like a crowd clap
    [0, 0.012, 0.024].forEach((o) => noiseHit(t + o, "bandpass", 1400, 0.8, 0.5, 0.16));
  }

  function hat(t, open) { noiseHit(t, "highpass", 8000, 0.7, open ? 0.12 : 0.07, open ? 0.12 : 0.04); }

  function synth(t, midi, type, cutoff, peak, decay, detune = 0) {
    const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq(midi);
    o.detune.value = detune;
    fl.type = "lowpass";
    fl.frequency.setValueAtTime(cutoff, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff / 4), t + decay);
    env(g, t, peak, decay);
    o.connect(fl).connect(g).connect(master);
    o.start(t); o.stop(t + decay + 0.05);
  }

  function schedule(t) {
    const chord = CHORDS[bar % 4];
    if (KICK[step]) kick(t);
    if (CLAP[step]) clap(t);
    if (HAT[step]) hat(t, step === 14);
    if (BASSP[step]) synth(t, BASS[bar % 4], "sawtooth", 900, 0.35, 0.28);
    if (STAB[step]) chord.forEach((n) => { synth(t, n, "sawtooth", 3200, 0.1, 0.5, -8); synth(t, n, "sawtooth", 3200, 0.1, 0.5, 8); });
    // brass-style lead on the last bar of every 4
    if (bar % 4 === 3 && LEAD[step] !== null) synth(t, LEAD[step], "square", 2400, 0.07, 0.22);
    step = (step + 1) % 16;
    if (step === 0) bar++;
  }

  function tick() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      schedule(nextTime);
      nextTime += STEP;
    }
  }

  function start() {
    if (!ctx) setup();
    ctx.resume();
    step = 0; bar = 0;
    nextTime = ctx.currentTime + 0.05;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.35, ctx.currentTime, 0.3);
    timer = setInterval(tick, 25);
    playing = true;
  }

  function stop() {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    clearInterval(timer);
    playing = false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("music-toggle");
    if (!btn) return;
    const label = btn.querySelector(".music-label");
    btn.addEventListener("click", () => {
      if (playing) stop(); else start();
      btn.setAttribute("aria-pressed", String(playing));
      if (label) label.textContent = playing ? "Music on" : "Music off";
    });
  });
})();
