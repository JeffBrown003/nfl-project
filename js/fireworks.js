// Fireworks and confetti drawn on a full-screen canvas over the page.
// Used when a team wins the matchups replay. Skipped for reduced-motion readers.

const Fireworks = (() => {
  let canvas, ctx, parts = [], running = false;

  function setup() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.className = "fx-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    const size = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    addEventListener("resize", size);
    size();
  }

  function loop() {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      p.x += p.vx; p.y += p.vy;
      p.life -= p.decay;
      if (p.rocket && p.vy >= -1) { explode(p.x, p.y, p.colors); p.life = 0; continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.confetti) {
        p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

  function explode(x, y, colors) {
    const n = 90;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n, s = 2 + Math.random() * 5;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.06, drag: 0.975,
        life: 1, decay: 0.012 + Math.random() * 0.01, size: 2 + Math.random() * 1.5,
        color: colors[i % colors.length] });
    }
  }

  function launch(colors) {
    const x = innerWidth * (0.15 + Math.random() * 0.7);
    parts.push({ x, y: innerHeight, vx: (Math.random() - 0.5) * 2, vy: -(10 + Math.random() * 5),
      g: 0.16, drag: 0.99, life: 1, decay: 0.004, size: 2.5, color: "#fff3c4", rocket: true, colors });
  }

  function confetti(colors, count = 160) {
    for (let i = 0; i < count; i++) {
      parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, g: 0.03, drag: 0.995,
        life: 1, decay: 0.004, size: 3 + Math.random() * 3, color: colors[i % colors.length],
        confetti: true, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
    }
  }

  function celebrate(colors) {
    if (REDUCED_MOTION) return;
    setup();
    confetti(colors);
    for (let i = 0; i < 7; i++) setTimeout(() => { launch(colors); kick(); }, i * 380);
    kick();
  }

  return { celebrate };
})();
