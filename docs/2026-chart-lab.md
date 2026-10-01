# Additive amCharts views for 2026 matchups

The four charts sit below the existing dashboard. Existing controls, summary, weekly chart, players, scatter, opponent table, and heatmap are preserved. The only change to the existing app renderer publishes its current analysis and selection to the new views. Styles are scoped to `.chartLab`; the original stylesheet and scoring model are unchanged.

## Chart choices

1. **FPA bubble board:** a category-by-category XY chart shows all 32 defenses across QB, RB, WR, TE, and ALL: 160 cells. Each cell labels actual FPA/game. Bubble area grows with the defense's positional FPA/game rank, so larger means easier. Normalizing size within each position keeps higher-scoring positions from overwhelming the others. The selected defense is highlighted across all five rows. The design follows the official bubble-based heat-map demo, with soft radial fills, position-colored row bands, selected halos, and a persistent numeric readout.
2. **Position raceways:** five horizontal lanes place every defense logo at its exact FPA/game rank, with toughest on the left. This replaces table scanning with direct positional ordering while keeping all 160 observations. Ties share the same horizontal coordinate and fan vertically; the data never gets jittered into a false rank. The selected team has a halo and abbreviation. The bubble board provides values; the raceways emphasize ordering. Both stay wide enough to retain every team and scroll horizontally on smaller screens.
3. **Opponent-adjusted toughness:** a quadrant scatter separates schedule difficulty from scoring suppression. The horizontal axis measures opponents' positional offense strength relative to the league. The vertical axis measures how far a defense held its opponents below their supplied expected scoring. The upper-right region contains defenses that held stronger offenses below baseline. Logo tooltips and the selected-defense readout show actual and expected FPA/game as well as both percentages. Three leader chips rank suppression. A native amCharts focus toggle dims other defenses while retaining every observation.
4. **Matchup orbit:** a polar scatter has 32 team sectors ordered by the existing AFC/NFC division groups. Each observed defense-game is a separate logo bullet. Radius is actual game FPA; clockwise slots within each sector identify weeks without changing the scoring value. All-games mode contains three dots per defense, 96 total, for each selected position. Venue selection filters the games while retaining all 32 sectors. Alternating division washes, dashed radial guides, a selected-team center label, game readout, and focus toggle support exploration. Logo size, circle radius, fill, rank ring, and selected-position ring match the existing scatter.

The category matrix and rank lanes keep the flat team-by-position data visible without suggesting a hierarchy, flow, or additive positional total that the source does not define. RadarLineSeries supplies the polar coordinates, with connecting strokes hidden as in the official polar-scatter example.

## Source and calculation contract

The new views read the existing analysis of **FPAv2.csv** and **TSUMS.csv**. No new football source, inferred player result, or replacement offense average is introduced. They share the original page's defense, position, and defense-venue selection. Player search and zero-score visibility still affect the player table only. Selecting a bubble or logo updates the original page's team and position controls; changing only the defense updates highlights without recreating chart roots.

Actual totals, averages, game counts, and positional ranks come directly from the existing analysis. Expected scoring remains the sum of each opposing offense's supplied positional TSUMS average once per eligible game. ALL uses ALLx directly. Incomplete comparisons remain unavailable.

For each selected position and venue:

```
league baseline = sum(TSUMS position average × offense games) / sum(offense games)
opponent strength (%) = 100 × (expected FPA/game / league baseline − 1)
suppression (%) = 100 × (1 − actual FPA total / expected FPA total)
```

Only finite supplied offense averages with positive game counts enter the league baseline. Toughness comparisons require a positive expected total and league baseline. Higher suppression means opponents scored a smaller fraction of their expected points. Suppression ranks use competition ties: 1, 1, 3. For example, allowing 10 against a 30-point baseline represents more suppression than allowing 5 against a 5-point baseline, despite having a higher raw FPA. Schedule strength remains visible on its own axis rather than being hidden inside an unexplained combined score.

This is an opponent-adjusted comparison over the supplied three-week sample. TSUMS averages include the offense's results against the selected defense. It is not an independent estimate of defensive ability. The chart includes this explanation in its own expandable methodology.

Each polar dot is a recorded game's actual positional total, including zeros and negatives. There is no averaging of game dots and no radial jitter. Week slots are equally spaced inside each team's sector. The radial axis fits the data outward to multiples of 10 and includes zero. The toughness axes independently fit their data and include the zero reference lines. Existing scatter scales and rank behavior are untouched.

## Presentation and lifecycle

The added section uses compact glass panels, subtle blue/violet background lighting, gradient edge accents, canvas chart titles, dark tooltips, and numeric readouts. Chart data colors come from amCharts' default palette; polar markers reuse the existing scatter's colors as requested. The charts apply Animated, Dark, and a local neutral UI theme. Reduced-motion preferences disable interpolation. Markers support focus, hover tooltips, and selection. Wide charts expose keyboard-focusable horizontal scroll areas on small screens.

Roots initialize when their panels approach the viewport. Existing charts render before the local amCharts scripts bootstrap. Roots persist through selection changes and dispose on page exit; back-forward cache restoration reinitializes them. Each panel catches its own initialization errors. No upload, download, exporting plugin, or new week-range control is added.

## Library and documentation

amCharts **5.20.8** browser bundles are vendored locally, unchanged, with original LICENSE and SHA-256 provenance in `DH-FPA/vendor/amcharts5/`. Built-in amCharts branding is retained. No CDN connection is required to render the new charts after the page loads from this repository.

The supplied [amCharts skill](../.agents/skills/amcharts5-skill-main/amcharts5-skill/SKILL.md) and its XY, radar, hierarchy, flow, timeline, pie, and UI references informed the design selection. Implementation details were checked against these primary sources and the pinned package's class definitions:

- [Bubble-based heat map demo and source](https://www.amcharts.com/demos/bubble-based-heat-map/)
- [Polar scatter demo and source](https://www.amcharts.com/demos/polar-scatter/)
- [Radar chart guide](https://www.amcharts.com/docs/v5/charts/radar-chart/)
- [Bullets guide](https://www.amcharts.com/docs/v5/concepts/common-elements/bullets/)
- [Images guide](https://www.amcharts.com/docs/v5/concepts/common-elements/images/)
- [Axis ranges guide](https://www.amcharts.com/docs/v5/charts/xy-chart/axes/axis-ranges/)

## Verification boundary

The seven focused model tests check all 160 cells against the original analysis; 96 unique game dots and their sums for every position; venue scope; weighted TSUMS baselines including ALLx; stronger-opponent suppression ordering; tied ranks; and missing/zero baselines. Syntax and source checks cover the integration, local resources, library provenance, and preservation of the original dashboard. Browser interaction, visual layout, and mobile appearance remain user-owned; no preview was opened.
