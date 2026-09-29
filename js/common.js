// Shared chart settings for every page (requires Chart.js loaded first).
// Charts sit on dark "jumbotron" screens, so the colors are the bright dark-mode steps
// and every line and bar gets a soft LED glow.

const COLORS = {
  s1: "#3987e5",   // blue   - first series
  s2: "#ff7a45",   // orange - second series
  s3: "#1fc98a",   // aqua   - third series
  muted: "#5b6472",
  ink: "#e6ebf2",  // text and reference lines on the dark screens
  ink2: "#9aa5b4",
  grid: "#1b1f25",
};

Chart.defaults.font.family = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = COLORS.ink2;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation.duration = 400;
Chart.defaults.scale.grid.color = COLORS.grid;
Chart.defaults.scale.border.display = false;
Chart.defaults.elements.line.borderWidth = 2.5;
Chart.defaults.elements.line.tension = 0;
Chart.defaults.elements.point.radius = 3;
Chart.defaults.elements.point.hoverRadius = 6;
Chart.defaults.elements.point.hitRadius = 12;
Chart.defaults.elements.bar.borderRadius = 4;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.boxHeight = 8;
Chart.defaults.plugins.legend.labels.color = COLORS.ink;
Chart.defaults.plugins.legend.align = "start";
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(8, 10, 14, 0.96)";
Chart.defaults.plugins.tooltip.borderColor = "#3a3f47";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = "#ffb000";
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 4;
Chart.defaults.interaction = { mode: "index", intersect: false };

// Soft LED glow behind every dataset
Chart.register({
  id: "ledGlow",
  beforeDatasetDraw(chart, args) {
    const ds = chart.data.datasets[args.index];
    let c = ds.borderColor && ds.type !== "bar" && chart.config.type === "line" ? ds.borderColor : ds.backgroundColor;
    if (Array.isArray(c)) c = c.find((x) => x !== COLORS.muted) || c[0];
    const ctx = chart.ctx;
    ctx.save();
    ctx.shadowColor = typeof c === "string" ? c : "transparent";
    ctx.shadowBlur = chart.config.type === "line" ? 12 : 10;
  },
  afterDatasetDraw(chart) { chart.ctx.restore(); },
});

const fmt = {
  pct: (v, d = 1) => (v == null || isNaN(v) ? "–" : v.toFixed(d) + "%"),
  num: (v) => (v == null || isNaN(v) ? "–" : Math.round(v).toLocaleString("en-US")),
  dec: (v, d = 2) => (v == null || isNaN(v) ? "–" : v.toFixed(d)),
  signed: (v, d = 3) => (v == null || isNaN(v) ? "–" : (v > 0 ? "+" : "") + v.toFixed(d)),
};
