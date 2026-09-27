// Matchups page: head-to-head history for two teams, from data/matchups.json
// (made by scripts/build_matchup_data.py). Win % counts a tie as half a win.

const M = { teams: [], byAbbr: {}, games: [], seasons: [] };
const sel = { a: "KC", b: "BUF", type: "all", from: 2016, to: 2025 };
const mcharts = {};

fetch("data/matchups.json")
  .then((r) => r.json())
  .then((d) => {
    M.teams = d.teams;
    d.teams.forEach((t) => (M.byAbbr[t.abbr] = t));
    M.games = d.games.map(([season, week, post, home, away, hs, as]) => ({ season, week, post, home, away, hs, as }));
    M.seasons = [...new Set(M.games.map((g) => g.season))].sort();
    readHash();
    setupControls();
    setupCharts();
    document.getElementById("loading").hidden = true;
    document.getElementById("content").hidden = false;
    update();
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("loading").textContent = "The games could not be loaded. Please refresh the page.";
  });

// ---------- Controls ----------

function readHash() {
  // e.g. matchups.html#KC-BUF opens that matchup
  const m = location.hash.match(/^#([A-Z]{2,3})-([A-Z]{2,3})$/);
  if (m && M.byAbbr[m[1]] && M.byAbbr[m[2]] && m[1] !== m[2]) { sel.a = m[1]; sel.b = m[2]; }
}

function setupControls() {
  const opts = M.teams.map((t) => `<option value="${t.abbr}">${t.name}</option>`).join("");
  const a = document.getElementById("team-a"), b = document.getElementById("team-b");
  a.innerHTML = opts; b.innerHTML = opts;
  const seasonOpts = M.seasons.map((s) => `<option value="${s}">${s}</option>`).join("");
  document.getElementById("m-from").innerHTML = seasonOpts;
  document.getElementById("m-to").innerHTML = seasonOpts;

  a.addEventListener("change", () => { sel.a = a.value; if (sel.a === sel.b) sel.b = otherTeam(sel.a); update(); });
  b.addEventListener("change", () => { sel.b = b.value; if (sel.a === sel.b) sel.a = otherTeam(sel.b); update(); });
  document.getElementById("swap").addEventListener("click", () => { [sel.a, sel.b] = [sel.b, sel.a]; update(); });
  document.getElementById("m-type").addEventListener("change", (e) => { sel.type = e.target.value; update(); });
  document.getElementById("m-from").addEventListener("change", (e) => { sel.from = +e.target.value; if (sel.to < sel.from) sel.to = sel.from; update(); });
  document.getElementById("m-to").addEventListener("change", (e) => { sel.to = +e.target.value; if (sel.from > sel.to) sel.from = sel.to; update(); });
}

function otherTeam(abbr) { return M.teams.find((t) => t.abbr !== abbr).abbr; }

function syncControls() {
  document.getElementById("team-a").value = sel.a;
  document.getElementById("team-b").value = sel.b;
  document.getElementById("m-type").value = sel.type;
  document.getElementById("m-from").value = sel.from;
  document.getElementById("m-to").value = sel.to;
  history.replaceState(null, "", `#${sel.a}-${sel.b}`);
}

// ---------- Data helpers ----------

function inFilters(g) {
  if (g.season < sel.from || g.season > sel.to) return false;
  if (sel.type === "reg" && g.post) return false;
  if (sel.type === "post" && !g.post) return false;
  return true;
}

// Result from one team's side: +margin if they won
function sideOf(g, team) {
  const isHome = g.home === team;
  const pf = isHome ? g.hs : g.as, pa = isHome ? g.as : g.hs;
  return { pf, pa, margin: pf - pa, isHome, opp: isHome ? g.away : g.home };
}

function hexToRgb(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDistance(x, y) {
  const [a, b] = [hexToRgb(x), hexToRgb(y)];
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// Team B uses its second color if its main color is too close to Team A's
function teamColors() {
  const A = M.byAbbr[sel.a], B = M.byAbbr[sel.b];
  let cb = B.color;
  if (colorDistance(A.color, cb) < 90) cb = colorDistance(A.color, B.color2) >= 90 ? B.color2 : "#6b7280";
  return [A.color, cb];
}

// ---------- Charts ----------

function setupCharts() {
  mcharts.margin = new Chart(document.getElementById("c-margin"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "Margin", data: [], backgroundColor: [], maxBarThickness: 34 }] },
    options: {
      interaction: { mode: "nearest", axis: "x", intersect: false },
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => (v > 0 ? "+" : "") + v } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + mcharts.margin.$labels[c.dataIndex] } } },
    },
  });
  const line = (color) => ({ label: "", data: [], borderColor: color, backgroundColor: color, pointBorderColor: "#fcfcfb", pointBorderWidth: 2, spanGaps: true });
  mcharts.form = new Chart(document.getElementById("c-form"), {
    type: "line",
    data: { labels: [], datasets: [line(COLORS.s1), line(COLORS.s2)] },
    options: {
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } },
      plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt.pct(c.parsed.y)}` } } },
    },
  });
}

// ---------- Render ----------

function setText(id, t) { document.getElementById(id).textContent = t; }

function update() {
  syncControls();
  const A = M.byAbbr[sel.a], B = M.byAbbr[sel.b];
  const [ca, cb] = teamColors();

  const games = M.games
    .filter((g) => inFilters(g) && ((g.home === sel.a && g.away === sel.b) || (g.home === sel.b && g.away === sel.a)))
    .sort((x, y) => x.season - y.season || x.week - y.week);

  let aw = 0, bw = 0, ties = 0, marginSum = 0, pointsSum = 0, close = 0;
  let bigA = null, bigB = null;
  games.forEach((g) => {
    const s = sideOf(g, sel.a);
    if (s.margin > 0) aw++; else if (s.margin < 0) bw++; else ties++;
    marginSum += s.margin;
    pointsSum += g.hs + g.as;
    if (Math.abs(s.margin) <= 7) close++;
    if (s.margin > 0 && (!bigA || s.margin > bigA.m)) bigA = { m: s.margin, g };
    if (s.margin < 0 && (!bigB || -s.margin > bigB.m)) bigB = { m: -s.margin, g };
  });
  const n = games.length;

  // Scoreboard
  document.getElementById("card-a").style.background = `linear-gradient(135deg, ${ca}, ${shade(ca)})`;
  document.getElementById("card-b").style.background = `linear-gradient(225deg, ${cb}, ${shade(cb)})`;
  setText("a-abbr", A.abbr); setText("a-name", A.name);
  setText("b-abbr", B.abbr); setText("b-name", B.name);
  bump("a-wins", aw); bump("b-wins", bw);

  const pa = n ? ((aw + ties / 2) / n) * 100 : 0;
  const pb = n ? ((bw + ties / 2) / n) * 100 : 0;
  const barA = document.getElementById("bar-a"), barB = document.getElementById("bar-b"), barT = document.getElementById("bar-t");
  barA.style.width = n ? (aw / n) * 100 + "%" : "50%"; barA.style.background = ca;
  barT.style.width = n ? (ties / n) * 100 + "%" : "0%"; barT.style.background = "#9ca3af";
  barB.style.width = n ? (bw / n) * 100 + "%" : "50%"; barB.style.background = cb;
  setText("pct-a", n ? `${A.nick} win %: ${fmt.pct(pa)}` : "No games");
  setText("pct-t", ties ? `${ties} tie${ties > 1 ? "s" : ""}` : "");
  setText("pct-b", n ? `${B.nick} win %: ${fmt.pct(pb)}` : "");

  // Stat tiles
  setText("s-games", n);
  const avg = n ? marginSum / n : NaN;
  setText("s-margin", n ? (avg > 0 ? "+" : "") + avg.toFixed(1) : "–");
  setText("s-margin-l", `average margin, from the ${A.nick}' side`);
  setText("s-points", n ? (pointsSum / n).toFixed(1) : "–");
  setText("s-close", n ? `${close} of ${n}` : "–");
  const big = bigA && (!bigB || bigA.m >= bigB.m) ? { ...bigA, t: A } : bigB ? { ...bigB, t: B } : null;
  setText("s-big", big ? `${big.t.abbr} +${big.m}` : "–");
  setText("s-big-l", big ? `biggest win (${big.g.season}${big.g.post ? " playoffs" : `, week ${big.g.week}`})` : "biggest win");
  const last = games[games.length - 1];
  if (last) {
    const s = sideOf(last, sel.a);
    const winner = s.margin > 0 ? A.abbr : s.margin < 0 ? B.abbr : "Tie";
    setText("s-last", `${winner} ${Math.max(last.hs, last.as)}–${Math.min(last.hs, last.as)}`);
    setText("s-last-l", `last meeting (${last.season}${last.post ? " playoffs" : `, week ${last.week}`})`);
  } else { setText("s-last", "–"); setText("s-last-l", "last meeting"); }

  // Margin chart
  mcharts.margin.data.labels = games.map((g) => `${g.season}${g.post ? " PO" : " W" + g.week}`);
  mcharts.margin.$labels = games.map((g) => {
    const s = sideOf(g, sel.a);
    const at = s.isHome ? `${B.abbr} at ${A.abbr}` : `${A.abbr} at ${B.abbr}`;
    return `${at}: ${A.abbr} ${s.pf}–${s.pa} ${B.abbr}`;
  });
  mcharts.margin.data.datasets[0].data = games.map((g) => sideOf(g, sel.a).margin);
  mcharts.margin.data.datasets[0].backgroundColor = games.map((g) => (sideOf(g, sel.a).margin >= 0 ? ca : cb));
  setText("t-margin", `Game-by-game margin (${A.abbr} points minus ${B.abbr} points)`);
  mcharts.margin.update();

  // Season form: each team's regular-season win % (against all teams)
  const form = (team) => M.seasons.map((season) => {
    if (season < sel.from || season > sel.to) return null;
    let w = 0, g = 0;
    M.games.forEach((x) => {
      if (x.season !== season || x.post || (x.home !== team && x.away !== team)) return;
      const s = sideOf(x, team);
      g++; w += s.margin > 0 ? 1 : s.margin === 0 ? 0.5 : 0;
    });
    return g ? (w / g) * 100 : null;
  });
  mcharts.form.data.labels = M.seasons;
  mcharts.form.data.datasets[0].label = A.abbr;
  mcharts.form.data.datasets[0].data = form(sel.a);
  mcharts.form.data.datasets[1].label = B.abbr;
  mcharts.form.data.datasets[1].data = form(sel.b);
  [ca, cb].forEach((c, i) => {
    mcharts.form.data.datasets[i].borderColor = c;
    mcharts.form.data.datasets[i].backgroundColor = c;
  });
  mcharts.form.update();

  // Game list (newest first)
  const rows = games.slice().reverse().map((g) => {
    const s = sideOf(g, sel.a);
    const winner = s.margin > 0 ? A.abbr : s.margin < 0 ? B.abbr : "Tie";
    const where = s.isHome ? `at ${A.abbr}` : `at ${B.abbr}`;
    return `<tr><td>${g.season}${g.post ? '<span class="pill">Playoffs</span>' : ""}</td><td>${g.post ? "Week " + g.week + " (playoffs)" : "Week " + g.week}</td><td>${where}</td>` +
      `<td class="${s.margin > 0 ? "win" : ""}">${s.pf}</td><td class="${s.margin < 0 ? "win" : ""}">${s.pa}</td><td>${winner}</td><td>${s.margin > 0 ? "+" : ""}${s.margin}</td></tr>`;
  }).join("");
  document.getElementById("games").innerHTML = n
    ? `<thead><tr><th>Season</th><th>Week</th><th>Where</th><th>${A.abbr}</th><th>${B.abbr}</th><th>Winner</th><th>${A.abbr} margin</th></tr></thead><tbody>${rows}</tbody>`
    : "";
  document.getElementById("no-games").hidden = n > 0;

  renderHeat();
}

// Darker version of a hex color, for card gradients
function shade(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 0.55));
  return `rgb(${r}, ${g}, ${b})`;
}

// Scoreboard digits count up to the new value
function bump(id, value) {
  const el = document.getElementById(id);
  const from = +el.textContent || 0;
  if (REDUCED_MOTION || from === value) { el.textContent = value; return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 600);
    el.textContent = Math.round(from + (value - from) * p);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- League grid ----------

function mix(c1, c2, t) {
  const [a, b] = [hexToRgb(c1), hexToRgb(c2)];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

function heatColor(p) {
  // 0% red -> 50% gray -> 100% blue (diverging, neutral midpoint)
  return p < 0.5 ? mix("#e34948", "#f0efec", p / 0.5) : mix("#f0efec", "#2a78d6", (p - 0.5) / 0.5);
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
      const isSel = (abbrs[r] === sel.a && abbrs[c] === sel.b);
      const txt = Math.abs(p - 0.5) > 0.3 ? "#fff" : "#0f1c2e";
      html += `<td class="${isSel ? "sel" : ""}" data-r="${abbrs[r]}" data-c="${abbrs[c]}" style="background:${heatColor(p)};color:${txt}" title="${abbrs[r]} vs ${abbrs[c]}: ${fmt.pct(p * 100)} in ${g[r][c]} game${g[r][c] > 1 ? "s" : ""}">${g[r][c]}</td>`;
    }
    html += "</tr>";
  }
  const table = document.getElementById("heat");
  table.innerHTML = html + "</tbody>";
  table.onclick = (e) => {
    const td = e.target.closest("td[data-r]");
    if (!td) return;
    sel.a = td.dataset.r; sel.b = td.dataset.c;
    update();
    document.querySelector(".scoreboard").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
  };
}
