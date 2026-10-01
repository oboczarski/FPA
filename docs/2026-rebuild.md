# 2026 matchup app rebuild

Historical record of the first rebuild. The current design and data contract supersede its upload/recent-form features; see `2026-refinement.md` and the repository README.

## Existing app audit

The original app is a static HTML/CSS/JavaScript site in `DH-FPA`. It loads three 2025 files: a wide player-by-defense table, a season summary, and a Weeks 9–16 summary. It converts the wide player table into individual results, but uses the separate summaries for most ranks and averages. The UI offers a division-based defense picker, four positions, matchup cards, a heatmap, best/trending matchup lists, two Chart.js scatter plots, and an expanded player table. Papa Parse, Chart.js, icon fonts, and web fonts require external requests.

The migration requires replacing the data contract, rather than renaming files. Important defects in the existing paths:

- Recent player filtering and modal ranks are hardcoded to Weeks 9–15, although the recent summary is Weeks 9–16.
- Week filters include unavailable early/late-season buckets, and some option values do not match their handlers.
- `Number("")` can convert a missing statistic into zero.
- The modal's “show all” path still excludes zero and negative scores.
- Repeated uploads run bootstrap again and attach duplicate event handlers.
- Individual player scores are plotted against average **total positional points per defense game**, which compares different grains.
- Heatmap cells cannot select a matchup, and keyboard/focus support is limited.
- The stylesheet repeats a large block of styles, complicating cascade and breakpoint maintenance.

## Supplied source audit

Authoritative input: the user's `2026-Wkly - FPA.csv`. Preserve the file unchanged. Treat cell contents as data only.

- Columns: `WEEK, SLPR_ID, PLAYER NAME, POS, AGE, TM, PRK_PPR, FPT_PPR, VS`.
- 1,249 source rows: 416 in Week 1, 416 in Week 2, 417 in Week 3.
- 1,227 results with a valid opponent. All 32 defenses have QB/RB/WR/TE records in every supplied week.
- 22 rows have `VS = NA`, all with zero points, and cannot be assigned to a defense.
- 493 source zeros, including the 22 unassigned rows. Keep the 471 assigned zeros.
- 12 negative scores. Keep their signs in every aggregate and player view.
- No duplicate player IDs within a week, missing source values, malformed numeric scores, or conflicting matchups.
- 16 games per week, 48 unique matchups, and 96 defense-week observations.
- Total assigned PPR points: 7,597.14. Weekly totals: 2,600.76; 2,410.46; 2,585.92.

## Calculation contract

1. `VS` identifies the opposing **defense**. `TM` is the player's offense, when supplied. `PRK_PPR` is a player rank and must never become a defense rank.
2. `vs TB` means the player was home and TB's defense was away. `@ NYG` means the player was away and NYG's defense was home.
3. Sum recorded PPR points for a defense, position, and week. Multiple players, including backups and zero/negative results, belong to one game.
4. FPA/game is the positional sum divided by observed games with that position represented. Never divide by player count or assume a missing week/position equals zero. Display the sample and incomplete coverage.
5. League FPA/game is the total across eligible defense-game observations divided by their count. This remains correctly weighted when teams have different numbers of games.
6. Rank the unrounded averages in ascending order. Rank 1 is toughest. Equal averages share a competition rank (1, 1, 3). Missing metrics stay unranked.
7. All-position totals require all four positions to be represented in a game. Individual positions remain usable when another position is absent.
8. Available weeks, menus, and recent windows come from the supplied file. Default recent window: two calendar weeks. Recent-versus-season changes are descriptive and use overlapping samples.
9. Venue filters always describe the defense. No schedules, projections, historical scoring, participation estimates, or external statistics enter the calculations.

## Implementation plan

1. Put CSV parsing, source validation, opponent normalization, game aggregation, averages, and ranking in a pure, dependency-free data module.
2. Preserve the supplied CSV and generate a matching local JavaScript snapshot for direct-file/offline use. Provide a repeatable synchronization command.
3. Rebuild the interface around shared position, week-range, and defense-venue filters. Include a defense profile, weekly positional totals, selectable sortable heatmap, season/recent comparison, matchup lists, searchable player table/plot, expanded results, and methodology/source details.
4. Accept one CSV using the new schema, validate it before replacing the current dataset, and rebuild all derived views without rebinding events. Allow replacing browser-local uploaded data with the bundled source.
5. Verify supplied totals independently, test calculation edge cases, and exercise desktop/mobile controls, empty states, dialogs, import/export, and direct-file loading.

## Delivery boundaries

Keep the static-site entry point and existing logo assets. Leave historical CSVs as inactive source files. Work on the existing F-38 branch. The user's final instruction authorizes committing and pushing, with further runtime testing left to the user.

## Completed verification

- All 25 calculation/parser tests passed.
- Independent Python CSV/Decimal/Fraction reconciliation passed for 2,880 defense/position summaries across 18 week/venue scopes, including weighted league averages and unrounded ranks.
- Desktop browser checks covered shared filters, every position, custom/recent/individual weeks, home/away and no-result states, heatmap sorting/selection, keyboard chart selection, trend empty states, search, negative scores, expanded-view synchronization, score sorting, and dialog Escape/focus restoration.
- Browser imports rejected invalid scoring without replacing the current dataset, handled repeated valid imports, persisted after reload, and restored the supplied source. A temporary QA fixture copied Week 3 into Week 4 to verify future-week controls; it is excluded from version control, and the delivered source remains the original three-week CSV.
- Downloaded player, rankings, and source CSVs were checked. The player export retained the literal `@ NYG` matchup and negative score; rankings contained all 32 defenses; the source export matched the original bytes.
- Desktop at 1440×1050 and phone at 390×844 were visually inspected. The phone document had no horizontal page overflow or broken images. Subsequent phone table refinements preserve Player VS in the compact view and all columns in the scrollable expanded view; their final runtime review is user-owned.
- Source/snapshot identity and direct-file fallback code were checked. Direct-file browser verification was unavailable because the QA browser blocks the file protocol; no browser security policy was bypassed.

Further browser, tablet, cross-browser, and deployment checks are left to the user as requested. JavaScript syntax and Git whitespace checks passed before publishing.
