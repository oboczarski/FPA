# 2026 matchup chart designs

The four amCharts views sit below the original dashboard. The original controls, weekly chart, players, expected-versus-actual scatter, opponent table, heatmap, scoring model, and styles remain in place. New presentation is scoped to `.chartLab`. All views consume the existing analysis and share defense, position, and defense-venue selection.

## Scoring-composition sunburst

A Sunburst hierarchy has 32 ALL parent nodes and 128 QB/RB/WR/TE children. Each child's value is its original FPA/game; each parent is the sum of its four children. ALL is not added again as a fifth leaf. For the provided all/home/away scopes, those four averages reconcile to the original ALL average. The inner ring represents team totals; the outer ring shows the positional contributions to those totals. Larger angular spans mean more scoring allowed.

Position colors are consistent across every team and come from the amCharts palette. Team totals use the same palette's team colors. The selected defense has a bright edge on its inner and outer branches and an ALL readout in the center. Tooltips contain exact averages, ranks, expectations, and game counts. Selecting a branch updates the original team/position controls while all 32 teams remain visible; drill-down is disabled. A zero-valued source node remains zero and has no invented angular area. Its value remains available in the team readout and positional profile.

## Parallel-coordinate defensive profiles

The chart has five vertical positional rank axes: QB, RB, WR, TE, and ALL. A continuous line connects each of the 32 defenses' original FPA/game ranks across those axes. Rank 1 is at the top. All 160 observations retain their exact ranks, including ties; neither ranks nor averages are jittered.

The selected profile is thicker and shows its rank and FPA/game at every vertex. Hover traces a profile through the other lines; selecting a vertex updates the corresponding team and position. Team logos and labels mark the ALL endpoints, and 32 compact team buttons provide another way to select overlapping profiles. The focus toggle dims other profiles while retaining their data. This view exposes teams whose matchup difficulty differs sharply between positions.

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

The chart occupies a full-width panel. Its canvas is 900px tall on desktop and 850px at narrower widths, with an 800px minimum width so the circle retains its size instead of shrinking into a crowded mobile panel. A 98% radar radius uses the available chart area. Smaller markers use 5.2px circles and 8px logos; selection increases these to 6.5px and 9px. Original scatter fills, positional selection colors, and defense-rank ring colors are retained. Week rings are solid, dashed, and dotted.

Category labels, grid spokes, ticks, and every game bullet all use category location **0.5**. Each defense's three games therefore lie on exactly its label's spoke, at the angle `-90 + (team index + 0.5) × 360 / 32`. Week has no effect on angle. Radius is the game's actual positional FPA, including zero and negative values, with no score jitter. Bounds fit the data outward to multiples of 10 and include zero.

All-games mode contains 96 distinct team-week observations for each selected position. Home/away filtering retains all 32 spokes and includes the 48 matching game observations. Each tooltip identifies the defense, opposing offense, week, actual score, and expected baseline, then lists every recorded game on that spoke. Equal scores occupy the same location truthfully and remain identified in the tooltip/readout. The selected defense has a highlighted spoke and center label.

## Implementation and verification

Charts initialize near the viewport and keep their roots through selection changes. Roots dispose on page exit and rebuild after back-forward-cache restoration. Panel errors are isolated from the original dashboard. Tooltips and chart titles are rendered through amCharts APIs. Animated and Dark themes are applied, reduced-motion interpolation is disabled, and library attribution remains intact. No exporting, upload, download, or week-range control is introduced.

The locally bundled, unchanged amCharts 5.20.8 core, XY, radar, hierarchy, Animated, and Dark files have SHA-256 provenance and the original license in `DH-FPA/vendor/amcharts5/`.

Nine focused model tests passed, covering all 160 original team-position values, all 32 sunburst totals and 128 leaves, unshifted profile ranks, 96 game dots per position and exact spoke alignment, venue filtering, supplied baselines, opponent-adjusted ordering, competition ties, and unavailable expectations. JavaScript syntax and source preservation are checked separately. Browser interaction and visual checks remain user-owned; no preview was opened.

Primary implementation references:

- [Supplied amCharts skill](../.agents/skills/amcharts5-skill-main/amcharts5-skill/SKILL.md), particularly hierarchy, XY, and radar references
- [Official sunburst demo and source](https://www.amcharts.com/demos/sunburst-chart/)
- [Sunburst configuration](https://www.amcharts.com/docs/v5/charts/hierarchy/sunburst/)
- [Official bullet chart demo and source](https://www.amcharts.com/demos/bullet-chart/)
- [Line series](https://www.amcharts.com/docs/v5/charts/xy-chart/series/line-series/)
- [Radar axes](https://www.amcharts.com/docs/v5/charts/radar-chart/radar-axes/)
- Pinned package class definitions for category-coordinate placement, hierarchy nodes, labels, and bullet factories
