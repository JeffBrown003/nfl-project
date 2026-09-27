// Dashboard: loads data/dashboard.json (made by scripts/build_dashboard_data.py),
// filters the plays in the browser, and redraws the numbers, charts and table.

const DEFAULTS = {
  season: "all", stype: "reg", team: "all", ptype: "scrim",
  down: "all", qtr: "all", home: "all",
  measure: "succ", breakdown: "season",
};
const state = { ...DEFAULTS };

const MEASURES = {
  count: { label: "Plays", value: (a) => a.n, format: (v) => fmt.num(v) },
  yds: { label: "Yards per play", value: (a) => a.yds / a.n, format: (v) => fmt.dec(v, 2) },
  epa: { label: "EPA per play", value: (a) => a.epa / 1000 / a.n, format: (v) => fmt.signed(v, 3) },
  succ: { label: "Success rate", value: (a) => (a.succ / a.n) * 100, format: (v) => fmt.pct(v) },
  td: { label: "Touchdown rate", value: (a) => (a.td / a.n) * 100, format: (v) => fmt.pct(v, 2) },
  to: { label: "Turnover rate", value: (a) => (a.to / a.n) * 100, format: (v) => fmt.pct(v, 2) },
};

const PTYPE_LABELS = ["Pass", "Run", "Punt", "Field goal", "Extra point", "Kickoff", "Two-point"];
const BREAKDOWNS = {
  season: { label: "season", name: (k) => String(k) },
  team: { label: "team", name: (k) => DATA.teams[k] },
  ptype: { label: "play type", name: (k) => PTYPE_LABELS[k] },
  down: { label: "down", name: (k) => (k === 0 ? "No down" : ["", "1st", "2nd", "3rd", "4th"][k]) },
  qtr: { label: "quarter", name: (k) => (k === 5 ? "OT" : ["", "Q1", "Q2", "Q3", "Q4"][k]) },
  home: { label: "home / away", name: (k) => (k === 1 ? "Home" : "Away") },
};

let DATA = null;   // { teams, rows, cols: {season, post, team, ...} as typed arrays }
const charts = {};

// ---------- Loading ----------

fetch("data/dashboard.json")
  .then((r) => r.json())
  .then((raw) => {
    const c = raw.cols;
    DATA = {
      teams: raw.teams,
      rows: raw.rows,
      season: Int16Array.from(c.season),
      post: Int8Array.from(c.post),
      team: Int8Array.from(c.team),
      home: Int8Array.from(c.home),
      qtr: Int8Array.from(c.qtr),
      down: Int8Array.from(c.down),
      dist: Int8Array.from(c.dist),
      ptype: Int8Array.from(c.ptype),
      dec: Int8Array.from(c.dec),
      yds: Int16Array.from(c.yds),
      epa: Int16Array.from(c.epa),
      succ: Int8Array.from(c.succ),
      td: Int8Array.from(c.td),
      to: Int8Array.from(c.to),
    };
    buildControls();
    buildCharts();
    document.getElementById("loading").hidden = true;
    document.getElementById("dash").hidden = false;
    render();
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("loading").textContent = "The data could not be loaded. Please refresh the page.";
  });

// ---------- Controls ----------

function buildControls() {
  const seasons = [...new Set(DATA.season)].sort();
  const seasonSel = document.getElementById("f-season");
  seasonSel.innerHTML = '<option value="all">All seasons</option>' +
    seasons.map((s) => `<option value="${s}">${s}</option>`).join("");
  const teamSel = document.getElementById("f-team");
  teamSel.innerHTML = '<option value="all">All teams</option>' +
    DATA.teams.map((t, i) => `<option value="${i}">${t}</option>`).join("");

  for (const key of ["season", "stype", "team", "ptype", "down", "qtr", "home"]) {
    document.getElementById("f-" + key).addEventListener("change", (e) => {
      state[key] = e.target.value;
      render();
    });
  }
  for (const [id, key] of [["sw-measure", "measure"], ["sw-break", "breakdown"]]) {
    document.getElementById(id).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      state[key] = b.dataset.v;
      render();
    });
  }
  document.getElementById("reset").addEventListener("click", () => {
    Object.assign(state, DEFAULTS);
    render();
  });
}

function syncControls() {
  for (const key of ["season", "stype", "team", "ptype", "down", "qtr", "home"]) {
    document.getElementById("f-" + key).value = state[key];
  }
  for (const [id, key] of [["sw-measure", "measure"], ["sw-break", "breakdown"]]) {
    document.querySelectorAll(`#${id} button`).forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.v === state[key]));
    });
  }
}

// ---------- Aggregation ----------

function emptyAcc() {
  return { n: 0, yds: 0, epa: 0, succ: 0, td: 0, to: 0, pass: 0, run: 0, go: 0, punt: 0, fg: 0 };
}

function add(acc, i) {
  acc.n++;
  acc.yds += DATA.yds[i];
  acc.epa += DATA.epa[i];
  acc.succ += DATA.succ[i];
  acc.td += DATA.td[i];
  acc.to += DATA.to[i];
}

function aggregate() {
  const s = state;
  const season = s.season === "all" ? null : +s.season;
  const team = s.team === "all" ? null : +s.team;
  const down = s.down === "all" ? null : +s.down;
  const qtr = s.qtr === "all" ? null : +s.qtr;
  const home = s.home === "all" ? null : +s.home;
  const ptype = s.ptype === "all" || s.ptype === "scrim" ? null : +s.ptype;
  const keyCol = DATA[s.breakdown];

  const total = emptyAcc();          // all filters
  const groups = new Map();          // all filters, by breakdown
  const fourth = new Map();          // ignores play type + down, by breakdown
  const split = new Map();           // ignores play type, pass/run by breakdown
  const trend = new Map();           // ignores play type, pass/run by season
  const fourthTotal = emptyAcc();
  const splitTotal = emptyAcc();

  const get = (map, k) => {
    let a = map.get(k);
    if (!a) { a = { all: emptyAcc(), pass: emptyAcc(), run: emptyAcc() }; map.set(k, a); }
    return a;
  };

  for (let i = 0; i < DATA.rows; i++) {
    // filters that apply to everything
    if (season !== null && DATA.season[i] !== season) continue;
    if (s.stype === "reg" && DATA.post[i] === 1) continue;
    if (s.stype === "post" && DATA.post[i] === 0) continue;
    if (team !== null && DATA.team[i] !== team) continue;
    if (qtr !== null && DATA.qtr[i] !== qtr) continue;
    if (home !== null && DATA.home[i] !== home) continue;

    const k = keyCol[i];
    const pt = DATA.ptype[i];

    const dec = DATA.dec[i];
    if (dec >= 0) {
      const f = get(fourth, k).all;
      if (dec === 0) { f.go++; fourthTotal.go++; }
      else if (dec === 1) { f.punt++; fourthTotal.punt++; }
      else { f.fg++; fourthTotal.fg++; }
    }

    if (down !== null && DATA.down[i] !== down) continue;

    if (pt === 0 || pt === 1) {
      const side = pt === 0 ? "pass" : "run";
      add(get(split, k)[side], i);
      add(get(trend, DATA.season[i])[side], i);
      splitTotal[side]++;
    }

    if (ptype !== null && pt !== ptype) continue;
    if (s.ptype === "scrim" && pt > 1) continue;

    add(total, i);
    add(get(groups, k).all, i);
  }
  return { total, groups, fourth, split, trend, fourthTotal, splitTotal };
}

function goRate(a) {
  const d = a.go + a.punt + a.fg;
  return d ? (a.go / d) * 100 : NaN;
}

function sortedKeys(map, valueOf) {
  const keys = [...map.keys()];
  if (state.breakdown === "team") {
    return keys.sort((x, y) => (valueOf(y) || 0) - (valueOf(x) || 0));
  }
  return keys.sort((x, y) => x - y);
}

// ---------- Charts ----------

function buildCharts() {
  const tooltipFmt = (c) => ` ${c.dataset.label}: ${MEASURES[state.measure].format(c.parsed.y)}`;
  const yTicks = { callback: (v) => MEASURES[state.measure].format(v) };

  charts.main = new Chart(document.getElementById("c-main"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "", data: [], backgroundColor: COLORS.s1, maxBarThickness: 40 }] },
    options: { scales: { y: { ticks: yTicks }, x: { grid: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipFmt } } } },
  });

  const line = (label, color) => ({ label, data: [], borderColor: color, backgroundColor: color, pointBorderColor: "#fcfcfb", pointBorderWidth: 2 });
  charts.trend = new Chart(document.getElementById("c-trend"), {
    type: "line",
    data: { labels: [], datasets: [line("Pass", COLORS.s1), line("Run", COLORS.s2)] },
    options: { scales: { y: { ticks: yTicks } }, plugins: { tooltip: { callbacks: { label: tooltipFmt } } } },
  });

  const bar = (label, color) => ({ label, data: [], backgroundColor: color, borderColor: "#fcfcfb", borderWidth: 2, borderSkipped: false, maxBarThickness: 40 });
  charts.fourth = new Chart(document.getElementById("c-fourth"), {
    type: "bar",
    data: { labels: [], datasets: [bar("Go for it", COLORS.s2), bar("Field goal", COLORS.s1), bar("Punt", COLORS.muted)] },
    options: {
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, min: 0, max: 100, ticks: { callback: (v) => v + "%" } } },
      plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt.pct(c.parsed.y)}` } } },
    },
  });

  charts.split = new Chart(document.getElementById("c-split"), {
    type: "bar",
    data: { labels: [], datasets: [bar("Pass", COLORS.s1), bar("Run", COLORS.s2)] },
    options: { scales: { y: { ticks: yTicks }, x: { grid: { display: false } } },
      plugins: { tooltip: { callbacks: { label: tooltipFmt } } } },
  });
}

function setText(id, text) { document.getElementById(id).textContent = text; }

function render() {
  syncControls();
  const r = aggregate();
  const m = MEASURES[state.measure];
  const bd = BREAKDOWNS[state.breakdown];
  const val = (a) => (a && a.n ? m.value(a) : NaN);

  // Summary numbers
  const t = r.total;
  setText("k-plays", fmt.num(t.n));
  setText("k-yds", t.n ? fmt.dec(t.yds / t.n, 2) : "–");
  setText("k-epa", t.n ? fmt.signed(t.epa / 1000 / t.n, 3) : "–");
  setText("k-succ", t.n ? fmt.pct((t.succ / t.n) * 100) : "–");
  const sp = r.splitTotal.pass + r.splitTotal.run;
  setText("k-pass", sp ? fmt.pct((r.splitTotal.pass / sp) * 100) : "–");
  setText("k-go", fmt.pct(goRate(r.fourthTotal)));

  // Chart 1: measure by breakdown
  const keys = sortedKeys(r.groups, (k) => val(r.groups.get(k).all));
  setText("t-main", `${m.label} by ${bd.label}`);
  charts.main.data.labels = keys.map(bd.name);
  charts.main.data.datasets[0].label = m.label;
  charts.main.data.datasets[0].data = keys.map((k) => val(r.groups.get(k).all));
  charts.main.update();

  // Chart 2: pass vs run trend by season
  const seasons = [...r.trend.keys()].sort((a, b) => a - b);
  setText("t-trend", `${m.label} over time: pass vs. run`);
  charts.trend.data.labels = seasons;
  charts.trend.data.datasets[0].data = seasons.map((s) => val(r.trend.get(s).pass));
  charts.trend.data.datasets[1].data = seasons.map((s) => val(r.trend.get(s).run));
  charts.trend.update();

  // Chart 3: 4th-down decision mix by breakdown
  const fk = sortedKeys(r.fourth, (k) => goRate(r.fourth.get(k).all));
  setText("t-fourth", `4th-down decisions by ${bd.label}`);
  charts.fourth.data.labels = fk.map(bd.name);
  const share = (a, f) => { const d = a.go + a.punt + a.fg; return d ? (a[f] / d) * 100 : NaN; };
  charts.fourth.data.datasets[0].data = fk.map((k) => share(r.fourth.get(k).all, "go"));
  charts.fourth.data.datasets[1].data = fk.map((k) => share(r.fourth.get(k).all, "fg"));
  charts.fourth.data.datasets[2].data = fk.map((k) => share(r.fourth.get(k).all, "punt"));
  charts.fourth.update();

  // Chart 4: pass vs run by breakdown
  const sk = sortedKeys(r.split, (k) => val(r.split.get(k).pass));
  setText("t-split", `${m.label} by ${bd.label}: pass vs. run`);
  charts.split.data.labels = sk.map(bd.name);
  charts.split.data.datasets[0].data = sk.map((k) => val(r.split.get(k).pass));
  charts.split.data.datasets[1].data = sk.map((k) => val(r.split.get(k).run));
  charts.split.update();

  renderTable(r, keys, bd);
}

function renderTable(r, keys, bd) {
  const row = (name, a, f, cls = "") => {
    const n = a ? a.n : 0;
    const cell = (v) => `<td>${v}</td>`;
    return `<tr${cls}><td>${name}</td>` +
      cell(fmt.num(n)) +
      cell(n ? fmt.dec(a.yds / n, 2) : "–") +
      cell(n ? fmt.signed(a.epa / 1000 / n, 3) : "–") +
      cell(n ? fmt.pct((a.succ / n) * 100) : "–") +
      cell(n ? fmt.pct((a.td / n) * 100, 2) : "–") +
      cell(n ? fmt.pct((a.to / n) * 100, 2) : "–") +
      cell(f ? fmt.pct(goRate(f)) : "–") + "</tr>";
  };
  const head = `<thead><tr><th>${bd.label[0].toUpperCase() + bd.label.slice(1)}</th><th>Plays</th><th>Yards/play</th><th>EPA/play</th><th>Success</th><th>TD rate</th><th>Turnover rate</th><th>4th-down go rate</th></tr></thead>`;
  const body = keys.map((k) => row(bd.name(k), r.groups.get(k).all, r.fourth.has(k) ? r.fourth.get(k).all : null)).join("");
  const foot = row("<strong>All</strong>", r.total, r.fourthTotal, ' style="font-weight:600;background:#f1efe9"');
  document.getElementById("table").innerHTML = head + `<tbody>${body}${foot}</tbody>`;
  setText("t-table", `Numbers behind the current view, by ${bd.label}`);
}
