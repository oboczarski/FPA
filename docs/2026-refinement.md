# October 1 refinement

## Scope and reference

Rebuild the current three-week experience on F-39 after the user's spacing/style/layout feedback. Read the user's padding commit (`2fe9801`) before editing. Reference the live DataHub page shell and Game Logs modal in DH-P3: page background at `DH_P2.53/styles/DataHub.css` lines 327–484, and modal/table treatments around lines 8958–9060 and 10790–11065. Read the corresponding `datahub.html` font and background structure. Keep all implementation in FPA; DH-P3 is a read-only reference.

## Product changes

- Replace the large intro and filter stack with a compact header and matchup selector.
- Use DataHub's layered blue/violet background, cyan/blue/violet accent gradient, Google Sans Flex/MuseoModerno type, and glass/bordered table surfaces with smaller spacing.
- Put the selected defense's player records directly below the weekly chart, within the same matchup panel.
- Replace recent/season scatter and trend lists with expected-versus-actual totals/ranks and an opponent offense context table.
- Retain position, defense-venue, table sorting/search, and expanded player results; add ALL selection using the supplied ALLx baseline.
- Remove file upload, download/export, source restoration, saved-upload loading, player scatter, week-range/recent selectors, and trend panels. Only the supplied source pair feeds the app.
- Use content-sized cards and capped table scrollers; do not stretch panels to fill unrelated card heights.

## Authoritative data

Preserve `FPAv2.csv` and `TSUMS.csv` byte-for-byte. FPAv2 adds Case Keenum's Week 3 CHI `vs PHI` row (24.48 PPR) to the original file. Updated audit: 1,250 source rows, 1,228 assigned results, 22 unassigned, 471 assigned zeros, 12 negatives, 96 defense games, 48 matchups, 7,621.62 total assigned points. Weekly assigned totals: 2,600.76; 2,410.46; 2,610.40.

TSUMS contains all 32 offenses with G=3. Use supplied position/ALL sums, ranks, and averages in their stated roles. JAX WR and ALL totals differ between sources: 110.60 / 242.04 in FPAv2 versus 102.4 / 233.8 in TSUMS. Keep actual scoring and baseline scoring independent; use WRx=34.1 and ALLx=77.9 as supplied. Disclose the difference without correcting either source.

## Expected FPA

For each eligible defense game, identify the opponent offense using the normalized weekly TM/VS matchup. Add that offense's supplied position average exactly once. Summing individual player records must not multiply the baseline. Expected and actual totals use the same games and venue. ALL uses ALLx rather than adding rounded positional averages. Incomplete baseline coverage produces an unavailable comparison, never an implicit zero or partial-season expectation.

Points scatter: x=expected total, y=actual total. Rank scatter: ascending competition ranks of these two totals within one common complete defense cohort. This is separate from supplied offense ranks, whose rank 1 means the highest offense scoring. Heatmap ranks remain based on actual FPA/game. No external schedule, projection, history, or scoring data is added.

Example: BAL QB opponents IND/NO/DAL supply averages 10.4/24.1/21.4. Expected total=55.9, actual=51.36, difference=-4.54. PHI's corrected QB actual total=62.16, including Keenum's 24.48.

## Verification and delivery

Run only bounded calculation and source checks: updated targeted unit suite, independent actual/expected reconciliation, source/snapshot identity, JavaScript syntax, HTML/JS control wiring, and Git whitespace. Browser/mobile/tablet visual testing and deployment checks are user-owned. Do not open a preview. Publish only the intended FPA files on the current F-39 branch.

Completed: all 33 unit checks passed; independent reconciliation passed for 2,880 defense-position cases across 18 scopes, including expected/actual totals, both scatter ranks, deltas, and weighted league averages. Source checks confirmed the player section follows the weekly chart, every literal JS control ID exists, removed flows have no HTML controls or runtime handlers, local resources exist, and both supplied CSVs remain byte-identical. JavaScript syntax and Git whitespace checks passed. No browser session or preview was opened.
