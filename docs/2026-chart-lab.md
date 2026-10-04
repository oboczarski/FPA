# 2026 matchup chart layout and styling

The page has one desktop grid with these direct children in reading order:

| Row | Left | Right |
| --- | --- | --- |
| 1 | Defense summary, weekly scoring, Players faced | Original expected-versus-actual scatter and offenses faced |
| 2 | Positional stacked scoring bars | Matchup heatmap |
| 3 | Actual-versus-expected dumbbells | Polar matchup scatter |

At 1100px and below the panels stack in that order. The user's overall 640px chart-body heights for stacked bars and dumbbells are retained, including the headings and legends moved out of the canvas. Their minimum canvas widths remain 630px. The polar chart body keeps its 700px desktop / 850px narrow-screen height and its 600px minimum canvas width. Canvas regions fill the remaining space within these bodies, avoiding extra panel height from the HTML headings. These remain editable in chart-lab.css. The bullet-ranking panel, renderer, readout, and unused suppression calculations have been removed.

## CSS text styling

Headings, subheadings, legends, the focus button, footnotes, and selected-team readouts are real HTML. Style them directly with .labTitle, .labSubtitle, .labCaption, .labLegend, .labFocusButton, .labFootnote, and .labReadout. The heading and caption inset is --lab-heading-inset: 32px, reduced to 20px on mobile. Their alignment no longer depends on canvas coordinates.

amCharts draws its remaining text on canvas. The chart reads the following CSS properties and applies them through amCharts label settings. Set them on .chartLab for all charts or on #labBreakdownPanel, #labDumbbellPanel, or #labPolarPanel for one chart. Use px for sizes, supported font-weight strings/numbers, and hex or RGB colors.

| Text | CSS properties |
| --- | --- |
| All canvas text | --am-font-family |
| Numeric axes | --am-axis-font-size, --am-axis-color, --am-axis-font-weight |
| Team axes | --am-team-font-size, --am-team-color, --am-team-font-weight |
| Scoring and Δ labels | --am-label-font-size, --am-label-color, --am-label-font-weight |
| Selected text | --am-selected-text-color, --am-selected-font-weight |
| Tooltips | --am-tooltip-font-size, --am-tooltip-color, --am-tooltip-font-weight, --am-tooltip-background, --am-tooltip-border, --am-tooltip-line-height |
| Polar center | --am-center-font-size, --am-center-team-font-size, --am-center-detail-font-size, --am-center-color, --am-center-font-weight |

Example:

```css
#labDumbbellPanel {
  --am-label-font-size: 11px;
  --am-label-color: #e3edff;
  --am-team-font-weight: 600;
}
#labPolarPanel .labTitle { font-size: 21px; }
.chartLab { --lab-heading-inset: 36px; }
```

The page detects inline style/class changes on chart panels, page-level class changes, stylesheet-element changes, and responsive font changes on resize. CSS file edits take effect on reload. After editing a stylesheet rule in DevTools without changing an element attribute, call window.FPAChartLab.refreshStyles() to re-read computed properties. A chart is recreated only when its canvas text settings change; its defense, position, venue, and focus state are retained. DOM text responds to CSS directly.

## Always-ALL positional stacks

All 32 defenses have one horizontal bar. Four segments preserve their QB/RB/WR/TE FPA per game and reconcile to ALL for every supplied venue scope. ALL is never added as a fifth segment. The view always shows all four positions, regardless of the dashboard position, and has no position filter. It still follows defense venue, highlights the selected defense, and allows a segment to select its team and position in the rest of the dashboard.

Teams sort by ALL FPA/game from highest to lowest, with alphabetical ties. End labels show ALL scoring to two decimals. Tooltips preserve each position's exact average, original rank, opponent expectation, and game count. Zero values keep their real zero length. No source or scoring aggregate changes.

## Dumbbells

Each team pairs actual FPA total with expected FPA total over the same selected position/game/venue scope, exactly matching the original scatter values. The hollow ring is expected; the filled dot is actual. Teams sort by actual FPA from highest to lowest, with alphabetical ties.

Both endpoints have a scoring label: the lower value's label sits to its left, the higher value's label to its right. Equal values remain concentric, with expected labeled left and actual right. Endpoint and Δ labels default to 8px, controlled by --am-label-font-size on #labDumbbellPanel, and round to one decimal place. Axis bounds include both endpoint values: minimum is the lowest minus 15 points, maximum is the highest plus 20 points, with no additional rounding or proportional gutter. For endpoints spanning 32.4–76.2, the domain is 17.4–96.2. Bounds update with position and venue. The Δ column shows actual minus expected; full endpoint values remain in tooltips and the selected-team readout.

Four distinct native-palette gradients follow actual-FPA order:

- Highest quarter: deep rose to pink.
- Second quarter: magenta to lavender.
- Third quarter: blue to sky.
- Lowest quarter: sky to mint.

Each quarter covers eight rows with the current 32-team cohort, giving two treatments in each half of the chart for every position/venue. Classification is based on descending actual-FPA order, with alphabetical ties; a tie can cross a band boundary. Changing an expectation without changing actual scoring does not change the band. Each treatment has three stops derived from the native palette, with darkened and brightened endpoint colors and stronger opacity. Gradient direction reverses when actual is the left endpoint, so it always brightens toward actual scoring. Connectors stay 4px thick; selection changes opacity, never thickness. Zero/equal endpoints stay valid; missing expectations remain unavailable. Endpoint series are explicitly bound to actualTotal and expectedTotal, so their meanings never swap with direction.

## Polar matchup scatter

All 32 defense labels, grid spokes, ticks, and per-game bullets use category location 0.5. Every defense's games lie at exactly its label's angle, with radius representing actual positional FPA. The opponent logo identifies the offense that scored the points; the category, tooltip defense, and click selection identify the defense that allowed them. No angle or scoring jitter is introduced.

Markers are slightly larger: normal circle radius 7.3px with 11.5px opponent logos; selection uses radius 8.6px and 13px logos. Solid/dashed/dotted rings distinguish weeks. The radar radius remains 98%. All-games mode includes 96 dots per position; venue filtering preserves 32 spokes and includes the 48 matching dots. Equal scores share their true location and remain identifiable in tooltips/readouts. The HTML focus button dims the other teams.

## Original chart sizes and player filtering

The weekly chart is 196px tall, up from 156px. The original scatter is reduced from 452/440px to 330px desktop / 320px mobile; independent data-driven axis bounds and points/ranks modes remain intact.

Offenses faced appends a W4 layout placeholder with a neutral logo outline and dashes for rank/expected/actual/difference. It uses the existing row sizing and is omitted if the selected scope has a real Week 4 entry. This row exists only in the table's HTML: no fabricated game, offense, or score enters the source, aggregates, charts, ranks, or week controls.

Hide <1 point starts checked in both Players faced views. It excludes zero, fractional, and negative scores below one PPR point, retaining exactly 1.00 and above. Unchecking restores the full recorded player list. Filtering uses integer cents and never changes actual FPA, expected FPA, ranks, or game counts.

## Implementation and verification

Only the supplied FPAv2 and TSUMS data are used. Expectations add each opposing offense's supplied positional average once per observed game. The bundled amCharts 5.20.8 core, XY, radar, Animated, and Dark libraries retain their original license, attribution, and SHA-256 provenance. Charts initialize near the viewport, dispose on page exit, and rebuild after back-forward-cache restoration. No upload, export, or week-range controls are introduced.

Eight focused chart-model tests cover source preservation, all team/position values, invariant ALL stacks, exact actual/expected totals and 15/20-point bounds across all positions and venues, four actual-FPA bands independent of expectation, descending actual-FPA ordering, endpoint sides including ties, zero/missing expectations, opponent logos, and spoke alignment. The separate player-filter check was unchanged in this refinement. Browser and visual checks remain user-owned; no preview was opened.

Primary implementation references:

- [Supplied amCharts skill](../.agents/skills/amcharts5-skill-main/amcharts5-skill/SKILL.md)
- [Official stacked bar demo](https://www.amcharts.com/demos/stacked-bar-chart/)
- [Official dumbbell demo](https://www.amcharts.com/demos/dumbbell-plot/)
- [Gradients](https://www.amcharts.com/docs/v5/concepts/colors-gradients-and-patterns/gradients/)
- [Color brightening](https://www.amcharts.com/docs/v5/reference/color/)
- [Text styling](https://www.amcharts.com/docs/v5/concepts/formatters/text-styling/)
- [Radar axes](https://www.amcharts.com/docs/v5/charts/radar-chart/radar-axes/)
