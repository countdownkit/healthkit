// Health calculator — live recompute + unit toggle. The inputs and an initial
// result are server-rendered (SEO + no-JS); this recomputes on every change and
// converts values when you flip Imperial <-> Metric. All math is in calc.js so
// server and client agree. Everything stays client-side — nothing is sent anywhere.
(function () {
  const C = window.CALC;
  if (!C) return;
  const form = document.querySelector("form.calc");
  const wrap = document.querySelector("[data-result-wrap]");
  if (!form || !wrap) return;
  const calc = C.CALCS[form.dataset.calc];
  if (!calc) return;

  // Read current display values out of the DOM into a {key: value} object.
  function readDisp() {
    const disp = {};
    form.querySelectorAll("[data-num]").forEach(el => { disp[el.dataset.num] = el.value; });
    const ft = form.querySelector("[data-h=ft]"), inn = form.querySelector("[data-h=in]"), cm = form.querySelector("[data-h=cm]");
    if (ft || cm) disp.height = { ft: ft && ft.value, in: inn && inn.value, cm: cm && cm.value };
    return disp;
  }

  function recompute() {
    const unit = form.dataset.unit;
    const metric = C.metricize(calc, readDisp(), unit);
    wrap.innerHTML = C.renderResult(calc, calc.compute(metric));
  }

  // Convert every unit-dependent field when the unit toggle flips.
  function setUnit(target) {
    const cur = form.dataset.unit;
    if (cur === target || (target !== "imperial" && target !== "metric")) return;
    const toMetric = target === "metric";

    form.querySelectorAll("[data-role=weight]").forEach(inp => {
      const n = parseFloat(inp.value);
      if (isFinite(n)) inp.value = C.r1(toMetric ? C.lbToKg(n) : C.kgToLb(n));
    });
    form.querySelectorAll("[data-role=girth]").forEach(inp => {
      const n = parseFloat(inp.value);
      if (isFinite(n)) inp.value = C.r1(toMetric ? C.inToCm(n) : C.cmToIn(n));
    });
    const ft = form.querySelector("[data-h=ft]"), inn = form.querySelector("[data-h=in]"), cm = form.querySelector("[data-h=cm]");
    if (cm) {
      if (toMetric) cm.value = C.r0(C.ftInToCm(parseFloat(ft.value) || 0, parseFloat(inn.value) || 0));
      else { const fi = C.cmToFtIn(parseFloat(cm.value) || 0); ft.value = fi.ft; inn.value = fi.in; }
    }
    form.querySelectorAll(".u-lbl[data-imp]").forEach(s => { s.textContent = target === "imperial" ? s.dataset.imp : s.dataset.met; });

    form.dataset.unit = target;
    form.querySelectorAll(".unit-toggle button").forEach(b => b.classList.toggle("active", b.dataset.unit === target));
    recompute();
  }

  form.addEventListener("input", recompute);
  form.addEventListener("change", recompute);
  const toggle = form.querySelector(".unit-toggle");
  if (toggle) toggle.addEventListener("click", e => {
    const btn = e.target.closest("button[data-unit]");
    if (btn) setUnit(btn.dataset.unit);
  });

  recompute();
})();
