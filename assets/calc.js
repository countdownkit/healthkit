/*
 * Shared health-calculator engine — used by BOTH generate.js (Node, server render)
 * and tool.js (browser, live recompute) so server + client output match exactly.
 * UMD-ish: module.exports under Node, window.CALC in the browser.
 *
 * All math runs in METRIC internally (kg, cm). The unit toggle only changes how
 * numbers are displayed/entered; metricize() normalizes display values -> metric.
 * Formulas are the standard published ones (Mifflin-St Jeor, US Navy body fat,
 * Devine/Robinson ideal weight, MET energy expenditure). Estimates, not diagnoses.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CALC = factory();
})(typeof self !== "undefined" ? self : this, function () {

  // ---- unit conversion ---------------------------------------------------
  const KG_PER_LB = 0.45359237;
  const lbToKg = lb => lb * KG_PER_LB;
  const kgToLb = kg => kg / KG_PER_LB;
  const inToCm = i => i * 2.54;
  const cmToIn = c => c / 2.54;
  const ftInToCm = (ft, i) => ((ft || 0) * 12 + (i || 0)) * 2.54;
  function cmToFtIn(cm) {
    const totalIn = Math.round(cmToIn(cm));
    return { ft: Math.floor(totalIn / 12), in: totalIn % 12 };
  }

  // ---- formatting helpers ------------------------------------------------
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const r0 = n => Math.round(n);
  const r1 = n => Math.round(n * 10) / 10;
  const r2 = n => Math.round(n * 100) / 100;
  const fmtKg = kg => `${r0(kg)} kg (${r0(kgToLb(kg))} lb)`;

  // Mifflin-St Jeor BMR (kcal/day): 10*kg + 6.25*cm - 5*age + (male 5 / female -161)
  function mifflin(v) {
    const s = (v.sex === "female") ? -161 : 5;
    return 10 * v.weight + 6.25 * v.height - 5 * num(v.age) + s;
  }

  // ---- metric default seed (girths/height/weight rendered per unit) ------
  const MDEF = { weight: 70, height: 175, neck: 38, waist: 90, hip: 100 };

  // ---- shared select option sets -----------------------------------------
  const ACTIVITY = [
    { v: "1.2", l: "Sedentary (little or no exercise)" },
    { v: "1.375", l: "Lightly active (1–3 days/week)" },
    { v: "1.55", l: "Moderately active (3–5 days/week)" },
    { v: "1.725", l: "Very active (6–7 days/week)" },
    { v: "1.9", l: "Extra active (hard training / physical job)" },
  ];
  const SEX = [{ v: "male", l: "Male" }, { v: "female", l: "Female" }];
  const RATIO = [
    { v: "40/30/30", l: "Balanced — 40/30/30 (carb/protein/fat)" },
    { v: "50/30/20", l: "Higher carb — 50/30/20" },
    { v: "40/40/20", l: "High protein — 40/40/20" },
    { v: "25/35/40", l: "Low carb — 25/35/40" },
    { v: "10/30/60", l: "Keto — 10/30/60" },
  ];
  const GOAL = [
    { v: "0.8", l: "General health (RDA) — 0.8 g/kg" },
    { v: "1.2", l: "Active lifestyle — 1.2 g/kg" },
    { v: "1.6", l: "Build muscle — 1.6 g/kg" },
    { v: "2.0", l: "Lose fat / preserve muscle — 2.0 g/kg" },
  ];
  // MET values from the Compendium of Physical Activities (approximate).
  const MET = [
    { v: "4.3", l: "Walking, brisk (3.5 mph)" },
    { v: "6.0", l: "Hiking" },
    { v: "9.8", l: "Running (6 mph, 10-min mile)" },
    { v: "7.5", l: "Cycling, moderate (12–14 mph)" },
    { v: "8.0", l: "Swimming laps, moderate" },
    { v: "5.0", l: "Elliptical trainer" },
    { v: "6.0", l: "Weight training, vigorous" },
    { v: "2.5", l: "Yoga, hatha" },
    { v: "11.8", l: "Jumping rope" },
    { v: "6.5", l: "Basketball" },
    { v: "7.0", l: "Rowing machine, moderate" },
    { v: "7.8", l: "Tennis, singles" },
  ];

  // ---- field descriptor shorthands ---------------------------------------
  const F = {
    unit: { t: "unit" },
    sex: { t: "select", key: "sex", label: "Sex", def: "male", options: SEX },
    age: { t: "num", key: "age", label: "Age", def: 30, min: 2, max: 120, step: 1, suffix: "years" },
    weight: { t: "weight", key: "weight", label: "Weight" },
    height: { t: "height", key: "height", label: "Height" },
    neck: { t: "girth", key: "neck", label: "Neck" },
    waist: { t: "girth", key: "waist", label: "Waist" },
    hip: { t: "girth", key: "hip", label: "Hip", hint: "women" },
    activity: { t: "select", key: "activity", label: "Activity level", def: "1.55", options: ACTIVITY },
    calories: { t: "num", key: "calories", label: "Daily calories", def: 2000, min: 500, max: 8000, step: 50, suffix: "kcal" },
    ratio: { t: "select", key: "ratio", label: "Macro split", def: "40/30/30", options: RATIO },
    goal: { t: "select", key: "goal", label: "Goal", def: "1.6", options: GOAL },
    met: { t: "select", key: "met", label: "Activity", def: "4.3", options: MET },
    minutesEx: { t: "num", key: "minutes", label: "Exercise per day", def: 30, min: 0, max: 600, step: 5, suffix: "min" },
    minutesDur: { t: "num", key: "minutes", label: "Duration", def: 30, min: 1, max: 600, step: 5, suffix: "min" },
  };

  // ---- the calculators ---------------------------------------------------
  const CALCS = {
    bmi: {
      id: "bmi",
      fields: [F.unit, F.weight, F.height],
      compute(v) {
        const m = v.height / 100, bmi = v.weight / (m * m);
        const cat = bmi < 18.5 ? ["Underweight", "under"]
          : bmi < 25 ? ["Normal weight", "ok"]
            : bmi < 30 ? ["Overweight", "warn"] : ["Obese", "bad"];
        return {
          primary: { label: "Body Mass Index", value: r1(bmi), unit: "kg/m²" },
          badge: { text: cat[0], cls: cat[1] },
          rows: [{ k: "range", label: "Healthy weight for your height", value: `${fmtKg(18.5 * m * m)} – ${fmtKg(24.9 * m * m)}` }],
          note: "BMI screens weight-for-height only — it can't tell muscle from fat, so very muscular people read high. Treat it as a rough guide, not a diagnosis.",
        };
      },
    },
    bmr: {
      id: "bmr",
      fields: [F.unit, F.sex, F.age, F.weight, F.height],
      compute(v) {
        const b = mifflin(v);
        return {
          primary: { label: "Basal Metabolic Rate", value: r0(b), unit: "kcal/day" },
          rows: [{ k: "formula", label: "Formula", value: "Mifflin-St Jeor" }],
          note: "BMR is the energy your body burns at complete rest to keep you alive. Multiply it by an activity factor to get your daily calorie needs (see the TDEE calculator).",
        };
      },
    },
    tdee: {
      id: "tdee",
      fields: [F.unit, F.sex, F.age, F.weight, F.height, F.activity],
      compute(v) {
        const b = mifflin(v), f = num(v.activity), tdee = b * f;
        return {
          primary: { label: "Total Daily Energy Expenditure", value: r0(tdee), unit: "kcal/day" },
          rows: [
            { k: "bmr", label: "BMR (at rest)", value: `${r0(b)} kcal` },
            { k: "factor", label: "Activity factor", value: `× ${f}` },
          ],
          note: "TDEE is roughly the calories you burn per day at your activity level. Eat around this to maintain weight; below it to lose, above it to gain.",
        };
      },
    },
    calorie: {
      id: "calorie",
      fields: [F.unit, F.sex, F.age, F.weight, F.height, F.activity],
      compute(v) {
        const b = mifflin(v), f = num(v.activity), tdee = b * f;
        return {
          primary: { label: "Maintenance calories", value: r0(tdee), unit: "kcal/day" },
          rows: [
            { k: "lose", label: "Lose weight (~1 lb/week)", value: `${r0(tdee - 500)} kcal` },
            { k: "gain", label: "Gain weight (~1 lb/week)", value: `${r0(tdee + 500)} kcal` },
            { k: "bmr", label: "BMR (at rest)", value: `${r0(b)} kcal` },
          ],
          note: "A 500-kcal daily deficit or surplus is about 1 lb (0.45 kg) per week, since a pound of fat is roughly 3,500 kcal. Don't drop below ~1,200 (women) or ~1,500 (men) without medical guidance.",
        };
      },
    },
    macro: {
      id: "macro",
      fields: [F.calories, F.ratio],
      compute(v) {
        const cal = num(v.calories);
        const parts = String(v.ratio).split("/").map(Number);
        const c = parts[0] || 0, p = parts[1] || 0, f = parts[2] || 0;
        return {
          primary: { label: "Daily calories", value: r0(cal), unit: "kcal" },
          rows: [
            { k: "protein", label: `Protein (${p}%)`, value: `${r0(cal * p / 100 / 4)} g` },
            { k: "carbs", label: `Carbs (${c}%)`, value: `${r0(cal * c / 100 / 4)} g` },
            { k: "fat", label: `Fat (${f}%)`, value: `${r0(cal * f / 100 / 9)} g` },
          ],
          note: "Protein and carbs supply 4 kcal per gram, fat 9 kcal per gram. Grams = calories × the percentage ÷ calories-per-gram. Protein around 0.7–1 g per pound of bodyweight is a common target for active people.",
        };
      },
    },
    ideal: {
      id: "ideal",
      fields: [F.unit, F.sex, F.height],
      compute(v) {
        const inch = v.height / 2.54, over = Math.max(0, inch - 60);
        const male = v.sex !== "female";
        const devine = (male ? 50 : 45.5) + 2.3 * over;
        const robinson = (male ? 52 : 49) + (male ? 1.9 : 1.7) * over;
        return {
          primary: { label: "Ideal weight — Devine", value: r0(devine), unit: "kg" },
          rows: [
            { k: "devine_lb", label: "Devine, in pounds", value: `${r0(kgToLb(devine))} lb` },
            { k: "robinson", label: "Robinson formula", value: fmtKg(robinson) },
          ],
          note: "These 1970s–80s clinical formulas estimate a reference weight from height and sex alone — they ignore frame size and muscle. A healthy range (not a single number) is more realistic; see the BMI calculator.",
        };
      },
    },
    bodyfat: {
      id: "bodyfat",
      fields: [F.unit, F.sex, F.height, F.neck, F.waist, F.hip],
      compute(v) {
        const male = v.sex !== "female";
        let bf;
        if (male) bf = 495 / (1.0324 - 0.19077 * Math.log10(v.waist - v.neck) + 0.15456 * Math.log10(v.height)) - 450;
        else bf = 495 / (1.29579 - 0.35004 * Math.log10(v.waist + v.hip - v.neck) + 0.22100 * Math.log10(v.height)) - 450;
        if (!isFinite(bf) || bf <= 0 || bf > 75) {
          return {
            primary: { label: "Body fat", value: "—", unit: "%" },
            note: "Check your measurements — waist must be larger than neck (men), and waist + hip larger than neck (women). Measure at the navel for waist, below the larynx for neck.",
          };
        }
        const M = [[6, "Athlete", "ok"], [14, "Fitness", "ok"], [18, "Average", "warn"], [25, "Above average", "bad"]];
        const W = [[14, "Athlete", "ok"], [21, "Fitness", "ok"], [25, "Average", "warn"], [32, "Above average", "bad"]];
        const scale = male ? M : W;
        let cat = ["Essential", "under"];
        for (const [lo, name, cls] of scale) if (bf >= lo) cat = [name, cls];
        return {
          primary: { label: "Body fat", value: r1(bf), unit: "%" },
          badge: { text: cat[0], cls: cat[1] },
          rows: [{ k: "method", label: "Method", value: "U.S. Navy circumference" }],
          note: "The U.S. Navy tape method estimates body fat from circumferences and height. It's within a few points of a DEXA scan for most people, but a poor tape measurement throws it off.",
        };
      },
    },
    water: {
      id: "water",
      fields: [F.unit, F.weight, F.minutesEx],
      compute(v) {
        const ml = v.weight * 35 + (num(v.minutes) / 30) * 350;
        const oz = ml / 29.5735;
        return {
          primary: { label: "Daily water intake", value: r1(ml / 1000), unit: "liters" },
          rows: [
            { k: "oz", label: "In fluid ounces", value: `${r0(oz)} oz` },
            { k: "cups", label: "8-oz cups", value: `${r0(oz / 8)}` },
          ],
          note: "Based on about 35 ml per kg of bodyweight plus roughly 350 ml per 30 minutes of exercise. Food and other drinks count too. Needs rise with heat, illness and pregnancy — pale-yellow urine is a good day-to-day guide.",
        };
      },
    },
    protein: {
      id: "protein",
      fields: [F.unit, F.weight, F.goal],
      compute(v) {
        const f = num(v.goal), g = v.weight * f;
        return {
          primary: { label: "Daily protein", value: r0(g), unit: "grams" },
          rows: [
            { k: "perlb", label: "Per pound of bodyweight", value: `${r2(f * KG_PER_LB)} g/lb` },
            { k: "gkg", label: "Target rate", value: `${f} g/kg` },
          ],
          note: "The RDA is 0.8 g/kg to prevent deficiency; active people and those building or preserving muscle typically aim for 1.2–2.0 g/kg. Spread it across the day and pair it with resistance training.",
        };
      },
    },
    burned: {
      id: "burned",
      fields: [F.unit, F.met, F.weight, F.minutesDur],
      compute(v) {
        const met = num(v.met), perMin = met * 3.5 * v.weight / 200, kcal = perMin * num(v.minutes);
        return {
          primary: { label: "Calories burned", value: r0(kcal), unit: "kcal" },
          rows: [
            { k: "permin", label: "Per minute", value: `${r1(perMin)} kcal` },
            { k: "perhour", label: "Per hour", value: `${r0(perMin * 60)} kcal` },
          ],
          note: "Uses the MET formula: kcal/min = MET × 3.5 × kg ÷ 200. MET values are population averages, so your real burn depends on intensity, fitness and terrain. Fitness-tracker estimates vary just as much.",
        };
      },
    },
  };

  // ---- normalize display values -> metric --------------------------------
  function metricize(calc, disp, unit) {
    const out = {};
    for (const f of calc.fields) {
      if (f.t === "unit") continue;
      if (f.t === "weight") out[f.key] = unit === "imperial" ? lbToKg(num(disp[f.key])) : num(disp[f.key]);
      else if (f.t === "girth") out[f.key] = unit === "imperial" ? inToCm(num(disp[f.key])) : num(disp[f.key]);
      else if (f.t === "height") {
        const h = disp[f.key] || {};
        out[f.key] = unit === "imperial" ? ftInToCm(num(h.ft), num(h.in)) : num(h.cm);
      } else if (f.t === "num") out[f.key] = num(disp[f.key]);
      else out[f.key] = disp[f.key]; // select: keep raw string
    }
    return out;
  }

  // ---- display defaults for a given unit ---------------------------------
  function defaults(calc, unit) {
    const d = {};
    for (const f of calc.fields) {
      if (f.t === "unit") continue;
      if (f.t === "weight") d[f.key] = unit === "imperial" ? r0(kgToLb(MDEF.weight)) : MDEF.weight;
      else if (f.t === "girth") d[f.key] = unit === "imperial" ? r0(cmToIn(MDEF[f.key])) : MDEF[f.key];
      else if (f.t === "height") d[f.key] = unit === "imperial" ? cmToFtIn(MDEF.height) : { cm: MDEF.height };
      else d[f.key] = f.def;
    }
    return d;
  }

  // ---- render the result block (shared server + client) ------------------
  function renderResult(calc, r) {
    if (!r) return "";
    const prim = r.primary ? `<div class="rp"><div class="rp-num"><span class="rp-val" data-primary>${r.primary.value}</span>${r.primary.unit ? `<span class="rp-unit">${r.primary.unit}</span>` : ""}</div><div class="rp-label">${r.primary.label}</div></div>` : "";
    const badge = r.badge ? `<div class="badge badge-${r.badge.cls}" data-badge>${r.badge.text}</div>` : "";
    const rows = (r.rows && r.rows.length) ? `<table class="rrows">${r.rows.map(x => `<tr><th>${x.label}</th><td data-k="${x.k}">${x.value}</td></tr>`).join("")}</table>` : "";
    const note = r.note ? `<p class="rnote">${r.note}</p>` : "";
    return `<div class="result">${prim}${badge}${rows}${note}</div>`;
  }

  return {
    CALCS, metricize, defaults, renderResult,
    lbToKg, kgToLb, inToCm, cmToIn, ftInToCm, cmToFtIn, num, r0, r1,
  };
});
