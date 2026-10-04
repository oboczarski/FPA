# 2026 source contract — FPAv2, FPFA, and FPF

The active snapshot includes all three supplied CSVs. FPFA.csv is the renamed former corrected FPF defense-summary file. The current FPF.csv restores the offense scoring sheet previously called TSUMS. These are separate source roles, both required alongside the player-week file; replacing a defense summary must not remove opponent context.

## Field ownership

| Source | Team meaning | Fields and consumers |
| --- | --- | --- |
| FPAv2.csv | TM = offense; VS = defense and player venue | Player results and exact individual game actuals; venue filtering; weekly bars; polar dot radius |
| FPFA.csv | TM = defense | Position total/x/rk = actual total/average/rank; vs/vX/vRK = expected total/average/rank. All six fields independently preserved for full-season summary, scatter, heatmap, stacked bars, and dumbbells |
| FPF.csv | TM = offense | Position total/x/rk = offensive scoring total/published average/rank. Opponent averages and ranks for Offenses faced, weekly expected line, polar tooltips, and scoped expectations |

Both `WK` and legacy `WEEK` are accepted in FPAv2; conflicting aliases are rejected. Header casing is normalized in all sources. FPF requires no `G` column. Rank 1 in both published sheets means the highest scoring total. Supplied ranks, tied ranks, independent ALL fields, and rounded averages are never recalculated in the full-season view.

FPFA's w1/w2/w3 links must agree with FPAv2's defense-week opponents. The bundler requires all 32 defense summaries and all 32 offense summaries, validates period/opponent links, and stores the three raw CSVs and SHA-256 checksums together.

## Restored opponent context

Offenses faced has six columns again: Wk, Offense, Off. rank, Expected, Actual, and Δ FPA. Each recorded game uses the opposing offense's supplied FPF rank and average for the selected QB/RB/WR/TE/ALL position. Actual points sum every matching FPAv2 player score, including zero and negative scores; Δ is actual minus that opponent average. The W4 placeholder has six cells and never enters the analysis.

The weekly expected line and Game Spokes tooltips use those same published FPF averages. Expected markers retain the requested cyan/lavender fills and connecting gradient. Native SVG titles remain removed to prevent a second tooltip. The user's current scatter axis and zone labels are preserved exactly.

Home/away or partial-week comparisons sum FPF opponent averages once per eligible game. These baselines describe opponent season scoring quality, not offense home/away scoring splits. Scoped expected averages divide by the eligible game count; missing opponent averages leave the aggregate unavailable, while zero is valid. Scoped scatter ranks order comparable actual and expected totals descending (1 = highest). Venue heatmap/profile actual-average ranks retain ascending order (1 = fewest points allowed).

Full-season actual/expected values continue to come directly from FPFA. For BAL ALL, expected scoring is 275.5, not the 275.4 sum of rounded FPF opponent averages (70.6 + 109.7 + 95.1). Both supplied representations are retained for their respective views.

## Source receipt

| Source | SHA-256 |
| --- | --- |
| FPAv2.csv | `f6c8f4352e2464e10391675f35e25c0d9d669e76a8d29feb73edfbab094736a9` |
| FPFA.csv | `90aa6354d57dd1e2897d329d5475f1ff0ecebc83aec957aa3a6bb88dd162368f` |
| FPF.csv | `34574b605e9647417bd29f1d3c8e3615dd46652def95023cc949d19c519ecc00` |

FPAv2 has 1,255 rows: 1,233 matched results and 22 with no defense, including 471 zeros and 12 negative scores. Assigned points total 7,677.18 across 96 defense-games and 48 matchups in Weeks 1–3. Weekly totals are 2,624.88 / 2,420.90 / 2,631.40. All 160 FPFA actual totals and FPF offense totals agree with player sums within one-decimal source rounding. All 96 opponent links agree. Summed published opponent averages differ from FPFA expected totals by at most 0.1 after rounding.

## Focused verification

Data, geometry, chart-model, and app-renderer fixtures cover the three-source checksums, all 960 FPFA values, all 480 FPF offense values, parser validation, absent/zero baselines, filtered comparisons, player filters, endpoint/bounds/gradient preservation, and opposing-offense polar logos and context. The app fixture initializes the actual page code and checks the six-column table across all five positions and three venues, published season totals, and the user's exact axis/zone labels without opening a preview.

Independent Python CSV/Decimal/Fraction reconciliation checks 2,880 weekly defense-position cases across 18 scopes, 960 FPFA values, 96 opponent links, and every game baseline/rank against FPF, including scoped totals and ranks. Browser and visual acceptance remain user-owned.

```sh
node scripts/sync-data.cjs
node --test tests/data-model.test.cjs tests/chart-lab-model.test.cjs tests/chart-utils.test.cjs tests/app-data.test.cjs
python3 tests/reconcile_source.py
```

Changed application/data script query versions are bumped together to prevent a cached two-source snapshot from being paired with the three-source parser. No chart sizing, layout, palettes, position controls, or user-defined scatter labels are changed by this repair.
