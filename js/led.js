// LED scoreboard engine: draws text as glowing light-bulb dots on a <canvas>.
// Includes a 5x7 dot font, scrolling marquees, a "scramble" effect when the text
// changes, and a dot-matrix bar chart for the jumbotron.

const LED_FONT = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["###..", "#..#.", "#...#", "#...#", "#...#", "#..#.", "###.."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  "%": ["##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "*": [".....", ".....", "..#..", ".###.", "..#..", ".....", "....."],
  "/": [".....", "....#", "...#.", "..#..", ".#...", "#....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
};
const LED_ROWS = 7;
const LED_SCRAMBLE = "0123456789ABCDEFGHJKMNPRSTUVWXYZ";

// Turn text (a string, or a list of [text, color] pieces) into columns of dots.
function ledColumns(content, defaultColor) {
  const pieces = typeof content === "string" ? [[content, defaultColor]] : content;
  const cols = [];
  pieces.forEach(([text, color]) => {
    for (const ch of String(text).toUpperCase()) {
      const g = LED_FONT[ch] || LED_FONT[" "];
      for (let x = 0; x < 5; x++) {
        let mask = 0;
        for (let y = 0; y < LED_ROWS; y++) if (g[y][x] === "#") mask |= 1 << y;
        cols.push({ mask, color: color || defaultColor });
      }
      cols.push({ mask: 0, color: null });   // one dark column between letters
    }
  });
  if (cols.length) cols.pop();
  return cols;
}

// Make a team color read as a lit LED on a black board: keep the hue, raise the
// lightness and saturation. Near-black or gray colors use the team's alternate color.
function ledColor(hex, alt) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, sat = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  if ((sat < 0.15 || l < 0.08) && alt) return ledColor(alt);
  if (sat < 0.15) return `hsl(0, 0%, ${Math.round(Math.max(l, 0.8) * 100)}%)`;
  const L = Math.min(0.66, Math.max(0.55, l));
  const S = Math.max(sat, 0.75);
  return `hsl(${Math.round(h)}, ${Math.round(S * 100)}%, ${Math.round(L * 100)}%)`;
}

class LEDDisplay {
  // opts: cols (width in dots), color, align ('left'|'center'|'right'), scroll (bool), speed (dots/sec), pad (rows above/below)
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cols = opts.cols || 40;
    this.pad = opts.pad ?? 1;
    this.rows = LED_ROWS + this.pad * 2;
    this.color = opts.color || "#ffb000";
    this.align = opts.align || "center";
    this.scroll = !!opts.scroll;
    this.speed = opts.speed || 18;
    this.offset = 0;
    this.content = "";
    this.columns = [];
    this.layer = document.createElement("canvas");
    this.running = false;
    this._resize = () => this.resize();
    new ResizeObserver(this._resize).observe(canvas);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || 300;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.pitch = w / this.cols;
    const h = this.pitch * this.rows;
    this.canvas.style.height = h + "px";
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.layer.width = this.canvas.width;
    this.layer.height = this.canvas.height;
    this.dpr = dpr;
    this.draw();
  }

  set(content, opts = {}) {
    if (opts.color) this.color = opts.color;
    const same = JSON.stringify(content) === JSON.stringify(this.content);
    this.content = content;
    if (opts.scramble && !same && !REDUCED_MOTION) return this.scramble(content);
    this.columns = ledColumns(content, this.color);
    this.draw();
    if (this.scroll) this.start();
  }

  scramble(content) {
    const plain = typeof content === "string" ? content : content.map((p) => p[0]).join("");
    const frames = 9;
    let f = 0;
    clearInterval(this._scr);
    this._scr = setInterval(() => {
      f++;
      if (f >= frames) {
        clearInterval(this._scr);
        this.columns = ledColumns(content, this.color);
      } else {
        const mixed = [...plain].map((ch, i) => (ch === " " || i < (f / frames) * plain.length - 1) ? ch
          : LED_SCRAMBLE[Math.floor(Math.random() * LED_SCRAMBLE.length)]).join("");
        this.columns = ledColumns(mixed, this.color);
      }
      this.draw();
    }, 45);
  }

  start() {
    if (this.running || REDUCED_MOTION) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.offset += ((now - last) / 1000) * this.speed;
      last = now;
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Which column of text sits at board column x (or null for a dark column)
  columnAt(x) {
    const n = this.columns.length;
    if (!n) return null;
    if (this.scroll && !REDUCED_MOTION) {
      const period = n + this.cols;              // text followed by a board-width gap
      const i = Math.floor(((x + this.offset) % period + period) % period) - this.cols;
      return i >= 0 && i < n ? this.columns[i] : null;
    }
    let start = 0;
    if (this.align === "center") start = Math.floor((this.cols - n) / 2);
    if (this.align === "right") start = this.cols - n;
    const i = x - start;
    return i >= 0 && i < n ? this.columns[i] : null;
  }

  draw() {
    const { ctx, layer, pitch, dpr } = this;
    if (!pitch) return;
    const W = this.canvas.width, H = this.canvas.height;
    const p = pitch * dpr, r = p * 0.36;
    const lctx = layer.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    lctx.clearRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.055)";          // unlit bulbs
    for (let x = 0; x < this.cols; x++) {
      const col = this.columnAt(x);
      for (let y = 0; y < this.rows; y++) {
        const gy = y - this.pad;
        const cx = x * p + p / 2, cy = y * p + p / 2;
        const lit = col && gy >= 0 && gy < LED_ROWS && (col.mask >> gy) & 1;
        const c = lit ? lctx : ctx;
        if (lit) c.fillStyle = col.color;
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    glowComposite(ctx, layer, p);
  }
}

// Draw the lit layer twice: once blurred (the glow), once sharp (the bulbs).
function glowComposite(ctx, layer, p) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${Math.max(2, p * 0.55)}px)`;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  ctx.drawImage(layer, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.35;                              // hot white centre of each bulb
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "brightness(1.8) saturate(0.6)";
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

// Jumbotron bar chart made of LED dots: one bar per game, up (Team A won) or down.
class LEDBars {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rows = opts.rows || 33;
    this.layer = document.createElement("canvas");
    this.bars = [];            // [{ value, color }]
    this.visible = Infinity;   // bars shown (for the replay)
    this.highlight = -1;
    this.maxAbs = 20;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cols = Math.max(40, Math.floor(w / 9));
    this.pitch = w / this.cols;
    const h = this.pitch * this.rows;
    this.canvas.style.height = h + "px";
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.layer.width = this.canvas.width;
    this.layer.height = this.canvas.height;
    this.dpr = dpr;
    this.draw();
  }

  setBars(bars) {
    this.bars = bars;
    this.maxAbs = Math.max(7, ...bars.map((b) => Math.abs(b.value)));
    this.draw();
  }

  // Map a board column to a bar index (bars are spread evenly with gaps)
  layout() {
    const n = this.bars.length || 1;
    const slot = this.cols / n;
    const width = Math.max(1, Math.min(6, Math.floor(slot * 0.6)));
    return { slot, width };
  }

  barAtX(px) {
    const { slot } = this.layout();
    const i = Math.floor(px / this.pitch / slot);
    return i >= 0 && i < this.bars.length ? i : -1;
  }

  draw() {
    const { ctx, layer, dpr, pitch, rows, cols } = this;
    if (!pitch) return;
    const W = this.canvas.width, H = this.canvas.height;
    const p = pitch * dpr, r = p * 0.36;
    const lctx = layer.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    lctx.clearRect(0, 0, W, H);
    const mid = Math.floor(rows / 2);
    const half = mid - 1;
    const { slot, width } = this.layout();

    const litAt = new Map();
    this.bars.forEach((b, i) => {
      if (i >= this.visible) return;
      const h = Math.max(1, Math.round((Math.abs(b.value) / this.maxAbs) * half));
      const x0 = Math.floor(i * slot + (slot - width) / 2);
      for (let dx = 0; dx < width; dx++) {
        for (let k = 1; k <= h; k++) {
          const y = b.value >= 0 ? mid - k : mid + k;
          litAt.set((x0 + dx) + "," + y, i === this.highlight ? "#ffffff" : b.color);
        }
      }
    });

    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const key = x + "," + y;
        const cx = x * p + p / 2, cy = y * p + p / 2;
        let c = ctx;
        if (litAt.has(key)) { c = lctx; c.fillStyle = litAt.get(key); }
        else ctx.fillStyle = y === mid ? "rgba(255,190,60,0.35)" : "rgba(255,255,255,0.05)";
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    glowComposite(ctx, layer, p);
  }
}
