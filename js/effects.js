// Page effects shared by every page: scroll progress bar, reveal-on-scroll,
// count-up numbers, and a helper that runs code the first time an element is seen.
// Everything is skipped for readers who ask their system for reduced motion.

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Run fn(el) once, the first time el scrolls into view.
function onVisible(el, fn, margin = "0px 0px -10% 0px") {
  if (!el) return;
  if (REDUCED_MOTION || !("IntersectionObserver" in window)) { fn(el); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { io.disconnect(); fn(el); }
    });
  }, { rootMargin: margin });
  io.observe(el);
}

// Animate a number from 0 to its final text, keeping commas, decimals and % sign.
function countUp(el) {
  const text = el.dataset.final || el.textContent.trim();
  el.dataset.final = text;
  const match = text.match(/^([^\d\-+]*)([\-+]?[\d,]*\.?\d+)(.*)$/);
  if (!match || REDUCED_MOTION) { el.textContent = text; return; }
  const [, pre, numStr, post] = match;
  const target = parseFloat(numStr.replace(/,/g, ""));
  const decimals = (numStr.split(".")[1] || "").length;
  const commas = numStr.includes(",");
  const duration = 1400;
  const t0 = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    let v = (target * eased).toFixed(decimals);
    if (commas) v = Number(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    el.textContent = pre + v + post;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.addEventListener("DOMContentLoaded", () => {
  // Scroll progress ("first-down line") under the nav bar
  const bar = document.querySelector(".progress");
  if (bar) {
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? window.scrollY / h : 0})`;
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  // Reveal blocks as they scroll in
  document.querySelectorAll(".reveal").forEach((el) => {
    if (REDUCED_MOTION) { el.classList.add("in"); return; }
    onVisible(el, () => el.classList.add("in"), "0px 0px -8% 0px");
  });

  // Count-up numbers
  document.querySelectorAll("[data-count]").forEach((el) => onVisible(el, countUp));

  // Nav bar gets a solid shadow once the page scrolls
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
});
