# FPF source migration — 2026 Weeks 1–3

The app now uses `DH-FPA/data/FPF.csv` for season matchup summaries and the replacement `DH-FPA/data/FPAv2.csv` for players and individual weekly games. FPAv2 is the supplied `2026-Wkly - FPA (2).csv` copied under the requested existing filename, byte for byte. FPF.csv is the corrected supplied `2026-Wkly - FPF.csv`, also copied byte for byte. TSUMS.csv and its parser, opponent-average accumulation, offense-rank lookups, and source-reconciliation code have been removed.

## Direct field mapping

`TM` is the defense in FPF. For each QB/RB/WR/TE/ALL:

| Suffix | Meaning | App use |
| --- | --- | --- |
| none | Actual FPA total | Defense summary, scatter points, dumbbell actual endpoint |
| x | Actual FPA average | Summary average, heatmap, positional stack segments and ALL label |
| rk | Actual FPA rank | Summary, heatmap, scatter actual rank |
| vs | Expected FPA total | Summary, scatter points, dumbbell expected endpoint |
| vX | Expected FPA average | Summary average and chart tooltips |
| vRK | Expected FPA rank | Scatter expected rank |

The parser normalizes header casing without changing numeric values. Totals, averages, and ranks are independent source fields; none is replaced by a calculation from another field. In FPF, rank 1 means the highest FPA. Published ties and rank values are preserved, even when their order cannot be recovered from rounded totals. Tough/easy colors continue to show lower allowed scoring as tougher.

FPF's w1/w2/w3 columns identify the opposing offense for each supplied week. The bundler checks these links against FPAv2 and requires the two files to cover the same weeks and all 32 defenses.

## Weekly views and unsupported splits

FPAv2 supports both `WK` and the legacy `WEEK`; if both are supplied, conflicting values are rejected. The `VS` prefix determines the player's venue and the opposite defense venue. Optional `VS_TM` does not replace that authority.

Weekly bars, opponent rows, player tables, and polar game dots retain exact FPAv2 scores, including zeros and negatives. The player filter still starts by hiding scores below one point and does not change scoring aggregates.

FPF contains no per-game expected score, individual offense rank, or home/away expected split. The weekly expected line is retained: each game uses the opposing offense’s season-to-date positional average reconstructed from FPAv2 player results, with one observation per offense-game. It does not require a precomputed per-game expectation column. Venue filters select which games appear while preserving those opponent season averages. Missing baselines remain gaps; zero and negative scoring are included. Opponent-rank/expected/difference table columns and the polar expected tooltip remain removed. The W4 display-only placeholder remains. Venue-filtered actual charts use FPAv2; expected scatter/dumbbell comparisons show an explicit unavailable state. Partial-week model scopes also cannot allocate FPF expectations. All-games summary views use FPF.

Venue-only actual ranks retain the existing ascending competition order, where 1 means the fewest allowed points. The heatmap note and color direction follow the active source. Full-season ranks retain FPF's supplied descending order.

## Source receipt

| Source | SHA-256 |
| --- | --- |
| Updated FPAv2.csv | `f6c8f4352e2464e10391675f35e25c0d9d669e76a8d29feb73edfbab094736a9` |
| FPF.csv | `90aa6354d57dd1e2897d329d5475f1ff0ecebc83aec957aa3a6bb88dd162368f` |

FPAv2 has 1,255 rows: 1,233 matched player results and 22 with no opposing defense. There are 471 zero scores and 12 negative scores. Assigned totals are **7,677.18** across 96 defense-game observations and 48 matchups. Weekly totals are **2,624.88**, **2,420.90**, and **2,631.40**.

FPF has 32 unique team rows and all 30 required numeric fields populated. All 96 opponent links match the replacement weekly file. All 160 actual totals agree with weekly sums within FPF's one-decimal rounding.

The corrected FPF changes only WRvs, WRvX, and WRvRK, each for all 32 teams. These values now replace the incorrect WR expectations throughout the summary, scatter, dumbbells, and chart tooltips. For example, BAL WR expected scoring is 107.8 total, 35.9 per game, rank 4. FPAv2 and all other FPF fields are unchanged.

Seven teams have a 0.1 difference between the sum of rounded position averages and the supplied ALL average. Stacked segments use the position averages and the total label uses ALLx independently.

## Focused verification

The existing data/chart suites contain 50 checks covering source integrity, all 960 FPF metric values, parser aliases, missing/zero values, rank preservation, source checksums, player filters, stack values, dumbbell sorting/gradients/bounds, and polar opponent logos/spoke alignment. All passed. Independent Python CSV/Decimal/Fraction reconciliation passed for 2,880 weekly defense-position cases across 18 scopes, 960 FPF values, and 96 opponent links. Browser and visual acceptance remain user-owned; no preview was opened.

Reproduce with:

```sh
node scripts/sync-data.cjs
node --test tests/data-model.test.cjs tests/chart-lab-model.test.cjs tests/chart-utils.test.cjs
python3 tests/reconcile_source.py
```

The generated `2026-weekly.js` stores both source CSVs with checksums for direct-file and hosted use. Changed application/data script query versions are bumped together to prevent a cached old source bundle from being paired with the new parser.
