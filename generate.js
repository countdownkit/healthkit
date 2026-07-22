/*
 * Static generator for the health-calculators site.
 * Run: node generate.js   ->   writes everything into ./public
 *
 * Page families:
 *   /<slug>/   one interactive calculator (BMI, calorie, macro, ...)
 *   /          homepage, calculators grouped by topic
 *
 * The tool IS the page: the calculator inputs and an initial computed result are
 * server-rendered (SEO + works with JS off); assets/tool.js recomputes live and
 * handles the imperial/metric toggle. The shared math lives in assets/calc.js so
 * server render and browser render always agree. Everything is client-side.
 */
const fs = require("fs");
const path = require("path");
const CALC = require("./assets/calc.js");

// ---- config -------------------------------------------------------------
const DOMAIN = process.env.DOMAIN || "https://health.elevatedprogress.com";
const BASE = process.env.BASE || "";
const SITE = "Health Calculators";
const EMOJI = "🩺";
const OUT = path.join(__dirname, "public");
const ASSETS = path.join(__dirname, "assets");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "health.json"), "utf8"));
const { CALCS, defaults, metricize, renderResult } = CALC;

// ---- html layout --------------------------------------------------------
function layout({ title, desc, urlPath, h1, body }) {
  const canonical = DOMAIN + BASE + urlPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${BASE}/styles.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5580575158570188" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TJY4TRRKD6"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-TJY4TRRKD6');</script>
</head>
<body>
<header class="site-head"><div class="wrap">
  <a class="brand" href="${BASE}/">${EMOJI} ${SITE}</a>
  <nav class="nav"><a href="${BASE}/#body">Body</a><a href="${BASE}/#energy">Calories</a><a href="${BASE}/#daily">Daily</a></nav>
</div></header>
<main class="wrap">
  <div class="crumbs"><a href="${BASE}/">Home</a> ›&nbsp;${h1}</div>
  <h1>${h1}</h1>
  ${body}
</main>
<footer class="site-foot"><div class="wrap">
  <a href="${BASE}/">Home</a><a href="${BASE}/#body">Weight &amp; body</a><a href="${BASE}/#energy">Calories &amp; macros</a><a href="${BASE}/#daily">Daily needs</a>
  <span>· ${SITE} — free health &amp; fitness calculators. Educational estimates, not medical advice. Part of <a href="https://elevatedprogress.com/">Elevated Progress</a>.</span>
</div></footer>
<script src="${BASE}/calc.js"></script>
<script src="${BASE}/tool.js" defer></script>
</body>
</html>`;
}
function grid(links) {
  return `<div class="grid">` + links.map(l =>
    `<a href="${BASE}${l.href}">${l.emoji ? `<span class="chip-emoji">${l.emoji}</span>` : ""}${l.label}</a>`).join("") + `</div>`;
}

// ---- control rendering --------------------------------------------------
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function fieldHtml(f, disp, unit) {
  if (f.t === "unit") {
    return `<div class="field field-unit"><label>Units</label><div class="unit-toggle" data-ctl="unit">
      <button type="button" data-unit="imperial"${unit === "imperial" ? ' class="active"' : ""}>Imperial</button>
      <button type="button" data-unit="metric"${unit === "metric" ? ' class="active"' : ""}>Metric</button>
    </div></div>`;
  }
  if (f.t === "select") {
    const opts = f.options.map(o => `<option value="${esc(o.v)}"${String(o.v) === String(disp[f.key]) ? " selected" : ""}>${esc(o.l)}</option>`).join("");
    const wide = f.options.some(o => o.l.length > 24) ? " field-wide" : "";
    return `<div class="field${wide}"><label>${f.label}</label><select data-num="${f.key}" data-role="select">${opts}</select></div>`;
  }
  if (f.t === "num") {
    const a = `${f.min != null ? ` min="${f.min}"` : ""}${f.max != null ? ` max="${f.max}"` : ""} step="${f.step != null ? f.step : "any"}"`;
    const suf = f.suffix ? ` <span class="sfx">(${f.suffix})</span>` : "";
    return `<div class="field"><label>${f.label}${suf}</label><input type="number" inputmode="decimal" data-num="${f.key}" data-role="num" value="${esc(disp[f.key])}"${a}></div>`;
  }
  if (f.t === "weight") {
    return `<div class="field"><label>${f.label}</label><div class="numsuffix"><input type="number" inputmode="decimal" data-num="${f.key}" data-role="weight" value="${esc(disp[f.key])}" min="0" step="any"><span class="u-lbl" data-imp="lb" data-met="kg">${unit === "imperial" ? "lb" : "kg"}</span></div></div>`;
  }
  if (f.t === "girth") {
    const hint = f.hint ? ` <span class="sfx">(${f.hint})</span>` : "";
    return `<div class="field"><label>${f.label}${hint}</label><div class="numsuffix"><input type="number" inputmode="decimal" data-num="${f.key}" data-role="girth" value="${esc(disp[f.key])}" min="0" step="any"><span class="u-lbl" data-imp="in" data-met="cm">${unit === "imperial" ? "in" : "cm"}</span></div></div>`;
  }
  if (f.t === "height") {
    const h = disp[f.key] || {};
    return `<div class="field"><label>${f.label}</label>
      <div class="uf uf-imperial"><input type="number" inputmode="decimal" data-h="ft" class="u-in" value="${h.ft != null ? h.ft : ""}" min="1" max="8" step="1"><span class="u-lbl">ft</span><input type="number" inputmode="decimal" data-h="in" class="u-in" value="${h.in != null ? h.in : ""}" min="0" max="11" step="1"><span class="u-lbl">in</span></div>
      <div class="uf uf-metric"><input type="number" inputmode="decimal" data-h="cm" class="u-in" value="${h.cm != null ? h.cm : ""}" min="50" max="260" step="any"><span class="u-lbl">cm</span></div>
    </div>`;
  }
  return "";
}

// ---- write helpers ------------------------------------------------------
const urls = [];
function writePage(urlPath, html) {
  const dir = path.join(OUT, urlPath.replace(/^\/+|\/+$/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  urls.push(urlPath);
}
const pageLink = p => ({ href: `/${p.slug}/`, emoji: p.emoji, label: p.name });

// ---- calculator page ----------------------------------------------------
function calcPage(page) {
  const calc = CALCS[page.calc];
  const unit = "imperial";
  const disp = defaults(calc, unit);
  const result = renderResult(calc, calc.compute(metricize(calc, disp, unit)));
  const controls = calc.fields.map(f => fieldHtml(f, disp, unit)).join("");

  const related = DATA.pages.filter(p => p.group === page.group && p.slug !== page.slug).map(pageLink)
    .concat(DATA.pages.filter(p => p.group !== page.group).slice(0, 3).map(pageLink));

  const body = `<p class="lead">${page.desc}</p>
  <form class="calc" data-calc="${page.calc}" data-unit="${unit}" autocomplete="off" onsubmit="return false">
    <div class="fields">${controls}</div>
  </form>
  <div class="result-wrap" data-result-wrap>${result}</div>
  <p class="disclaimer">⚕️ This is an educational estimate, not medical advice. Formulas are population averages and can't account for your full health picture — talk to a doctor or registered dietitian before making decisions about diet, weight or training.</p>
  <div class="ad-slot">Advertisement</div>
  <div class="prose">
    <h2>How this calculator works</h2>
    <p>${page.formula}</p>
    ${page.tip ? `<p>${page.tip}</p>` : ""}
  </div>
  <h2>More health calculators</h2>
  ${grid(related)}
  <div class="ad-slot">Advertisement</div>`;

  writePage(`/${page.slug}/`, layout({
    title: page.title, desc: page.desc, urlPath: `/${page.slug}/`, h1: page.h1, body,
  }));
}

// ---- build --------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
for (const entry of fs.readdirSync(OUT)) {
  if (entry === ".git" || entry === "CNAME") continue;
  fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
}
for (const f of fs.readdirSync(ASSETS)) fs.copyFileSync(path.join(ASSETS, f), path.join(OUT, f));

for (const page of DATA.pages) calcPage(page);

// -- homepage --
{
  const title = `Health Calculators — BMI, Calories, Macros & More (Free)`;
  const desc = `Free, accurate health and fitness calculators: BMI, calorie and TDEE, macros, ideal weight, body fat, water intake and protein. Metric and imperial, no signup.`;
  const sections = DATA.groups.map(g => {
    const links = DATA.pages.filter(p => p.group === g.id).map(pageLink);
    return `<h2 id="${g.id}">${g.title}</h2><p class="group-blurb">${g.blurb}</p>${grid(links)}`;
  }).join("");
  const body = `<p class="lead">A set of simple, accurate calculators for weight, calories, macros and daily targets. Every tool works in both imperial and metric, shows the exact formula it uses, and runs entirely in your browser — nothing is saved or sent anywhere.</p>
  ${sections}
  <div class="ad-slot">Advertisement</div>
  <div class="prose">
    <p>These calculators use the standard published equations — Mifflin-St Jeor for metabolism, the U.S. Navy method for body fat, Devine and Robinson for ideal weight, and MET values for energy burned. They give solid estimates, but every formula is a generalization. For anything that affects your health, treat the numbers as a starting point and check with a professional.</p>
  </div>`;
  writePage(`/`, layout({ title, desc, urlPath: `/`, h1: `Free Health & Fitness Calculators`, body }));
}

// -- sitemap + robots + meta files --
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${DOMAIN}${BASE}${u}</loc></url>`).join("\n")}
</urlset>`;
fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
fs.writeFileSync(path.join(OUT, "CNAME"), "health.elevatedprogress.com\n");
fs.writeFileSync(path.join(OUT, "ads.txt"), "google.com, pub-5580575158570188, DIRECT, f08c47fec0942fa0\n");

console.log(`Generated ${urls.length} pages into ./public`);
