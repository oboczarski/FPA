const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const Data = require("../DH-FPA/data-model.js");
const file = path.join(__dirname, "../DH-FPA/data/FPAv2.csv");
const csv = fs.readFileSync(file, "utf8");
const source = Data.readSource(csv);
const fixture = rows => Data.readSource("WEEK,PLAYER NAME,POS,FPT_PPR,VS\n" + rows.join("\n"));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("supplied file: all source rows, exclusions, signs and matchup counts reconcile", () => {
  assert.equal(source.audit.sourceRows, 1250);
  assert.equal(source.audit.usedRows, 1228);
  assert.equal(source.audit.excludedRows, 22);
  assert.equal(source.audit.zeroResults, 471);
  assert.equal(source.audit.negativeResults, 12);
  assert.equal(source.audit.defenseGames, 96);
  assert.equal(source.audit.matchups, 48);
  assert.equal(source.audit.totalPoints, 7621.62);
  assert.deepEqual(source.weeks, [1, 2, 3]);
  assert.equal(source.defenses.length, 32);
  assert.deepEqual(source.diagnostics, { missingPositions: [], unpairedGames: [] });
});
test("supplied file: weekly totals independently specified by the source audit", () => {
  assert.deepEqual([1, 2, 3].map(week => Data.summarize(source, { from: week, to: week }).league.ALL.total), [2600.76, 2410.46, 2610.40]);
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
test("minimum-score filtering retains 1 point and excludes lesser scores without changing totals", () => {
  const model = fixture(["1,Negative,RB,-2.00,vs TB", "1,Zero,RB,0.00,vs TB", "1,Half,RB,0.50,vs TB", "1,Under,RB,0.99,vs TB", "1,Boundary,RB,1.00,vs TB", "1,Over,RB,1.01,vs TB"]);
  const before = Data.summarize(model).byTeam.get("TB").metrics.RB;
  assert.deepEqual(Data.selectResults(model, { hideZero: true, minPoints: 1 }).map(row => row.pts), [1, 1.01]);
  assert.equal(Data.selectResults(model).length, 6);
  assert.deepEqual(Data.summarize(model).byTeam.get("TB").metrics.RB, before);
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
  near(home.league.ALL.total + away.league.ALL.total, 7621.62);
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
test("bundled source pair exactly matches both provided CSVs and their checksums", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../DH-FPA/data/2026-weekly.js"), "utf8"), context);
  const snapshot = context.window.FPA_SOURCE;
  for (const [key, name] of [["weekly", "FPAv2.csv"], ["offense", "TSUMS.csv"]]) {
    const bytes = fs.readFileSync(path.join(__dirname, "../DH-FPA/data", name));
    assert.equal(snapshot[key].csv, bytes.toString("utf8"));
    assert.equal(snapshot[key].sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
    assert.equal(snapshot[key].name, name);
  }
  assert.equal(snapshot.season, 2026);
});

const offenseCSV = fs.readFileSync(path.join(__dirname, "../DH-FPA/data/TSUMS.csv"), "utf8");
const offenses = Data.readOffenses(offenseCSV);
const expectations = Data.expectedMatchups(source, offenses);
const offenseFixture = teams => {
  const positions = [...Data.POSITIONS, "ALL"];
  const header = ["TM", "G", ...positions.flatMap(pos => [pos, `${pos}RK`, `${pos}x`])];
  const records = teams.map(([team, averages]) => [team, 3, ...positions.flatMap(pos => {
    const avg = averages[pos] ?? null;
    return [avg === null ? "" : (avg * 3).toFixed(2), 1, avg === null ? "" : avg];
  })].join(","));
  return Data.readOffenses([header.join(","), ...records].join("\n"));
};

test("FPAv2 restores Case Keenum's Week 3 score against PHI in every actual total", () => {
  const added = Data.selectResults(source, { team: "PHI", pos: "QB", from: 3, to: 3 }).find(row => row.player === "Case Keenum");
  assert.equal(added.pts, 24.48); assert.equal(added.defenseVenue, "away");
  assert.equal(expectations.byTeam.get("PHI").metrics.QB.actual.total, 62.16);
});
test("expected QB FPA uses the three supplied opponent averages without weekly recomputation", () => {
  const c = expectations.byTeam.get("BAL").metrics.QB;
  assert.equal(c.expectedTotal, 55.9); assert.equal(c.actual.total, 51.36);
  assert.equal(c.delta, -4.54); assert.equal(c.games, 3);
  assert.deepEqual(c.entries.map(e => [e.offense, e.expected]), [["IND", 10.4], ["NO", 24.1], ["DAL", 21.4]]);
  assert.equal(c.expectedRank, 21); assert.equal(c.actualRank, 12); assert.equal(c.pool, 32);
});
test("multiple player records count the opponent baseline only once per game", () => {
  const m = Data.readSource("WEEK,PLAYER NAME,POS,FPT_PPR,VS,TM\n1,A,QB,10,vs TB,CIN\n1,B,QB,5,vs TB,CIN\n1,C,QB,0,vs TB,CIN\n2,A,QB,8,vs TB,CIN");
  const c = Data.expectedMatchups(m, offenseFixture([["CIN", { QB: 12.5 }]])).byTeam.get("TB").metrics.QB;
  assert.equal(c.expectedTotal, 25); assert.equal(c.actual.total, 23); assert.equal(c.delta, -2);
});
test("ALL expected scoring uses ALLx directly, not a sum of rounded position averages", () => {
  const c = expectations.byTeam.get("BAL").metrics.ALL;
  assert.deepEqual(c.entries.map(e => e.expected), [70.6, 109.7, 95.1]);
  assert.equal(c.expectedTotal, 275.4); assert.equal(c.actual.total, 255.86);
  assert.equal(Data.selectResults(source, { team: "BAL", pos: "ALL" }).length, Data.selectResults(source, { team: "BAL" }).length);
  const m = Data.readSource("WEEK,PLAYER NAME,POS,FPT_PPR,VS,TM\n" + Data.POSITIONS.map(p => `1,${p},${p},1,vs TB,CIN`).join("\n"));
  const fake = offenseFixture([["CIN", { QB: 1.1, RB: 1.1, WR: 1.1, TE: 1.1, ALL: 4.3 }]]);
  assert.equal(Data.expectedMatchups(m, fake).byTeam.get("TB").metrics.ALL.expectedTotal, 4.3);
});
test("venue filters apply to both expected and actual FPA over the same games", () => {
  const home = Data.expectedMatchups(source, offenses, { venue: "home" }).byTeam.get("TB").metrics.QB;
  const away = Data.expectedMatchups(source, offenses, { venue: "away" }).byTeam.get("TB").metrics.QB;
  assert.equal(home.expectedTotal, 30.8); assert.equal(home.actual.total, 31.14); assert.equal(home.games, 2);
  assert.equal(away.expectedTotal, 18); assert.equal(away.actual.total, 15.16); assert.equal(away.games, 1);
});
test("missing opponent averages stay unavailable and both ranks use one complete cohort", () => {
  const m = Data.readSource("WEEK,PLAYER NAME,POS,FPT_PPR,VS,TM\n1,A,QB,0,vs TB,CIN\n1,B,QB,2,vs NYG,MIN");
  const c = Data.expectedMatchups(m, offenseFixture([["CIN", { QB: 0 }]]));
  const complete = c.byTeam.get("TB").metrics.QB, missing = c.byTeam.get("NYG").metrics.QB;
  assert.equal(complete.expectedTotal, 0); assert.equal(complete.delta, 0); assert.equal(complete.deltaPct, null);
  assert.equal(complete.actualRank, 1); assert.equal(complete.expectedRank, 1); assert.equal(complete.pool, 1);
  assert.equal(missing.actual.total, 2); assert.equal(missing.expectedTotal, null); assert.equal(missing.delta, null);
  assert.equal(missing.actualRank, null); assert.equal(missing.expectedRank, null);
});
test("scatter totals rank unrounded values with competition ties independently on each axis", () => {
  const m = Data.readSource("WEEK,PLAYER NAME,POS,FPT_PPR,VS,TM\n1,A,QB,5,vs TB,CIN\n1,B,QB,5,vs NYG,MIN\n1,C,QB,6,vs SEA,CLE");
  const c = Data.expectedMatchups(m, offenseFixture([["CIN", { QB: 10.11 }], ["MIN", { QB: 10.11 }], ["CLE", { QB: 10.12 }]]));
  assert.deepEqual(["TB", "NYG", "SEA"].map(t => c.byTeam.get(t).metrics.QB.expectedRank), [1, 1, 3]);
  assert.deepEqual(["TB", "NYG", "SEA"].map(t => c.byTeam.get(t).metrics.QB.actualRank), [1, 1, 3]);
});
test("JAX source differences are disclosed while published WRx and ALLx stay unchanged", () => {
  assert.equal(offenses.byTeam.get("JAX").metrics.WR.avg, 34.1);
  assert.equal(offenses.byTeam.get("JAX").metrics.ALL.avg, 77.9);
  assert.deepEqual(Data.offenseDifferences(source, offenses), [
    { team: "JAX", pos: "WR", weeklyTotal: 110.6, offenseTotal: 102.4 },
    { team: "JAX", pos: "ALL", weeklyTotal: 242.04, offenseTotal: 233.8 },
  ]);
});
