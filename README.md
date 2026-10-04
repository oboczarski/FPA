# 2026 Matchups

The static app lives in `DH-FPA/index.html`. It uses three supplied files: **FPFA.csv** for defense actual/expected totals, averages, and ranks; **FPF.csv** for offense scoring totals, averages, and ranks; and **FPAv2.csv** for individual player results and weekly games. FPFA is the renamed former defense-summary FPF file. The new FPF restores the offense data formerly supplied by TSUMS, with no required games column. All 32 teams currently have three games in Weeks 1–3. The generated bundle preserves all three CSVs byte for byte.

## Current app

- Compact DataHub-style background, gradient accents, glass panels, and Game Logs-style tables.
- Shared defense, QB/RB/WR/TE/ALL, and defense-venue selection. The original AFC/NFC division picker with team logos is restored in the main controls and expanded player view; venue menus use the same treatment.
- Actual and expected scoring summary, a 196px weekly chart with actual bars and an expected-points line, and the selected matchup's player records immediately below it.
- Search, sorting, and an expanded player table. Hide <1 point starts checked in both player views and hides all scores below one PPR point, including zero and negative scores; unchecking shows them again. Player-list controls never change scoring aggregates, which retain every valid score.
- Expected-versus-actual scatter with points and ranks modes, at 330px desktop / 320px mobile. Selecting a defense logo updates the matchup; logos also support Enter/Space.
- Opponent offense table with all six columns restored: week, offense, offense rank, expected FPA, actual FPA, and Δ FPA. Offense averages and ranks come directly from FPF for the selected position. The weekly expected line uses those same averages. The display-only W4 placeholder remains and is omitted when that scope has a real Week 4 entry.
- Sortable, selectable league heatmap of FPA/game and defense ranks.
- Three amCharts views: stacked positional scoring bars that always show QB/RB/WR/TE together, actual-versus-expected dumbbells sorted by actual FPA from highest to lowest, and a polar scatter whose markers show opposing offense logos. The former bullet ranking and its calculation/rendering code are removed.
- Dumbbells use four gradients in descending actual-FPA order: rose and violet for the top half, blue and mint for the bottom half. Each band covers eight of the 32 teams. Connectors stay 4px thick for every team, including selection. Endpoint and Δ labels are 8px with one decimal place; equal values keep the expected label on the left and actual on the right. Axis bounds are exactly 15 points below the lowest actual/expected endpoint and 20 above the highest.
- Position bars remain on the weekly chart, original scatter, dumbbells, and polar scatter, with shared selection. Stacked bars and the heatmap have independent sort-by position bars that reorder all teams without changing dashboard position or hiding scoring positions. The stacked control shares its existing legend row; the heatmap's scale is on the left and its labeled sort controls are on the right.
- One desktop grid provides three aligned rows: defense / original scatter; stacked bars / heatmap; dumbbells / polar scatter. At 1100px and below it stacks in that reading order.
- amCharts headings, subheadings, legends, and focus controls are HTML with normal CSS styling. Canvas axis/value/tooltip/center text uses the documented --am-* properties in chart-lab.css. Chart headings have a 32px left inset (20px mobile).

There are no upload/download/export controls, saved uploaded datasets, week-range controls, recent-form comparisons, or trend panels. The app always starts from the bundled three-source snapshot. Matchup selections are reflected in the URL.

## Calculation contract

In FPAv2, `VS` identifies the defense and `TM` identifies the offense. A player's `vs TB` means TB's defense was away; `@ NYG` means NYG's defense was home.

Season-to-date summaries use all six FPFA fields directly for QB/RB/WR/TE/ALL:

| Column | Meaning |
| --- | --- |
| Position (QB, RB, WR, TE, ALL) | Actual FPA total |
| x | Actual FPA average |
| rk | Actual FPA rank |
| vs | Expected FPA total |
| vX | Expected FPA average |
| vRK | Expected FPA rank |

`TM` identifies the defense in FPFA. Expected totals already contain the sum of opponent scoring averages; the app does not recalculate or redistribute them. Published averages and ranks are also preserved independently of totals. Both scatter axes and dumbbell endpoints use FPFA totals in the all-games view. Scatter rank mode uses the supplied `rk` and `vRK` fields, where **1 means the highest FPA**. Colors keep lower FPA tougher and higher FPA easier. No ranking is inferred from rounded source totals.

Weekly charts, players, and polar game dots use FPAv2. Both `WK` and legacy `WEEK` are supported; conflicting aliases are rejected. `VS` remains the opponent and venue authority. Individual game FPA sums all player points, including zeros and negatives. The weekly chart’s dashed expected line uses the opposing offense’s season average for the selected position, supplied in FPF, counted once per recorded defense-game. Venue filters choose the displayed games while retaining those season averages. Missing baselines leave gaps in the line; zero expectations remain valid. Multiple players in one defense-week count as one game. Missing position data remains unavailable. ALL requires all four positions in a game.

In FPF, `TM` identifies the offense. Each position's unsuffixed column is its scoring total, `x` is its published average, and `rk` is its supplied offense rank (1 = most points scored). Header casing is normalized; no `G` column is needed. Offenses faced, the weekly expected line, and Game Spokes tooltips use these published averages/ranks.

Venue and partial-week actual summaries use FPAv2. Their expected total is the sum of the FPF scoring averages for offenses faced in those eligible games, with one baseline per game. This is opponent-quality context, not an offense venue scoring split. A missing average leaves the comparison unavailable; a supplied zero remains valid. Scoped scatter comparison ranks use descending competition order (1 = highest total). The venue heatmap/profile retain ascending actual-average ranks (1 = fewest allowed points). Full-season views preserve FPFA's six independent fields, even if rounded FPF averages sum to a slightly different expected total.

Stacked segments use supplied positional averages; their ALL labels use the independent supplied ALL average. A one-decimal rounding difference of 0.1 can occur between the segment sum and the label.

Points-mode axes fit their own expected or actual values independently, rounding the minimum down and maximum up to the nearest 10 points. For example, 32.4–76.2 displays as 30–80. Bounds update with position selection; venue scopes fit their selected actual totals and summed opponent baselines. The equality line and comparison shading use actual=expected even when the two axis ranges differ. Rank-mode bounds retain their existing scale.

These are comparisons with opponents' season-to-date scoring averages. Those averages include their results against the selected defense.

## Source audit

The replacement FPAv2 contains 1,255 rows: 1,233 assigned results and 22 with no opponent. All 32 defenses have four-position coverage in each supplied week. Assigned scores include 471 zeros and 12 negatives, totaling **7,677.18** PPR points across 96 defense-game observations and 48 matchups. Weekly totals are 2,624.88 / 2,420.90 / 2,631.40.

FPFA has 32 unique defenses, 30 numeric metric columns, and three opponent columns. All 96 opponent links agree with FPAv2, and all 160 actual totals agree within one-decimal rounding. FPF has 32 unique offenses and 15 numeric fields; its offense totals also agree with player sums within rounding. Each of its published averages/ranks is preserved. For example, BAL ALL expected scoring remains FPFA's 275.5, while its displayed opponent baselines are 70.6, 109.7, and 95.1 (sum 275.4 after source rounding).

See [the migration receipt](docs/2026-fpf-migration.md) for source ownership and reproducible checks.

## Connecting to the main app

Copy the complete `DH-FPA/` directory as the self-contained page, preserving its relative file paths. `index.html` loads its own styles, scripts, bundled data, team logos, and local chart libraries; no build step is required. Keep the amCharts license and provenance files with the page. Google fonts have system-font fallbacks.

## Local use and data maintenance

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory DH-FPA
```

Open `http://127.0.0.1:8765`. The generated three-source snapshot also supplies the data for direct-file use. Fonts use the same Google Sans Flex and MuseoModerno families as the DataHub reference, with system-font fallbacks; scoring data and charts are local.

To update the repository's defaults, replace `DH-FPA/data/FPAv2.csv`, `DH-FPA/data/FPFA.csv`, and `DH-FPA/data/FPF.csv`, then run `node scripts/sync-data.cjs`. This validates and bundles all three CSVs with their SHA-256 checksums in `DH-FPA/data/2026-weekly.js`. Update asset query versions when publishing new data/code.

## Verification

```sh
node --test tests/data-model.test.cjs
node --test tests/chart-utils.test.cjs
node --test tests/chart-lab-model.test.cjs
node --test tests/app-data.test.cjs
python3 tests/reconcile_source.py
```

The targeted suites cover CSV integrity, opponent/venue interpretation, zero/negative scores, WK/WEEK compatibility, all six FPFA fields, all 480 FPF offense values, supplied ranks/averages, missing and zero baselines, filtered comparisons, and snapshot checksums. Independent Python CSV/Decimal/Fraction reconciliation checks 2,880 weekly defense-position cases across 18 scopes, all 960 FPFA values, 96 opponent links, and every FPF per-game baseline/rank. A DOM fixture exercises the real app initialization, six-column Offenses faced table in all positions/venues, preserved axis/zone labels, source rounding, expected markers, and amCharts view inputs without opening a browser. Source control totals should be updated deliberately when the supplied period changes.

Chart-model checks preserve the 160 team-position values, positional stacks and independent ALL labels, dumbbell sorting/gradients/endpoints/bounds, and 96 correctly scored game dots per position with opposing offense logos aligned to 32 defense spokes. Libraries are bundled locally at amCharts 5.20.8; their original license and built-in attribution are retained.

Browser and visual checks are user-owned. No preview is opened as part of delivery. The new chart designs, formulas, and library sources are documented in `docs/2026-chart-lab.md`. Earlier implementation notes are in `docs/2026-refinement.md`; `docs/2026-rebuild.md` records the superseded first rebuild.
