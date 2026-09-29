// Draws the report charts from data/findings.json (made by scripts/analyze.py).

function seasonSeries(obj, seasons) {
  return seasons.map((s) => obj[s]);
}

function pctAxis(extra = {}) {
  return { ticks: { callback: (v) => v + "%" }, ...extra };
}

function pctTooltip(digits = 1) {
  return { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(digits)}%` } };
}

function lineSet(label, data, color) {
  return { label, data, borderColor: color, backgroundColor: color, pointBorderColor: "#020203", pointBorderWidth: 2 };
}

// Build a chart the first time its card scrolls into view, so it animates in.
function lazyChart(id, config) {
  const canvas = document.getElementById(id);
  onVisible(canvas.closest(".chart-card"), () => {
    config.options = config.options || {};
    config.options.animation = { duration: 1200, easing: "easeOutQuart" };
    new Chart(canvas, config);
  }, "0px 0px -15% 0px");
}

fetch("data/findings.json")
  .then((r) => r.json())
  .then((d) => {
    const seasons = d.seasons;
    buildChips(d);

    // 1. Go rate
    lazyChart("chart-go", {
      type: "line",
      data: {
        labels: seasons,
        datasets: [
          lineSet("4th and 2 or less", seasonSeries(d.go_rate.short, seasons), COLORS.s2),
          lineSet("All 4th downs", seasonSeries(d.go_rate.all, seasons), COLORS.s1),
        ],
      },
      options: { scales: { y: pctAxis({ min: 0, max: 70 }) }, plugins: { tooltip: pctTooltip() } },
    });

    // 2. Conversion by distance
    const dist = d.conversion.by_distance;
    const distKeys = Object.keys(dist);
    lazyChart("chart-conv", {
      type: "bar",
      data: {
        labels: distKeys.map((k) => (k === "1" ? "1 yard" : k + " yards")),
        datasets: [{ label: "Conversion rate", data: distKeys.map((k) => dist[k].rate), backgroundColor: COLORS.s1, maxBarThickness: 56 }],
      },
      options: {
        scales: { y: pctAxis({ min: 0, max: 80 }), x: { grid: { display: false } } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.parsed.y.toFixed(1)}% converted (${dist[distKeys[c.dataIndex]].attempts.toLocaleString()} attempts)` } },
        },
      },
    });

    // 3. Top team-seasons (Detroit highlighted)
    const top = d.aggressive.top_team_seasons;
    lazyChart("chart-top", {
      type: "bar",
      data: {
        labels: top.map((t) => `${t.season} ${t.team}`),
        datasets: [{
          label: "Go rate",
          data: top.map((t) => t.go_rate),
          backgroundColor: top.map((t) => (t.team === "DET" ? COLORS.s1 : COLORS.muted)),
          maxBarThickness: 22,
        }],
      },
      options: {
        indexAxis: "y",
        interaction: { mode: "nearest", axis: "y", intersect: false },
        scales: { x: pctAxis({ min: 0, max: 40 }), y: { grid: { display: false } } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const t = top[c.dataIndex];
                return [` Go rate: ${t.go_rate.toFixed(1)}%`, ` Attempts: ${t.attempts}`, ` Coach: ${t.coach}`];
              },
            },
          },
        },
      },
    });

    // 4. Aggressiveness vs winning
    lazyChart("chart-win", {
      type: "bar",
      data: {
        labels: d.win.labels,
        datasets: [
          { label: "Grouped by all 4th downs", data: d.win.all_4th_downs, backgroundColor: COLORS.muted, maxBarThickness: 40 },
          { label: "Grouped by \"choice\" 4th downs", data: d.win.choice_4th_downs, backgroundColor: COLORS.s1, maxBarThickness: 40 },
        ],
      },
      options: {
        datasets: { bar: { borderColor: "#020203", borderWidth: 2, borderSkipped: "bottom" } },
        scales: { y: pctAxis({ min: 30, max: 60 }), x: { grid: { display: false } } },
        plugins: { tooltip: pctTooltip() },
      },
    });

    // 5. Pass vs run success
    lazyChart("chart-passrun", {
      type: "line",
      data: {
        labels: seasons,
        datasets: [
          lineSet("Pass", seasonSeries(d.pass_run.success_pass, seasons), COLORS.s1),
          lineSet("Run", seasonSeries(d.pass_run.success_run, seasons), COLORS.s2),
        ],
      },
      options: { scales: { y: pctAxis({ min: 36, max: 50 }) }, plugins: { tooltip: pctTooltip() } },
    });

    // 6. Two-point vs extra point
    lazyChart("chart-two", {
      type: "line",
      data: {
        labels: seasons,
        datasets: [
          lineSet("Two-point try", seasonSeries(d.two_point.points_two, seasons), COLORS.s2),
          lineSet("Extra point", seasonSeries(d.two_point.points_xp, seasons), COLORS.s1),
        ],
      },
      options: {
        scales: { y: { min: 0.7, max: 1.15, ticks: { callback: (v) => v.toFixed(2) } } },
        plugins: {
          tooltip: {
            callbacks: {
              label: (c) => {
                const s = seasons[c.dataIndex];
                return c.datasetIndex === 0
                  ? ` Two-point: ${c.parsed.y.toFixed(2)} pts (${d.two_point.success[s]}% of ${d.two_point.attempts[s]} tries)`
                  : ` Extra point: ${c.parsed.y.toFixed(2)} pts (${d.two_point.xp_made[s]}% made)`;
              },
            },
          },
        },
      },
    });

    // 7. Field goals by distance
    lazyChart("chart-fg", {
      type: "line",
      data: {
        labels: seasons,
        datasets: [
          lineSet("Under 40 yards", seasonSeries(d.kicking.under40_made, seasons), COLORS.s3),
          lineSet("40–49 yards", seasonSeries(d.kicking["40s_made"], seasons), COLORS.s1),
          lineSet("50+ yards", seasonSeries(d.kicking.long_made, seasons), COLORS.s2),
        ],
      },
      options: {
        scales: { y: pctAxis({ min: 50, max: 100 }) },
        plugins: {
          tooltip: {
            callbacks: {
              label: (c) => {
                const extra = c.datasetIndex === 2 ? ` (${d.kicking.long_attempts[seasons[c.dataIndex]]} attempts)` : "";
                return ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%${extra}`;
              },
            },
          },
        },
      },
    });

    // 8. Kickoffs
    lazyChart("chart-ko", {
      type: "line",
      data: {
        labels: seasons,
        datasets: [
          lineSet("Returned", seasonSeries(d.kickoff.return_rate, seasons), COLORS.s1),
          lineSet("Touchback", seasonSeries(d.kickoff.touchback_rate, seasons), COLORS.s2),
        ],
      },
      options: { scales: { y: pctAxis({ min: 0, max: 100 }) }, plugins: { tooltip: pctTooltip() } },
    });

    // 9. Home win %
    const homeVals = seasonSeries(d.home.win_pct, seasons);
    lazyChart("chart-home", {
      type: "bar",
      data: {
        labels: seasons,
        datasets: [{
          label: "Home win %",
          data: homeVals,
          backgroundColor: seasons.map((s) => (s === 2019 || s === 2020 ? COLORS.s2 : COLORS.s1)),
          maxBarThickness: 36,
        }],
      },
      options: {
        scales: { y: pctAxis({ min: 40, max: 65 }), x: { grid: { display: false } } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const s = seasons[c.dataIndex];
                const m = d.home.margin[s];
                return [` Home win %: ${c.parsed.y.toFixed(1)}%`, ` Avg home margin: ${m > 0 ? "+" : ""}${m.toFixed(2)} pts`];
              },
            },
          },
        },
      },
      plugins: [{
        // 50% reference line = no home advantage
        id: "even",
        afterDraw(chart) {
          const { ctx, chartArea, scales } = chart;
          const y = scales.y.getPixelForValue(50);
          ctx.save();
          ctx.strokeStyle = COLORS.ink;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();
          ctx.fillStyle = COLORS.ink;
          ctx.font = "11px Inter, sans-serif";
          ctx.textAlign = "right";
          ctx.fillText("50% = no advantage", chartArea.right, y + 14);
          ctx.restore();
        },
      }],
    });
  })
  .catch((err) => {
    console.error(err);
    document.querySelectorAll(".chart-box").forEach((b) => {
      b.innerHTML = '<p class="note">Chart data could not be loaded.</p>';
    });
  });

// =====================================================================
// Scoreboard extras: kickoff countdown, LED ticker, headline board,
// LED readouts for each finding, and the drive-chart rail.
// =====================================================================

const AMBER = "#ffb000";
const GREEN = "#4ade80";
const RED = "#ff5c5c";

// 3-2-1 kickoff on an LED board, once per visit
(function kickoff() {
  const overlay = document.getElementById("kickoff");
  if (!overlay || overlay.classList.contains("gone")) return;
  const led = new LEDDisplay(document.getElementById("led-kickoff"), { cols: 47, pad: 2, color: AMBER });
  const steps = [["3", AMBER], ["2", AMBER], ["1", AMBER], ["KICKOFF", "#ff7a45"]];
  let i = 0;
  const next = () => {
    if (overlay.classList.contains("gone")) return done();
    if (i >= steps.length) return setTimeout(done, 350);
    led.set(steps[i][0], { color: steps[i][1] });
    i++;
    setTimeout(next, i === steps.length ? 700 : 480);
  };
  const done = () => {
    overlay.classList.add("gone");
    try { sessionStorage.setItem("kickoff-seen", "1"); } catch (e) {}
  };
  setTimeout(next, 150);
})();

// LED ticker along the bottom of the hero
(function ticker() {
  const canvas = document.getElementById("led-ticker");
  if (!canvas) return;
  const led = new LEDDisplay(canvas, { cols: 200, scroll: true, speed: 20, pad: 1 });
  const S = "     *     ";
  led.set([
    ["4TH-DOWN GO RATE ", AMBER], ["23.3%", "#ffffff"], [" +10.5 PTS SINCE 2016", GREEN], [S, AMBER],
    ["4TH & 1 CONVERSION ", AMBER], ["67.1%", "#ffffff"], [S, AMBER],
    ["DET 2023 GO RATE ", AMBER], ["33.9%", "#ffffff"], [" #1 OF 320", GREEN], [S, AMBER],
    ["PASS-RUN SUCCESS GAP ", AMBER], ["1.7 PTS", "#ffffff"], [" FROM 5.8", RED], [S, AMBER],
    ["2-PT TRY ", AMBER], ["0.94 PTS", "#ffffff"], [" = EXTRA POINT ", AMBER], ["0.94 PTS", "#ffffff"], [S, AMBER],
    ["50+ YD FG ", AMBER], ["68.8%", "#ffffff"], [" FROM 56.7%", GREEN], [S, AMBER],
    ["KICKOFFS RETURNED ", AMBER], ["74.4%", "#ffffff"], [" FROM 25.2%", GREEN], [S, AMBER],
    ["HOME WIN % ", AMBER], ["54.2%", "#ffffff"], [" FROM 58.2%", RED], [S, AMBER],
  ]);
})();

// Headline numbers: scramble onto the board when it scrolls into view
document.querySelectorAll(".headline-board canvas[data-led]").forEach((c) => {
  const led = new LEDDisplay(c, { cols: 41, pad: 1, color: AMBER });
  led.set("-------");
  onVisible(c, () => led.set(c.dataset.led, { scramble: true }));
});

// LED readouts beside each finding, read straight from findings.json
function buildChips(d) {
  const p = (v) => v.toFixed(1) + "%";
  const gap = (y) => (d.pass_run.success_pass[y] - d.pass_run.success_run[y]).toFixed(1);
  const top = d.aggressive.top_team_seasons[0];
  const chips = {
    f1: [["2016 go rate", p(d.go_rate.all[2016])], ["2025 go rate", p(d.go_rate.all[2025])], ["4th & 2-, 2025", p(d.go_rate.short[2025])]],
    f2: [["4th & 1", p(d.conversion.by_distance["1"].rate)], ["All attempts", p(d.conversion.overall)], ["11+ yards", p(d.conversion.by_distance["11+"].rate)]],
    f3: [[`${top.season} ${top.team}`, p(top.go_rate)], ["PHI 10 years", p(d.aggressive.teams_all_years.PHI)], ["SEA 10 years", p(d.aggressive.teams_all_years.SEA)]],
    f4: [["Least aggressive", p(d.win.choice_4th_downs[0])], ["Most aggressive", p(d.win.choice_4th_downs[3])]],
    f5: [["Gap 2016 (pts)", gap(2016)], ["Gap 2025 (pts)", gap(2025)], ["Pass rate 2025", p(d.pass_run.pass_rate[2025])]],
    f6: [["Two-point try", (d.two_point.overall_two * 2 / 100).toFixed(2)], ["Extra point", (d.two_point.overall_xp / 100).toFixed(2)]],
    f7: [["50+ yds 2016", p(d.kicking.long_made[2016])], ["50+ yds 2025", p(d.kicking.long_made[2025])], ["50+ tries 2025", String(d.kicking.long_attempts[2025])]],
    f8: [["Returned 2023", p(d.kickoff.return_rate[2023])], ["Returned 2025", p(d.kickoff.return_rate[2025])], ["Touchbacks 2025", p(d.kickoff.touchback_rate[2025])]],
    f9: [["Home win 2018", p(d.home.win_pct[2018])], ["Home win 2020", p(d.home.win_pct[2020])], ["2023-2025", p(d.home.last3)]],
  };
  document.querySelectorAll(".led-chips[data-chips]").forEach((box) => {
    const list = chips[box.dataset.chips] || [];
    box.innerHTML = list.map(([label]) => `<div class="led-chip"><div class="paint">${label}</div><canvas class="led"></canvas></div>`).join("");
    box.querySelectorAll("canvas").forEach((c, i) => {
      const led = new LEDDisplay(c, { cols: 35, pad: 1, color: AMBER });
      led.set("-----");
      onVisible(box, () => setTimeout(() => led.set(list[i][1], { scramble: true }), i * 180));
    });
  });
}

// Drive chart: a football moves down a mini field as you read the findings
(function drive() {
  const rail = document.getElementById("drive");
  if (!rail) return;
  const slides = [...document.querySelectorAll(".slide[id^='f']")];
  const names = [...document.querySelectorAll(".toc li a")].map((a) => a.textContent);
  const pos = (i) => 12 + (i / (slides.length - 1)) * 76;   // % from the top, inside the end zones
  rail.innerHTML = slides.map((s, i) =>
    `<button type="button" style="top:${pos(i)}%" data-i="${i}" aria-label="Finding ${i + 1}: ${names[i] || ""}">${i + 1}<span>${i + 1} &middot; ${names[i] || ""}</span></button>`
  ).join("") +
    `<svg class="ball" viewBox="0 0 64 40" aria-hidden="true" style="top:${pos(0)}%"><ellipse cx="32" cy="20" rx="30" ry="18" fill="#8b4513" stroke="#5a2d0c" stroke-width="2"/><path d="M20 20h24M24 16v8M29 16v8M34 16v8M39 16v8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
  const ball = rail.querySelector(".ball");
  const buttons = [...rail.querySelectorAll("button")];
  rail.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) slides[+b.dataset.i].scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth" });
  });
  const hero = document.querySelector(".hero");
  const update = () => {
    const mid = window.innerHeight * 0.45;
    let current = -1;
    slides.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) current = i; });
    rail.classList.toggle("show", hero.getBoundingClientRect().bottom < 0);
    const i = Math.max(0, current);
    ball.style.top = pos(i) + "%";
    buttons.forEach((b, k) => b.classList.toggle("done", k <= current));
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
})();
