# 2026 Matchups

The static app lives in `DH-FPA/index.html`. It uses the supplied **FPAv2.csv** for actual player scoring and **TSUMS.csv** for opponent offense baselines. Both files currently cover three games per team in Weeks 1–3. Historical CSVs remain inactive.

## Current app

- Compact DataHub-style background, gradient accents, glass panels, and Game Logs-style tables.
- Shared defense, QB/RB/WR/TE/ALL, and defense-venue selection. The original AFC/NFC division picker with team logos is restored in the main controls and expanded player view; venue menus use the same treatment.
- Actual and expected scoring summary, a 196px weekly chart, and the selected matchup's player records immediately below it.
- Search, sorting, and an expanded player table. Hide <1 point starts checked in both player views and hides all scores below one PPR point, including zero and negative scores; unchecking shows them again. Player-list controls never change scoring aggregates, which retain every valid score.
- Expected-versus-actual scatter with points and ranks modes, at 330px desktop / 320px mobile. Selecting a defense logo updates the matchup; logos also support Enter/Space.
- Opponent offense table with the supplied TSUMS scoring average/rank, actual points against the selected defense, and the difference. A display-only W4 placeholder with blank scoring lets the fourth-row size be judged; it is omitted when that scope has a real Week 4 entry.
- Sortable, selectable league heatmap of FPA/game and defense ranks.
- Three amCharts views: stacked positional scoring bars that always show QB/RB/WR/TE together, actual-versus-expected dumbbells sorted by actual FPA from highest to lowest, and a polar scatter whose markers show opposing offense logos. The former bullet ranking and its calculation/rendering code are removed.
- Dumbbells use four gradients in descending actual-FPA order: rose and violet for the top half, blue and mint for the bottom half. Each band covers eight of the 32 teams. Connectors stay 4px thick for every team, including selection. Endpoint and Δ labels are 8px with one decimal place; equal values keep the expected label on the left and actual on the right. Axis bounds are exactly 15 points below the lowest actual/expected endpoint and 20 above the highest.
- Position bars remain on the weekly chart, original scatter, dumbbells, and polar scatter, with shared selection. Stacked bars and the heatmap have independent sort-by position bars that reorder all teams without changing dashboard position or hiding scoring positions. The stacked control shares its existing legend row; the heatmap's scale is on the left and its labeled sort controls are on the right.
- One desktop grid provides three aligned rows: defense / original scatter; stacked bars / heatmap; dumbbells / polar scatter. At 1100px and below it stacks in that reading order.
- amCharts headings, subheadings, legends, and focus controls are HTML with normal CSS styling. Canvas axis/value/tooltip/center text uses the documented --am-* properties in chart-lab.css. Chart headings have a 32px left inset (20px mobile).

There are no upload/download/export controls, saved uploaded datasets, week-range controls, recent-form comparisons, or trend panels. The app always starts from the bundled source pair. Matchup selections are reflected in the URL.

## Calculation contract

`VS` identifies the defense. `TM` identifies the offense. A player's `vs TB` means TB's defense was away; `@ NYG` means NYG's defense was home.

Actual FPA sums all supplied player points for the selected defense and position. Multiple players in one defense-week count as one game. FPA/game divides by games with records for that position. A zero is a recorded value; missing data stays unavailable. ALL requires all four positions in a game.

Expected FPA adds the opposing offense's supplied TSUMS `QBx`, `RBx`, `WRx`, `TEx`, or `ALLx` once per eligible game. ALL uses `ALLx` directly. TSUMS averages are used as supplied, without deriving replacements from player results. Expected and actual comparisons use the same position/game/venue scope. If a required offense average is absent, the full comparison is unavailable.

Both points-mode scatter axes use **totals**. Rank mode ranks expected totals and actual totals separately within the same complete comparison cohort, ascending from lowest to highest with competition ties (1, 1, 3). Heatmap ranks use unrounded FPA/game; with unequal game counts they can differ from scatter total ranks. TSUMS offense ranks are shown separately and retain their supplied direction: 1 is the most offensive points.

Points-mode axes fit their own expected or actual values independently, rounding the minimum down and maximum up to the nearest 10 points. For example, 32.4–76.2 displays as 30–80. Bounds update with position and venue selections. The equality line and comparison shading use actual=expected even when the two axis ranges differ. Rank-mode bounds retain their existing scale.

These are comparisons with opponents' season-to-date scoring averages. Those averages include their results against the selected defense.

## Source audit

FPAv2 contains 1,250 rows: 1,228 assigned results and 22 with no opponent. All 32 defenses have four-position coverage in each supplied week. The assigned scores include 471 zeros and 12 negatives, totaling **7,621.62** PPR points across 96 defense-game observations and 48 matchups.

The updated row is Case Keenum, Week 3, CHI, `vs PHI`, 24.48 points. No previous player rows changed.

The source files differ for JAX WR and ALL: weekly totals are 110.60 WR / 242.04 ALL, while TSUMS reports 102.4 WR / 233.8 ALL. Both files are preserved unchanged. Actual scoring uses FPAv2; expectations use the supplied TSUMS averages of 34.1 WR / 77.9 ALL. The app explains this in its methodology disclosure.

## Local use and data maintenance

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory DH-FPA
```

Open `http://127.0.0.1:8765`. The generated source pair also supplies the data for direct-file use. Fonts use the same Google Sans Flex and MuseoModerno families as the DataHub reference, with system-font fallbacks; scoring data and charts are local.

To update the repository's defaults, replace `DH-FPA/data/FPAv2.csv` and `DH-FPA/data/TSUMS.csv`, then run `node scripts/sync-data.cjs`. This validates and bundles both CSVs with their SHA-256 checksums in `DH-FPA/data/2026-weekly.js`. Update asset query versions when publishing new data/code.

## Verification

```sh
node --test tests/data-model.test.cjs
node --test tests/chart-utils.test.cjs
node --test tests/chart-lab-model.test.cjs
python3 tests/reconcile_source.py
```

The targeted calculation suite covers source controls, opponent/venue interpretation, missing values, zeros/negatives, expected-game counting, supplied ALLx handling, complete rank cohorts, ties, source differences, and snapshot identity. Independent Python CSV/Decimal/Fraction reconciliation checks 2,880 defense-position cases across 18 scopes. Source control totals in the tests should be updated deliberately when the supplied period changes.

The eight active chart-model checks cover all 160 team-position values, always-ALL positional stacks without double-counting, exact dumbbell totals and bounds across all positions and venues, sorting, four actual-FPA bands independent of expectations, endpoint-label sides, zero/equal/missing expectations, 96 unique game dots per position with opponent logos aligned to 32 defense spokes, and venue filtering. A separate player-filter check covers the one-point boundary and unchanged scoring totals. Libraries are bundled locally at amCharts 5.20.8; their original license and built-in attribution are retained.

Browser and visual checks are user-owned. No preview is opened as part of delivery. The new chart designs, formulas, and library sources are documented in `docs/2026-chart-lab.md`. Earlier implementation notes are in `docs/2026-refinement.md`; `docs/2026-rebuild.md` records the superseded first rebuild.
