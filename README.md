# 2026 Matchup Explorer

The static site lives in `DH-FPA/index.html`. Its only scoring source is the supplied **2026-Wkly - FPA.csv**, covering Weeks 1–3. Existing historical CSVs remain in the repository but are not loaded by the app.

Run a local preview from this repository:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory DH-FPA
```

Open `http://127.0.0.1:8765`. You can also open `DH-FPA/index.html` directly: the generated local source snapshot supports `file://` without a server or internet connection. Fonts, icons, charts, and CSV parsing need no CDN dependencies.

## Views and controls

- Shared position, season/recent/individual/custom week-range, and **defense** venue filters.
- Defense profile with FPA/game, rank, weighted league comparison, weekly positional totals, and game samples.
- Sortable, selectable 32-defense matchup heatmap.
- Season/recent scatter at exact data coordinates, with points/rank modes and keyboard-accessible defense selection.
- Easiest/toughest matchups and increasing/decreasing points allowed in the recent window.
- Searchable, sortable player results, expanded results, and a player-score plot. Zero and negative results are shown by default. Hiding zeros affects the displayed player records only.
- CSV exports of the current rankings, filtered player results, and original source.
- Source audit, excluded records, and calculation explanations under **Data & updates** and **How these numbers work**.

Selections are reflected in the URL so a defense/position/range/venue can be linked. The recent window defaults to two calendar weeks, currently Weeks 2–3. It can be changed to any available span.

## Updating the data

For browser-local exploration, choose **Data & updates → Choose a 2026 weekly CSV**. Upload one complete season-to-date file. Validation runs before it replaces the current results. Uploads persist in that browser when local storage is available; **Restore bundled data** clears the override. Uploads do not modify this repository or a deployed site's data.

Required columns are `WEEK`, `PLAYER NAME`, `POS`, `FPT_PPR`, and `VS`. `SLPR_ID` and `TM` are used when present for player identity, offense labels, and matchup validation. `AGE` and `PRK_PPR` are preserved in the source but do not enter FPA calculations. PPR scores support up to two decimal places, including zero and negatives. Positions are QB, RB, WR, TE. The file has no season column, so the upload flow is explicitly for 2026 exports.

To update the default data for every visitor:

1. Replace `DH-FPA/data/2026-Wkly - FPA.csv` with the updated 2026 season-to-date CSV.
2. Run `node scripts/sync-data.cjs` to regenerate `DH-FPA/data/2026-weekly.js`.
3. Run the verification commands below, then publish through the project's chosen hosting workflow.

The synchronization script validates the CSV and stores its SHA-256 checksum in the offline snapshot. The tests reject a snapshot that differs from the source. HTTP previews prefer the CSV itself; direct-file use reads the matching snapshot. If HTTP source loading fails, the app labels the snapshot fallback visibly.

## Calculations

`VS` supplies the opposing defense. `vs TB` means TB's defense was **away**; `@ NYG` means NYG's defense was **home**. `TM` is the player's offense, not the defense.

All assigned player points are summed by defense, position, and week. FPA/game divides those totals by observed games that have records for the position. Multiple players count as one game. A recorded zero is included; an absent week or position is unavailable. Total FPA requires all four positions in a game. Incomplete samples are shown with their eligible counts.

League averages weight observed defense games equally. Ranks use unrounded averages, with 1 meaning fewest points allowed and higher ranks meaning more. Ties use competition ranks (1, 1, 3). Rank changes are withheld when the rated defense counts differ between windows. Recent-versus-season changes compare overlapping samples and describe recorded scoring; no outside schedules, projections, or historical values are used.

Supplied-data controls: 1,249 source rows, 1,227 assigned results, 22 without an opponent, 471 assigned zero scores, 12 negative scores, 48 unique matchups, 96 defense-game observations, and **7,597.14** assigned PPR points.

## Verification

```sh
node --test tests/data-model.test.cjs
python3 tests/reconcile_source.py
```

The independent reconciliation reads the CSV separately using Python's CSV, Decimal, and Fraction libraries. It compares every defense/position total, game count, unrounded average, competition rank, and weighted league average across 18 week/venue combinations. The unit suite also covers missing positions, zero-only games, negative scores, unequal samples, future-week detection, CSV parsing, duplicates, invalid input, and snapshot identity.

The audit and implementation plan are in `docs/2026-rebuild.md`.
