# 2026 matchup chart designs

The four amCharts views sit below the original dashboard. The original controls, weekly chart, players, expected-versus-actual scatter, opponent table, heatmap, and scoring model remain in place. Chart headers now include position bars; the scatter is taller and Players faced hides zero scores by default. New presentation is scoped to `.chartLab`. All views consume the existing analysis and share defense, position, and defense-venue selection.

## Positional scoring bars

The sunburst has been replaced with horizontal stacked bars for all 32 defenses. In ALL mode, four segments show each defense's original QB/RB/WR/TE FPA per game. Their sum reconciles to ALL FPA/game for the supplied all/home/away scopes; ALL is never added as a fifth segment. Choosing one position isolates its scoring across every team. Teams are ordered by the displayed FPA/game, from highest to lowest, with alphabetical ties. The zero baseline and outward-rounded bounds support direct length comparisons.

Position colors come from the amCharts palette and use gradients within each segment. The selected defense has brighter segments and a light border. The bar-end label is the exact displayed FPA/game rounded to two decimals; tooltips show the position, scoring, original rank, expected average, and games. Selecting a segment updates the dashboard defense and position. Zero values remain zero, with no invented minimum bar length; the end label and selected-team readout retain them. The 860px canvas gives every team a separate row, with a 580px minimum width and horizontal scrolling on small screens.

## Actual-versus-expected dumbbells

The parallel-coordinate chart has been replaced with a horizontal dumbbell comparison. Each of the 32 rows pairs the actual FPA total and the expected total for the selected position over exactly the same games, using the same values as the original points-mode scatter. A hollow light ring marks expected scoring; a smaller filled dot marks actual scoring. Equal values remain concentric, with the expected ring visible around the actual dot. Zero expectations remain valid values; incomplete expectations remain unavailable.

The connector's geometry runs from the smaller value to the larger value. Its gradient always brightens toward the actual endpoint: blue on the left for below expectation, rose on the right for above expectation, using the native amCharts palette. Endpoints are separate series tied explicitly to actualTotal and expectedTotal, so changing direction cannot swap their meanings. The right-hand label is actual minus expected, in points. Rows are sorted by this difference from most below to most above expectation, with alphabetical ties. Axis bounds include both endpoint values and round outward to multiples of 10. Tooltips/readouts include both totals, the difference, and the game count. Selecting a connector, endpoint, or label selects that defense. The canvas is 860px tall with a 600px minimum width.

## Position controls and page defaults

All seven charts have accessible QB/RB/WR/TE/ALL bars at the top right of their headers. They use the existing shared selection handler and synchronized aria-pressed states, including the original toolbar and expanded-player controls. The heatmap keeps all five position columns while highlighting and sorting by the selected position. New headers wrap at narrow widths; canvases retain their minimum readable widths inside their existing horizontal scroll containers. The two-column desktop chart section becomes one column below 1100px.

The original expected-versus-actual scatter is twice its previous height: 452px above the mobile breakpoint and 440px at 620px and below. Independent points-axis bounds and the existing ranks mode remain intact. Hide zeros starts checked in both Players faced views; it affects only visible player records, never scoring totals or chart values.

## Opponent-adjusted bullet ranking

All 32 complete comparisons are ordered from greatest scoring suppression to least. Each row is a bullet graph: the colored horizontal bar is actual FPA/game; the pale track and white threshold are the expected scoring of the opposing offenses. A dashed vertical guide marks the weighted league offense baseline. The right-hand badges show suppression and offense strength. Actual and expected values, game count, and adjusted rank appear in the tooltip and selected-team readout.

```
expected total = sum(each opposing offense's supplied TSUMS positional average once per game)
league baseline = sum(TSUMS position average × offense games) / sum(offense games)
suppression (%) = 100 × (1 − actual total / expected total)
opponent strength (%) = 100 × (expected FPA/game / league baseline − 1)
```

Rank 1 is the smallest actual-to-expected ratio, with competition ties (1, 1, 3). A defense allowing 10 against a 30-point baseline ranks tougher than one allowing 5 against a 5-point baseline. Stronger opponent scoring produces a longer expectation track and a positive offense-strength badge. Expectations remain position- and venue-specific. ALL uses supplied ALLx directly. Missing or nonpositive baselines remain unavailable. The FPA axis fits the actual and expected values outward to multiples of 10 and includes zero.

Only the supplied FPAv2 and TSUMS data are used. These are opponent-adjusted comparisons from the three-week sample; TSUMS averages include games against the selected defense. The chart's methodology disclosure makes this limitation explicit.

## Aligned polar matchup scatter

The chart keeps the user-adjusted two-column desktop layout, 700px canvas height, and 600px minimum width. At 1100px and below the panels stack and its canvas is 850px tall. A 98% radar radius uses the available chart area. Smaller markers use 5.2px circles and 8px logos; selection increases these to 6.5px and 9px. Each marker logo identifies the opposing offense (the source entry's offense), while its category, spoke, score, tooltip defense, and click selection still identify the defense that allowed those points. Original scatter fills, positional selection colors, and defense-rank ring colors are retained. Week rings are solid, dashed, and dotted.

Category labels, grid spokes, ticks, and every game bullet all use category location **0.5**. Each defense's three games therefore lie on exactly its label's spoke, at the angle `-90 + (team index + 0.5) × 360 / 32`. Week has no effect on angle. Radius is the game's actual positional FPA, including zero and negative values, with no score jitter. Bounds fit the data outward to multiples of 10 and include zero.

All-games mode contains 96 distinct team-week observations for each selected position. Home/away filtering retains all 32 spokes and includes the 48 matching game observations. Each tooltip identifies the defense, opposing offense, week, actual score, and expected baseline, then lists every recorded game on that spoke. Equal scores occupy the same location truthfully and remain identified in the tooltip/readout. The selected defense has a highlighted spoke and center label.

## Implementation and verification

Charts initialize near the viewport and keep their roots through selection changes. Roots dispose on page exit and rebuild after back-forward-cache restoration. Panel errors are isolated from the original dashboard. Tooltips and chart titles are rendered through amCharts APIs. Animated and Dark themes are applied, reduced-motion interpolation is disabled, and library attribution remains intact. No exporting, upload, download, or week-range control is introduced.

The locally bundled, unchanged amCharts 5.20.8 core, XY, radar, Animated, and Dark files have SHA-256 provenance and the original license in `DH-FPA/vendor/amcharts5/`. The page no longer loads hierarchy.js because neither replacement uses it; its vendored file remains intact.

Ten focused model tests passed, covering all 160 original team-position values, positional bar sums, exact dumbbell totals across five positions and three venues, zero/equal/missing expectations, 96 game dots per position with exact opponent logos and spoke alignment, venue filtering, supplied baselines, opponent-adjusted ordering, competition ties, and unavailable expectations. JavaScript syntax and source preservation are checked separately. Browser interaction and visual checks remain user-owned; no preview was opened.

Primary implementation references:

- [Supplied amCharts skill](../.agents/skills/amcharts5-skill-main/amcharts5-skill/SKILL.md), particularly XY and radar references
- [Official stacked bar demo and source](https://www.amcharts.com/demos/stacked-bar-chart/)
- [Official horizontal dumbbell demo and source](https://www.amcharts.com/demos/dumbbell-plot/)
- [Column series](https://www.amcharts.com/docs/v5/charts/xy-chart/series/column-series/)
- [Official bullet chart demo and source](https://www.amcharts.com/demos/bullet-chart/)
- [Line series](https://www.amcharts.com/docs/v5/charts/xy-chart/series/line-series/)
- [Radar axes](https://www.amcharts.com/docs/v5/charts/radar-chart/radar-axes/)
- Pinned library definitions for category-coordinate placement, default colors, and bullet factories
