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
  return { label, data, borderColor: color, backgroundColor: color, pointBorderColor: "#fcfcfb", pointBorderWidth: 2 };
}

fetch("data/findings.json")
  .then((r) => r.json())
  .then((d) => {
    const seasons = d.seasons;

    // 1. Go rate
    new Chart(document.getElementById("chart-go"), {
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
    new Chart(document.getElementById("chart-conv"), {
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
    new Chart(document.getElementById("chart-top"), {
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
    new Chart(document.getElementById("chart-win"), {
      type: "bar",
      data: {
        labels: d.win.labels,
        datasets: [
          { label: "Grouped by all 4th downs", data: d.win.all_4th_downs, backgroundColor: COLORS.muted, maxBarThickness: 40 },
          { label: "Grouped by \"choice\" 4th downs", data: d.win.choice_4th_downs, backgroundColor: COLORS.s1, maxBarThickness: 40 },
        ],
      },
      options: {
        datasets: { bar: { borderColor: "#fcfcfb", borderWidth: 2, borderSkipped: "bottom" } },
        scales: { y: pctAxis({ min: 30, max: 60 }), x: { grid: { display: false } } },
        plugins: { tooltip: pctTooltip() },
      },
    });

    // 5. Pass vs run success
    new Chart(document.getElementById("chart-passrun"), {
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
    new Chart(document.getElementById("chart-two"), {
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
    new Chart(document.getElementById("chart-fg"), {
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
    new Chart(document.getElementById("chart-ko"), {
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
    new Chart(document.getElementById("chart-home"), {
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
