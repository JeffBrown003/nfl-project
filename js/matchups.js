// Matchups page: an LED stadium scoreboard for any two teams, built from
// data/matchups.json (made by scripts/build_matchup_data.py).
// Win % counts a tie as half a win. Needs led.js, sfx.js and fireworks.js.

const M = { teams: [], byAbbr: {}, games: [], seasons: [] };
const sel = { a: "KC", b: "BUF", type: "all", from: 2016, to: 2025 };
let picking = "a";
let replay = { on: false, token: 0 };
const LED = {};
let bars = null, formChart = null;
const AMBER = "#ffb000";

fetch("data/matchups.json")
  .then((r) => r.json())
  .then((d) => {
    M.teams = d.teams;
    d.teams.forEach((t) => (M.byAbbr[t.abbr] = t));
    M.games = d.games.map(([season, week, post, home, away, hs, as]) => ({ season, week, post, home, away, hs, as }));
    M.seasons = [...new Set(M.games.map((g) => g.season))].sort();
    readHash();
    buildBoard();
    buildDraft();
    buildControls();
    buildForm();
    update();
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("board-text").textContent = "The games could not be loaded. Please refresh the page.";
  });

// ---------- Helpers ----------

function readHash() {
  const m = location.hash.match(/^#([A-Z]{2,3})-([A-Z]{2,3})$/);
  if (m && M.byAbbr[m[1]] && M.byAbbr[m[2]] && m[1] !== m[2]) { sel.a = m[1]; sel.b = m[2]; }
}

function inFilters(g) {
  if (g.season < sel.from || g.season > sel.to) return false;
  if (sel.type === "reg" && g.post) return false;
  if (sel.type === "post" && !g.post) return false;
  return true;
}

function sideOf(g, team) {
  const isHome = g.home === team;
  const pf = isHome ? g.hs : g.as, pa = isHome ? g.as : g.hs;
  return { pf, pa, margin: pf - pa, isHome };
}

// Playoff round from the week number (the season grew to 17 games in 2021)
function roundName(g, short = false) {
  if (!g.post) return short ? `WK ${g.week}` : `Week ${g.week}`;
  const i = g.week - (g.season >= 2021 ? 19 : 18);
  const long = ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"][i] || "Playoffs";
  const brief = ["WILD CARD", "DIVISIONAL", "CONF CHAMP", "SUPER BOWL"][i] || "PLAYOFFS";
  return short ? brief : long;
}

function hexToRgb(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDistance(x, y) {
  const [a, b] = [hexToRgb(x), hexToRgb(y)];
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// LED colors for both teams; Team B switches to its 2nd color if the two clash
function teamColors() {
  const A = M.byAbbr[sel.a], B = M.byAbbr[sel.b];
  const baseA = isGray(A.color) ? A.color2 : A.color;
  let baseB = isGray(B.color) ? B.color2 : B.color;
  if (colorDistance(baseA, baseB) < 90) {
    const alt = baseB === B.color ? B.color2 : B.color;
    baseB = colorDistance(baseA, alt) >= 90 && !isGray(alt) ? alt : "#b0b7bc";
  }
  return [ledColor(baseA), ledColor(baseB), baseA, baseB];
}

// True for black, white and gray colors (no clear hue)
function isGray(hex) {
  const [r, g, b] = hexToRgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b) < 30;
}

function matchupGames() {
  return M.games
    .filter((g) => inFilters(g) && ((g.home === sel.a && g.away === sel.b) || (g.home === sel.b && g.away === sel.a)))
    .sort((x, y) => x.season - y.season || x.week - y.week);
}

function summarize(games) {
  const s = { n: games.length, aw: 0, bw: 0, ties: 0, margin: 0, points: 0, close: 0, poA: 0, poB: 0 };
  games.forEach((g) => {
    const r = sideOf(g, sel.a);
    if (r.margin > 0) { s.aw++; if (g.post) s.poA++; }
    else if (r.margin < 0) { s.bw++; if (g.post) s.poB++; }
    else s.ties++;
    s.margin += r.margin;
    s.points += g.hs + g.as;
    if (Math.abs(r.margin) <= 7) s.close++;
  });
  s.pa = s.n ? ((s.aw + s.ties / 2) / s.n) * 100 : NaN;
  s.pb = s.n ? ((s.bw + s.ties / 2) / s.n) * 100 : NaN;
  return s;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Build the scoreboard ----------

function buildBoard() {
  const L = (id, opts) => (LED[id] = new LEDDisplay(document.getElementById("led-" + id), opts));
  L("top", { cols: 150, scroll: true, speed: 22, color: AMBER });
  L("bottom", { cols: 150, scroll: true, speed: 20, color: AMBER });
  L("name-a", { cols: 59, pad: 1 });
  L("name-b", { cols: 59, pad: 1 });
  L("score-a", { cols: 13, pad: 1 });
  L("score-b", { cols: 13, pad: 1 });
  L("games", { cols: 19, pad: 1, color: AMBER });
  L("ties", { cols: 13, pad: 1, color: AMBER });
  ["pa", "pb", "margin", "points", "close", "playoff"].forEach((id) => L(id, { cols: 35, pad: 1, color: AMBER }));

  bars = new LEDBars(document.getElementById("led-bars"), { rows: 35 });
  const tip = document.getElementById("jumbo-tip");
  const canvas = document.getElementById("led-bars");
  canvas.addEventListener("mousemove", (e) => {
    const i = bars.barAtX(e.offsetX);
    const games = matchupGames();
    if (i < 0 || !games[i] || replay.on) { tip.hidden = true; return; }
    const g = games[i], r = sideOf(g, sel.a);
    const A = M.byAbbr[sel.a], B = M.byAbbr[sel.b];
    tip.innerHTML = `<b>${g.season} &middot; ${roundName(g)}</b><br>${r.isHome ? B.abbr + " at " + A.abbr : A.abbr + " at " + B.abbr}: ${A.abbr} ${r.pf}&ndash;${r.pa} ${B.abbr}`;
    tip.style.left = e.offsetX + 14 + "px";
    tip.style.top = e.offsetY + 14 + "px";
    tip.hidden = false;
  });
  canvas.addEventListener("mouseleave", () => (tip.hidden = true));
}

// ---------- Draft board ----------

function buildDraft() {
  const order = ["AFC East", "AFC North", "AFC South", "AFC West", "NFC East", "NFC North", "NFC South", "NFC West"];
  const html = order.map((div) => {
    const teams = M.teams.filter((t) => t.div === div);
    return `<div class="div-card"><h3>${div}</h3><div class="div-teams">` +
      teams.map((t) => `<button type="button" class="tile" data-team="${t.abbr}" title="${t.name}"
        style="background:linear-gradient(150deg, ${t.color} 0%, ${t.color} 55%, ${t.color2} 140%);--glow:${ledColor(t.color, t.color2)}">
        <div class="t-abbr">${t.abbr}</div><div class="t-nick">${t.nick}</div></button>`).join("") +
      "</div></div>";
  }).join("");
  const draft = document.getElementById("draft");
  draft.innerHTML = html;
  draft.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile) return;
    const t = tile.dataset.team;
    if (picking === "a") { if (t === sel.b) sel.b = sel.a; sel.a = t; setPicking("b"); }
    else { if (t === sel.a) sel.a = sel.b; sel.b = t; setPicking("a"); }
    stopReplay();
    update();
    SFX.tick();
    document.getElementById("board").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
  });
}

function setPicking(side) {
  picking = side;
  document.getElementById("pick-a").setAttribute("aria-pressed", String(side === "a"));
  document.getElementById("pick-b").setAttribute("aria-pressed", String(side === "b"));
}

function markTiles() {
  document.querySelectorAll(".tile").forEach((el) => {
    const t = el.dataset.team;
    el.classList.toggle("is-a", t === sel.a);
    el.classList.toggle("is-b", t === sel.b);
    const old = el.querySelector(".badge");
    if (old) old.remove();
    if (t === sel.a || t === sel.b) el.insertAdjacentHTML("beforeend", `<span class="badge">${t === sel.a ? "A" : "B"}</span>`);
  });
}

// ---------- Controls ----------

function buildControls() {
  const seasonOpts = M.seasons.map((s) => `<option value="${s}">${s}</option>`).join("");
  document.getElementById("m-from").innerHTML = seasonOpts;
  document.getElementById("m-to").innerHTML = seasonOpts;
  const on = (id, ev, fn) => document.getElementById(id).addEventListener(ev, fn);
  on("m-type", "change", (e) => { sel.type = e.target.value; stopReplay(); update(); });
  on("m-from", "change", (e) => { sel.from = +e.target.value; if (sel.to < sel.from) sel.to = sel.from; stopReplay(); update(); });
  on("m-to", "change", (e) => { sel.to = +e.target.value; if (sel.from > sel.to) sel.from = sel.to; stopReplay(); update(); });
  on("swap", "click", () => { [sel.a, sel.b] = [sel.b, sel.a]; stopReplay(); update(); SFX.tick(); });
  on("random", "click", () => {
    const pool = M.games.filter(inFilters);
    const g = pool[Math.floor(Math.random() * pool.length)];
    if (g) { sel.a = g.home; sel.b = g.away; stopReplay(); update(); SFX.tick(); }
  });
  on("sfx", "click", (e) => {
    SFX.enabled = !SFX.enabled;
    e.currentTarget.setAttribute("aria-pressed", String(SFX.enabled));
    e.currentTarget.innerHTML = `&#128227; Stadium sounds: ${SFX.enabled ? "on" : "off"}`;
  });
  on("replay", "click", () => (replay.on ? stopReplay(true) : runReplay()));
  on("pick-a", "click", () => setPicking("a"));
  on("pick-b", "click", () => setPicking("b"));
}

// ---------- Season form chart (dark jumbotron style) ----------

function buildForm() {
  const line = () => ({ label: "", data: [], borderColor: "#fff", backgroundColor: "#fff", pointBorderColor: "#020203", pointBorderWidth: 2, spanGaps: true, borderWidth: 2.5 });
  formChart = new Chart(document.getElementById("c-form"), {
    type: "line",
    data: { labels: [], datasets: [line(), line()] },
    options: {
      scales: {
        y: { min: 0, max: 100, grid: { color: "#171b21" }, ticks: { color: "#8d97a6", callback: (v) => v + "%" } },
        x: { grid: { color: "#171b21" }, ticks: { color: "#8d97a6" } },
      },
      plugins: {
        legend: { labels: { color: "#dfe5ee" } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt.pct(c.parsed.y)}` } },
      },
    },
  });
}

function seasonForm(team) {
  return M.seasons.map((season) => {
    if (season < sel.from || season > sel.to) return null;
    let w = 0, n = 0;
    M.games.forEach((x) => {
      if (x.season !== season || x.post || (x.home !== team && x.away !== team)) return;
      const r = sideOf(x, team);
      n++; w += r.margin > 0 ? 1 : r.margin === 0 ? 0.5 : 0;
    });
    return n ? (w / n) * 100 : null;
  });
}

// ---------- Render ----------

function showStats(s) {
  const sc = (v) => ({ scramble: true, color: AMBER, v });
  LED.pa.set(s.n ? s.pa.toFixed(1) + "%" : "-", sc());
  LED.pb.set(s.n ? s.pb.toFixed(1) + "%" : "-", sc());
  const m = s.n ? s.margin / s.n : NaN;
  LED.margin.set(s.n ? (m > 0 ? "+" : "") + m.toFixed(1) : "-", sc());
  LED.points.set(s.n ? (s.points / s.n).toFixed(1) : "-", sc());
  LED.close.set(s.n ? `${s.close}/${s.n}` : "-", sc());
  LED.playoff.set(s.n ? `${s.poA}-${s.poB}` : "-", sc());
  LED.ties.set(String(s.ties), sc());
  document.getElementById("poss-a").classList.toggle("on", s.aw > s.bw);
  document.getElementById("poss-b").classList.toggle("on", s.bw > s.aw);
}

function gameLog(games, A, B, ca, cb) {
  if (!games.length) return [["NO GAMES BETWEEN THESE TEAMS WITH THESE FILTERS", AMBER]];
  const pieces = [];
  games.slice().reverse().forEach((g) => {
    const r = sideOf(g, sel.a);
    pieces.push([`${g.season} ${roundName(g, true)}  `, AMBER]);
    pieces.push([`${A.abbr} ${r.pf}`, r.margin >= 0 ? ca : "#8d97a6"]);
    pieces.push(["  ", AMBER]);
    pieces.push([`${B.abbr} ${r.pa}`, r.margin <= 0 ? cb : "#8d97a6"]);
    pieces.push(["   *   ", AMBER]);
  });
  return pieces;
}

function update() {
  history.replaceState(null, "", `#${sel.a}-${sel.b}`);
  document.getElementById("m-type").value = sel.type;
  document.getElementById("m-from").value = sel.from;
  document.getElementById("m-to").value = sel.to;
  markTiles();

  const A = M.byAbbr[sel.a], B = M.byAbbr[sel.b];
  const [ca, cb] = teamColors();
  const games = matchupGames();
  const s = summarize(games);

  LED["name-a"].set(A.nick, { color: ca, scramble: true });
  LED["name-b"].set(B.nick, { color: cb, scramble: true });
  LED["score-a"].set(String(s.aw), { color: ca, scramble: true });
  LED["score-b"].set(String(s.bw), { color: cb, scramble: true });
  document.getElementById("score-label-a").textContent = "Wins";
  document.getElementById("score-label-b").textContent = "Wins";
  LED.games.set(String(s.n), { color: AMBER, scramble: true });
  showStats(s);

  const leader = s.aw > s.bw ? `${A.abbr} LEADS ${s.aw}-${s.bw}` : s.bw > s.aw ? `${B.abbr} LEADS ${s.bw}-${s.aw}` : s.n ? `SERIES TIED ${s.aw}-${s.bw}` : "NO MEETINGS";
  const span = sel.from === sel.to ? `${sel.from}` : `${sel.from}-${sel.to}`;
  const typeTxt = { all: "", reg: " REGULAR SEASON", post: " PLAYOFF" }[sel.type];
  LED.top.scroll = true;
  LED.top.set([
    [A.name, ca], ["  VS  ", AMBER], [B.name, cb],
    [`   *   ${s.n}${typeTxt} MEETING${s.n === 1 ? "" : "S"} ${span}   *   ${leader}   *   PRESS PLAY THE RIVALRY FOR THE REPLAY   *`, AMBER],
  ]);
  LED.bottom.scroll = true;
  LED.bottom.set(gameLog(games, A, B, ca, cb));

  // Jumbotron bars
  bars.visible = Infinity;
  bars.highlight = -1;
  bars.setBars(games.map((g) => { const m = sideOf(g, sel.a).margin; return { value: m, color: m >= 0 ? ca : cb }; }));
  const maxA = Math.max(0, ...games.map((g) => sideOf(g, sel.a).margin));
  const maxB = Math.max(0, ...games.map((g) => -sideOf(g, sel.a).margin));
  document.getElementById("jumbo-range").textContent = games.length ? `Biggest wins: ${A.abbr} by ${maxA} · ${B.abbr} by ${maxB}` : "";
  document.getElementById("jumbo-title").textContent = `Game-by-game margin: ${A.abbr} vs ${B.abbr}`;
  document.getElementById("jumbo-key").innerHTML =
    `<span><i style="background:${ca};color:${ca}"></i>${A.abbr} won</span><span><i style="background:${cb};color:${cb}"></i>${B.abbr} won</span>`;

  // Season form
  formChart.data.labels = M.seasons;
  [[sel.a, ca], [sel.b, cb]].forEach(([t, c], i) => {
    const ds = formChart.data.datasets[i];
    ds.label = t; ds.data = seasonForm(t); ds.borderColor = c; ds.backgroundColor = c;
  });
  formChart.update();

  // Box scores
  const rows = games.slice().reverse().map((g) => {
    const r = sideOf(g, sel.a);
    const winner = r.margin > 0 ? A.abbr : r.margin < 0 ? B.abbr : "Tie";
    return `<tr><td>${g.season}${g.post ? '<span class="pill">Playoffs</span>' : ""}</td><td>${roundName(g)}</td><td>at ${r.isHome ? A.abbr : B.abbr}</td>` +
      `<td class="${r.margin > 0 ? "win" : ""}">${r.pf}</td><td class="${r.margin < 0 ? "win" : ""}">${r.pa}</td><td>${winner}</td><td>${r.margin > 0 ? "+" : ""}${r.margin}</td></tr>`;
  }).join("");
  document.getElementById("games").innerHTML = games.length
    ? `<thead><tr><th>Season</th><th>Game</th><th>Where</th><th>${A.abbr}</th><th>${B.abbr}</th><th>Winner</th><th>${A.abbr} margin</th></tr></thead><tbody>${rows}</tbody>`
    : "";
  document.getElementById("no-games").hidden = games.length > 0;

  // Screen-reader summary of the board
  document.getElementById("board-text").textContent = s.n
    ? `${A.name} ${s.aw} wins, ${B.name} ${s.bw} wins${s.ties ? ", " + s.ties + " ties" : ""}, in ${s.n} games. ${A.nick} win rate ${fmt.pct(s.pa)}, ${B.nick} ${fmt.pct(s.pb)}.`
    : `${A.name} and ${B.name} did not play each other with these filters.`;

  renderHeat();
}

// ---------- Replay: play through every game on the scoreboard ----------

function stopReplay(restore = false) {
  if (!replay.on) return;
  replay.on = false;
  replay.token++;
  const btn = document.getElementById("replay");
  btn.classList.remove("playing");
  document.getElementById("replay-label").textContent = "Play the rivalry";
  if (restore) update();
}

async function runReplay() {
  const games = matchupGames();
  if (!games.length) return;
  const token = ++replay.token;
  replay.on = true;
  const btn = document.getElementById("replay");
  btn.classList.add("playing");
  document.getElementById("replay-label").textContent = "Stop replay";
  document.getElementById("board").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });

  const A = M.byAbbr[sel.a], B = M.byAbbr[sel.b];
  const [ca, cb, rawA, rawB] = teamColors();
  const alive = () => replay.on && replay.token === token;

  // Kickoff
  document.getElementById("score-label-a").textContent = "Points";
  document.getElementById("score-label-b").textContent = "Points";
  LED.bottom.scroll = false; LED.bottom.running = false; LED.bottom.offset = 0;
  LED.bottom.set(`KICKOFF: ${games.length} GAME${games.length > 1 ? "S" : ""}`, { color: AMBER, scramble: true });
  LED["score-a"].set("0", { color: ca }); LED["score-b"].set("0", { color: cb });
  bars.visible = 0; bars.highlight = -1; bars.draw();
  SFX.whistle();
  await sleep(1100);

  for (let i = 0; i < games.length; i++) {
    if (!alive()) return;
    const g = games[i], r = sideOf(g, sel.a);
    LED["score-a"].set(String(r.pf), { color: ca, scramble: true });
    LED["score-b"].set(String(r.pa), { color: cb, scramble: true });
    LED.games.set(`${i + 1}`, { color: AMBER, scramble: true });
    LED.bottom.set([[`${g.season} ${roundName(g, true)}   `, AMBER], [r.margin > 0 ? `${A.abbr} WINS` : r.margin < 0 ? `${B.abbr} WINS` : "TIE", r.margin > 0 ? ca : r.margin < 0 ? cb : AMBER]], { scramble: true });
    showStats(summarize(games.slice(0, i + 1)));
    bars.visible = i + 1; bars.highlight = i; bars.draw();
    const board = document.getElementById("board");
    board.classList.add("celebrate");
    setTimeout(() => board.classList.remove("celebrate"), 450);
    if (r.margin !== 0) SFX.horn(0.55, r.margin > 0 ? 1 : 0.84);
    SFX.crowd(1.3, 0.35 + Math.min(0.4, 7 / (Math.abs(r.margin) + 7) * 0.4));
    await sleep(games.length > 14 ? 1100 : 1600);
  }
  if (!alive()) return;

  // Final
  const s = summarize(games);
  const winner = s.aw > s.bw ? A : s.bw > s.aw ? B : null;
  document.getElementById("score-label-a").textContent = "Wins";
  document.getElementById("score-label-b").textContent = "Wins";
  LED["score-a"].set(String(s.aw), { color: ca, scramble: true });
  LED["score-b"].set(String(s.bw), { color: cb, scramble: true });
  LED.games.set(String(s.n), { color: AMBER, scramble: true });
  LED.bottom.set(winner ? [["SERIES WINNER  ", AMBER], [winner.abbr, winner === A ? ca : cb], [`  ${Math.max(s.aw, s.bw)}-${Math.min(s.aw, s.bw)}`, AMBER]] : [["SERIES TIED", AMBER]], { scramble: true });
  bars.highlight = -1; bars.draw();
  SFX.horn(1.6, 1); SFX.crowd(3.5, 0.8);
  if (winner) {
    const raw = winner === A ? rawA : rawB;
    Fireworks.celebrate([ledColor(raw), ledColor(winner.color2, winner.color), "#ffffff", "#ffd23f"]);
  }
  await sleep(4500);
  if (alive()) stopReplay(true);
}

// ---------- League grid ----------

function mix(c1, c2, t) {
  const [a, b] = [hexToRgb(c1), hexToRgb(c2)];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

function heatColor(p) {
  // red (lost more) -> dark neutral (even) -> blue (won more)
  return p < 0.5 ? mix("#e34948", "#2a2f37", p / 0.5) : mix("#2a2f37", "#3987e5", (p - 0.5) / 0.5);
}

function renderHeat() {
  const abbrs = M.teams.map((t) => t.abbr);
  const idx = Object.fromEntries(abbrs.map((a, i) => [a, i]));
  const N = abbrs.length;
  const w = Array.from({ length: N }, () => new Float32Array(N));
  const g = Array.from({ length: N }, () => new Uint16Array(N));
  M.games.forEach((x) => {
    if (!inFilters(x)) return;
    const h = idx[x.home], a = idx[x.away];
    g[h][a]++; g[a][h]++;
    const hw = x.hs > x.as ? 1 : x.hs === x.as ? 0.5 : 0;
    w[h][a] += hw; w[a][h] += 1 - hw;
  });
  let html = "<thead><tr><th></th>" + abbrs.map((a) => `<th scope="col">${a}</th>`).join("") + "</tr></thead><tbody>";
  for (let r = 0; r < N; r++) {
    html += `<tr><th scope="row">${abbrs[r]}</th>`;
    for (let c = 0; c < N; c++) {
      if (r === c) { html += '<td class="self"></td>'; continue; }
      if (!g[r][c]) { html += `<td class="none" title="${abbrs[r]} and ${abbrs[c]} did not play"></td>`; continue; }
      const p = w[r][c] / g[r][c];
      const isSel = abbrs[r] === sel.a && abbrs[c] === sel.b;
      html += `<td class="${isSel ? "sel" : ""}" data-r="${abbrs[r]}" data-c="${abbrs[c]}" style="background:${heatColor(p)};color:#fff" title="${abbrs[r]} vs ${abbrs[c]}: ${fmt.pct(p * 100)} in ${g[r][c]} game${g[r][c] > 1 ? "s" : ""}">${g[r][c]}</td>`;
    }
    html += "</tr>";
  }
  const table = document.getElementById("heat");
  table.innerHTML = html + "</tbody>";
  table.onclick = (e) => {
    const td = e.target.closest("td[data-r]");
    if (!td) return;
    sel.a = td.dataset.r; sel.b = td.dataset.c;
    stopReplay();
    update();
    SFX.tick();
    document.getElementById("board").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
  };
}
