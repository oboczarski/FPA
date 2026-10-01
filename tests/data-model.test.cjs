const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const Data = require("../DH-FPA/data-model.js");
const file = path.join(__dirname, "../DH-FPA/data/2026-Wkly - FPA.csv");
const csv = fs.readFileSync(file, "utf8");
const source = Data.readSource(csv);
const fixture = rows => Data.readSource("WEEK,PLAYER NAME,POS,FPT_PPR,VS\n" + rows.join("\n"));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("supplied file: all source rows, exclusions, signs and matchup counts reconcile", () => {
  assert.equal(source.audit.sourceRows, 1249);
  assert.equal(source.audit.usedRows, 1227);
  assert.equal(source.audit.excludedRows, 22);
  assert.equal(source.audit.zeroResults, 471);
  assert.equal(source.audit.negativeResults, 12);
  assert.equal(source.audit.defenseGames, 96);
  assert.equal(source.audit.matchups, 48);
  assert.equal(source.audit.totalPoints, 7597.14);
  assert.deepEqual(source.weeks, [1, 2, 3]);
  assert.equal(source.defenses.length, 32);
  assert.deepEqual(source.diagnostics, { missingPositions: [], unpairedGames: [] });
});
test("supplied file: weekly totals independently specified by the source audit", () => {
  assert.deepEqual([1, 2, 3].map(week => Data.summarize(source, { from: week, to: week }).league.ALL.total), [2600.76, 2410.46, 2585.92]);
});
test("VS identifies the defense, not the player's TM or source player rank", () => {
  const gibbs = source.results.find(row => row.week === 1 && row.player === "Jahmyr Gibbs");
  assert.equal(gibbs.def, "NO"); assert.equal(gibbs.playerTeam, "DET"); assert.equal(gibbs.pts, 33.6);
  assert.equal(Data.summarize(source).byTeam.get("NO").metrics.RB.total, 81.6);
});
test("home and away are reversed from the player's VS prefix for defense venue", () => {
  assert.deepEqual(Data.parseOpponent("vs TB"), { defense: "TB", playerVenue: "home", defenseVenue: "away" });
  assert.deepEqual(Data.parseOpponent("@ NYG"), { defense: "NYG", playerVenue: "away", defenseVenue: "home" });
  assert.equal(Data.parseOpponent("NA"), null);
});
test("opponent normalization accepts whitespace, casing and existing team aliases", () => {
  assert.equal(Data.parseOpponent("  vs. jac  ").defense, "JAX");
  assert.equal(Data.parseOpponent("@ wsh").defense, "WAS");
  assert.throws(() => Data.parseOpponent("vs XYZ"), /Unknown defense/);
  assert.throws(() => Data.parseOpponent("TB"), /Invalid VS/);
});
test("all scores for one position belong to one defense game", () => {
  const model = fixture(["1,Starter,RB,20.00,vs TB", "1,Backup,RB,5.00,vs TB", "1,Reserve,RB,0.00,vs TB"]);
  const stat = Data.summarize(model).byTeam.get("TB").metrics.RB;
  assert.equal(stat.total, 25); assert.equal(stat.games, 1); assert.equal(stat.avg, 25);
});
test("negative scores reduce totals and survive the hide-zero player filter", () => {
  const model = fixture(["1,Negative,RB,-2.00,vs TB", "1,Zero,RB,0.00,vs TB", "1,Positive,RB,4.00,vs TB"]);
  assert.equal(Data.summarize(model).byTeam.get("TB").metrics.RB.avg, 2);
  assert.deepEqual(Data.selectResults(model, { hideZero: true }).map(row => row.pts), [-2, 4]);
});
test("a supplied all-zero game is a real zero and still counts in the denominator", () => {
  const model = fixture(["1,Runner,RB,20,vs TB", "2,Runner,RB,0,vs TB"]);
  const stat = Data.summarize(model).byTeam.get("TB").metrics.RB;
  assert.equal(stat.games, 2); assert.equal(stat.avg, 10);
  assert.equal(Data.summarize(model, { from: 2, to: 2 }).byTeam.get("TB").metrics.RB.avg, 0);
});
test("missing positions stay null and incomplete games cannot enter all-position totals", () => {
  const model = fixture(["1,Quarter,QB,10,vs TB", "1,Runner,RB,20,vs TB", "1,Receiver,WR,30,vs TB"]);
  const row = Data.summarize(model).byTeam.get("TB");
  assert.equal(row.metrics.TE.avg, null); assert.equal(row.metrics.TE.rank, null);
  assert.equal(row.metrics.ALL.avg, null); assert.equal(row.metrics.QB.avg, 10);
  assert.deepEqual(model.diagnostics.missingPositions[0].positions, ["TE"]);
});
test("averages use only observed eligible games rather than the range length", () => {
  const model = fixture(["1,Quarter,QB,10,vs TB", "3,Quarter,QB,30,vs TB", "1,Other,QB,40,@ NYG"]);
  const stat = Data.summarize(model, { from: 1, to: 3 }).byTeam.get("TB").metrics.QB;
  assert.equal(stat.games, 2); assert.equal(stat.avg, 20);
  assert.deepEqual(model.weeks, [1, 3]);
});
test("league average is weighted by observed defense games when samples differ", () => {
  const model = fixture(["1,Quarter,QB,10,vs TB", "2,Quarter,QB,30,vs TB", "1,Other,QB,50,@ NYG"]);
  const summary = Data.summarize(model);
  assert.equal(summary.byTeam.get("TB").metrics.QB.avg, 20);
  assert.equal(summary.byTeam.get("NYG").metrics.QB.avg, 50);
  assert.equal(summary.league.QB.avg, 30); assert.equal(summary.league.QB.games, 3);
});
test("ties share competition ranks while larger averages rank as easier", () => {
  const model = fixture(["1,A,QB,10,vs TB", "1,B,QB,10,@ NYG", "1,C,QB,20,vs NO"]);
  const summary = Data.summarize(model);
  assert.equal(summary.byTeam.get("TB").metrics.QB.rank, 1);
  assert.equal(summary.byTeam.get("NYG").metrics.QB.rank, 1);
  assert.equal(summary.byTeam.get("NO").metrics.QB.rank, 3);
});
test("ranking retains unrounded averages rather than tying displayed decimals", () => {
  const model = fixture(["1,A,QB,10.01,vs TB", "1,B,QB,10.02,@ NYG"]);
  const summary = Data.summarize(model);
  assert.equal(summary.byTeam.get("TB").metrics.QB.rank, 1);
  assert.equal(summary.byTeam.get("NYG").metrics.QB.rank, 2);
});
test("venue filters affect summaries, player results and recent comparisons consistently", () => {
  const home = Data.summarize(source, { venue: "home" });
  const away = Data.summarize(source, { venue: "away" });
  assert.equal(home.byTeam.get("BAL").metrics.QB.avg, 22.38);
  assert.equal(home.byTeam.get("BAL").metrics.QB.games, 1);
  assert.equal(away.byTeam.get("BAL").metrics.QB.avg, 14.49);
  assert.equal(away.byTeam.get("BAL").metrics.QB.games, 2);
  assert.ok(Data.selectResults(source, { team: "BAL", venue: "home" }).every(row => row.vs === "@ BAL"));
  near(home.league.ALL.total + away.league.ALL.total, 7597.14);
});
test("recent windows derive from the actual latest week and support a single week", () => {
  assert.deepEqual(Data.recentSpan(source, 2), { from: 2, to: 3 });
  assert.deepEqual(Data.recentSpan(source, 1), { from: 3, to: 3 });
  assert.deepEqual(Data.recentSpan(source, 8), { from: 1, to: 3 });
  const model = fixture(["1,A,QB,1,vs TB", "4,A,QB,2,vs TB"]);
  assert.deepEqual(Data.recentSpan(model, 2), { from: 3, to: 4 });
});
test("no matching game is unavailable rather than zero or a rank", () => {
  const stat = Data.summarize(source, { from: 4, to: 4 }).byTeam.get("TB").metrics.QB;
  assert.deepEqual(stat, { total: null, avg: null, games: 0, rank: null, pool: 0 });
});
test("rank changes are unavailable when comparison cohorts differ", () => {
  const model = fixture(["1,A,QB,10,vs TB", "2,A,QB,20,vs TB", "1,B,QB,30,@ NYG"]);
  const compared = Data.compare(Data.summarize(model), Data.summarize(model, { from: 2, to: 2 }), "TB", "QB");
  assert.equal(compared.deltaRank, null); assert.equal(compared.deltaPoints, 5);
});
test("five required columns are sufficient; optional IDs, TM, age and player ranks are not required", () => {
  const model = fixture(["1,Sample,QB,12.34,vs TB"]);
  assert.equal(model.results[0].playerTeam, null); assert.equal(model.audit.matchups, null);
  assert.equal(Data.summarize(model).byTeam.get("TB").metrics.QB.avg, 12.34);
});
test("player query can match name, offense abbreviation and offense full name", () => {
  assert.ok(Data.selectResults(source, { query: "Gibbs" }).every(row => row.player.includes("Gibbs")));
  assert.ok(Data.selectResults(source, { query: "Buffalo Bills" }).every(row => row.playerTeam === "BUF"));
  assert.ok(Data.selectResults(source, { query: "BUF" }).length > 0);
});
test("CSV parser preserves quoted commas, escaped quotes, BOM, CRLF and quoted newlines", () => {
  const model = Data.readSource('\uFEFFWEEK,PLAYER NAME,POS,FPT_PPR,VS\r\n1,"Player, ""Quoted""\nName",QB,1.00,vs TB\r\n');
  assert.equal(model.results[0].player, 'Player, "Quoted"\nName');
});
test("CSV rejects missing/duplicate headers, row-width errors and broken quotes", () => {
  assert.throws(() => Data.readSource("WEEK,POS\n1,QB"), /Missing required columns/);
  assert.throws(() => Data.readSource("WEEK,WEEK,PLAYER NAME,POS,FPT_PPR,VS\n1,1,A,QB,1,vs TB"), /unique/);
  assert.throws(() => fixture(["1,A,QB,1,vs TB,extra"]), /expected 5 columns/);
  assert.throws(() => fixture(['1,"A,QB,1,vs TB']), /unclosed/);
  assert.throws(() => fixture(['1,"A"oops,QB,1,vs TB']), /after closing/);
});
test("missing and nonnumeric scores are rejected, never converted to a healthy zero", () => {
  for (const score of ["", "NA", "PROJ", "1.123", "Infinity", "1e3"]) assert.throws(() => fixture([`1,A,QB,${score},vs TB`]), /FPT_PPR/);
  assert.equal(fixture(["1,A,QB,0,vs TB"]).results[0].pts, 0);
});
test("duplicates and conflicting defense matchups are rejected before aggregation", () => {
  assert.throws(() => fixture(["1,A,QB,1,vs TB", "1,A,QB,2,vs TB"]), /duplicate player/);
  assert.throws(() => fixture(["1,A,QB,1,vs TB", "1,B,QB,2,@ TB"]), /conflicting opponents or venues/);
  const header = "WEEK,PLAYER NAME,POS,FPT_PPR,VS,TM\n";
  assert.throws(() => Data.readSource(header + "1,A,QB,1,vs TB,CIN\n1,B,RB,2,vs TB,DET"), /conflicting/);
  assert.throws(() => Data.readSource(header + "1,A,QB,1,vs TB,CIN\n1,B,QB,2,vs CIN,TB"), /reverse matchup/);
});
test("point arithmetic reconciles decimal cents without intermediate rounding", () => {
  const model = fixture(["1,A,RB,0.10,vs TB", "1,B,RB,0.20,vs TB", "1,C,RB,-0.10,vs TB"]);
  assert.equal(Data.summarize(model).byTeam.get("TB").metrics.RB.total, 0.2);
});
test("offline snapshot exactly matches the canonical CSV and its checksum", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../DH-FPA/data/2026-weekly.js"), "utf8"), context);
  const snapshot = context.window.FPA_SOURCE;
  assert.equal(snapshot.csv, csv);
  assert.equal(snapshot.sha256, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"));
  assert.equal(snapshot.season, 2026);
});
