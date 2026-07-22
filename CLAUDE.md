# CLAUDE.md — healthkit

Project instructions for Claude Code working in this repo. Inherits the ElevatedProgress
venture playbook from the parent folder's CLAUDE.md.

## What this is

A zero-dependency static-site generator for **free health & fitness calculators**.
`generate.js` reads `data/health.json` + `assets/` and writes one interactive calculator page
per tool into `public/`. Target: https://health.elevatedprogress.com/. Health/fitness is a
higher-CPC, general-consumer niche, and these are **multi-input** calculators (BMI, TDEE,
macros, body fat, …) — they resist AI-overview one-answer snippets because the result depends
on several fields the searcher must enter.

## The product rule

**The tool IS the page.** Each page server-renders the calculator inputs *and* an initial
computed result, so it works with JavaScript off and gives Google real content to index.
`assets/tool.js` then recomputes live on every input change and handles the **imperial/metric
unit toggle** (converting the entered values, not just the labels).

All the math + field definitions live once in `assets/calc.js`, a UMD module required by BOTH
`generate.js` (server render) and `tool.js` (browser) so their output matches exactly. Add or
change a calculator there; `data/health.json` only carries per-page SEO copy.

### Formulas (must stay correct)

- **BMI** = kg ÷ m². Bands: <18.5 / <25 / <30 / ≥30.
- **BMR** = Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + (male +5 / female −161).
- **TDEE** = BMR × activity factor (1.2 – 1.9).
- **Calorie goals** = TDEE, and TDEE ∓ 500 for lose/gain (~1 lb/week).
- **Macros**: grams = calories × pct ÷ (4 protein / 4 carb / 9 fat). Ratio string is carb/protein/fat.
- **Ideal weight**: Devine & Robinson (base at 5 ft + per-inch increment, by sex).
- **Body fat**: U.S. Navy circumference method (log10; women add hip).
- **Water**: ~35 ml/kg + 350 ml per 30 min exercise.
- **Protein**: g/kg × bodyweight, by goal (0.8 / 1.2 / 1.6 / 2.0).
- **Calories burned**: MET × 3.5 × kg ÷ 200 × minutes.

Everything runs in metric internally; `metricize()` normalizes display values → metric.
Every calculator page carries a visible **"educational estimate, not medical advice"**
disclaimer — never add personalized medical advice.

## Deploy — just push

`git push` to `main` is the deploy — GitHub Actions (`.github/workflows/deploy.yml`).

- **Never manually build and commit output.** `public/` is git-ignored build output.
- **Never hand-edit anything in `public/`.**
- Commit as the neutral identity:
  `git -c user.name="healthkit" -c user.email="healthkit@users.noreply.github.com" commit …`

## Local build / preview

```
node generate.js     # writes ./public
node server.js       # preview at http://localhost:5086 (5060/5061 are Chrome-blocked SIP ports)
```

## Adding a calculator

1. Add an entry to `CALCS` in `assets/calc.js`: an `id`, a `fields` array (reuse the `F.*`
   shorthands — unit toggle, sex, age, weight, height, girths, selects, numbers), and a
   `compute(v)` that takes metric values and returns `{ primary, badge?, rows, note }`.
2. Add a page row to `data/health.json` (`slug` = the real search query, `calc` = the id,
   `group`, `emoji`, `name`, `h1`, `title`, `desc`, honest `formula`/`tip` copy).
3. Slug into a `group` (`body` / `energy` / `daily`) so it lands on the homepage.

## Don't break these (generated, must keep serving)

- `ads.txt` + AdSense loader in `<head>` — publisher `ca-pub-5580575158570188`.
- GA4 `G-TJY4TRRKD6` (shared across all EP sites; hostname splits them).
- `sitemap.xml`, `robots.txt`, `.nojekyll`, `CNAME` (health.elevatedprogress.com).
- GSC verification file once the property is verified.

## Config knobs

`DOMAIN` and `BASE`, same semantics as the other tools. Production values in the workflow.
