// Shared chart settings for both pages (requires Chart.js loaded first).

const COLORS = {
  s1: "#2a78d6",   // blue   - first series
  s2: "#eb6834",   // orange - second series
  s3: "#1baf7a",   // aqua   - third series
  muted: "#b9c0ca",
  ink: "#0f1c2e",
  ink2: "#4a5566",
  grid: "#ebe8e1",
};

Chart.defaults.font.family = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = COLORS.ink2;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation.duration = 400;
Chart.defaults.scale.grid.color = COLORS.grid;
Chart.defaults.scale.border.display = false;
Chart.defaults.elements.line.borderWidth = 2;
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
Chart.defaults.plugins.tooltip.backgroundColor = "#0f1c2e";
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 4;
Chart.defaults.interaction = { mode: "index", intersect: false };

const fmt = {
  pct: (v, d = 1) => (v == null || isNaN(v) ? "–" : v.toFixed(d) + "%"),
  num: (v) => (v == null || isNaN(v) ? "–" : Math.round(v).toLocaleString("en-US")),
  dec: (v, d = 2) => (v == null || isNaN(v) ? "–" : v.toFixed(d)),
  signed: (v, d = 3) => (v == null || isNaN(v) ? "–" : (v > 0 ? "+" : "") + v.toFixed(d)),
};
