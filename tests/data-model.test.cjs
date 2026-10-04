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
  assert.equal(source.audit.sourceRows, 1255);
  assert.equal(source.audit.usedRows, 1233);
  assert.equal(source.audit.excludedRows, 22);
  assert.equal(source.audit.zeroResults, 471);
  assert.equal(source.audit.negativeResults, 12);
  assert.equal(source.audit.defenseGames, 96);
  assert.equal(source.audit.matchups, 48);
  assert.equal(source.audit.totalPoints, 7677.18);
  assert.deepEqual(source.weeks, [1, 2, 3]);
  assert.equal(source.defenses.length, 32);
  assert.deepEqual(source.diagnostics, { missingPositions: [], unpairedGames: [] });
});
test("supplied file: weekly totals independently specified by the source audit", () => {
  assert.deepEqual([1, 2, 3].map(week => Data.summarize(source, { from: week, to: week }).league.ALL.total), [2624.88, 2420.90, 2631.40]);
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
test("venue filters affect summaries and player results consistently", () => {
  const home = Data.summarize(source, { venue: "home" });
  const away = Data.summarize(source, { venue: "away" });
  assert.equal(home.byTeam.get("BAL").metrics.QB.avg, 22.38);
  assert.equal(home.byTeam.get("BAL").metrics.QB.games, 1);
  assert.equal(away.byTeam.get("BAL").metrics.QB.avg, 14.49);
  assert.equal(away.byTeam.get("BAL").metrics.QB.games, 2);
  assert.ok(Data.selectResults(source, { team: "BAL", venue: "home" }).every(row => row.vs === "@ BAL"));
  near(home.league.ALL.total + away.league.ALL.total, 7677.18);
});

test("no matching game is unavailable rather than zero or a rank", () => {
  const stat = Data.summarize(source, { from: 4, to: 4 }).byTeam.get("TB").metrics.QB;
  assert.deepEqual(stat, { total: null, avg: null, games: 0, rank: null, pool: 0, rankOrder: "ascending" });
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
  for (const [key, name] of [["weekly", "FPAv2.csv"], ["summary", "FPF.csv"]]) {
    const bytes = fs.readFileSync(path.join(__dirname, "../DH-FPA/data", name));
    assert.equal(snapshot[key].csv, bytes.toString("utf8"));
    assert.equal(snapshot[key].sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
    assert.equal(snapshot[key].name, name);
  }
  assert.equal(snapshot.season, 2026);
});

const summaryCSV = fs.readFileSync(path.join(__dirname, "../DH-FPA/data/FPF.csv"), "utf8");
const summary = Data.readFPF(summaryCSV);
const expectations = Data.matchupAnalysis(source, summary);
const positions = [...Data.POSITIONS, "ALL"];
function summaryFixture(team, values) {
  const headers = ["TM", ...positions.flatMap(pos => [pos, `${pos}x`, `${pos}rk`, `${pos}vs`, `${pos}vX`, `${pos}vRK`])];
  const row = [team, ...positions.flatMap(pos => values[pos] || ["", "", "", "", "", ""])];
  return { csv: headers.join(",") + "\n" + row.join(","), headers, row };
}

test("all 960 supplied FPF values are used directly, including averages and ranks", () => {
  assert.equal(summary.rows.length, 32); assert.deepEqual(summary.weeks, [1, 2, 3]);
  const raw = Data.parseCSV(summaryCSV, []).records;
  for (const { values: row } of raw) for (const pos of positions) {
    const c = expectations.byTeam.get(row.TM).metrics[pos];
    for (const [value, field] of [[c.actual.total, pos], [c.actual.avg, pos + "X"], [c.actualRank, pos + "RK"],
      [c.expectedTotal, pos + "VS"], [c.expectedAvg, pos + "VX"], [c.expectedRank, pos + "VRK"]]) {
      assert.equal(value, Number(row[field]), `${row.TM} ${field}`);
    }
    assert.equal(c.actual.rank, c.actualRank); assert.equal(c.actual.rankOrder, "descending");
  }
});
test("season totals retain FPF rounding while weekly games retain exact player points", () => {
  const c = expectations.byTeam.get("BAL").metrics.QB;
  assert.equal(c.expectedTotal, 55.9); assert.equal(c.actual.total, 51.4);
  assert.equal(c.actual.avg, 17.1); assert.equal(c.expectedAvg, 18.6);
  assert.equal(c.actualRank, 21); assert.equal(c.expectedRank, 12);
  assert.equal(c.delta, -4.5); assert.equal(c.games, 3); assert.equal(c.pool, 32);
  assert.deepEqual(c.entries.map(e => [e.offense, e.actual]), [["IND", 10.04], ["NO", 22.38], ["DAL", 18.94]]);
  assert.ok(c.entries.every(entry => !("expected" in entry) && !("offenseRank" in entry)));
  const added = Data.selectResults(source, { team: "PHI", pos: "QB", from: 3, to: 3 }).find(row => row.player === "Case Keenum");
  assert.equal(added.pts, 24.48); assert.equal(added.defenseVenue, "away");
  assert.equal(expectations.byTeam.get("PHI").metrics.QB.actual.total, 62.2);
});
test("ALL summaries use all six supplied fields without summing rounded positional values", () => {
  const c = expectations.byTeam.get("BAL").metrics.ALL;
  assert.equal(c.expectedTotal, 275.5); assert.equal(c.actual.total, 255.9);
  const kc = expectations.byTeam.get("KC").metrics;
  assert.equal(kc.ALL.actual.avg, summary.byTeam.get("KC").metrics.ALL.avg);
  assert.notEqual(kc.ALL.actual.avg, Data.POSITIONS.reduce((sum, pos) => sum + kc[pos].actual.avg, 0));
});
test("home/away and partial weeks use weekly actuals without allocating FPF expectations", () => {
  for (const scope of [{ venue: "home" }, { venue: "away" }, { from: 2, to: 3 }, { from: 1, to: 1 }]) {
    const scoped = Data.matchupAnalysis(source, summary, scope), weekly = Data.summarize(source, scope);
    assert.equal(scoped.summaryAvailable, false);
    for (const row of scoped.rows) for (const pos of positions) {
      const c = row.metrics[pos];
      assert.deepEqual(c.actual, weekly.byTeam.get(row.team).metrics[pos]);
      assert.equal(c.expectedTotal, null); assert.equal(c.expectedAvg, null); assert.equal(c.expectedRank, null);
      assert.equal(c.delta, null); assert.equal(c.deltaPct, null); assert.equal(c.pool, 0);
    }
  }
  assert.equal(Data.matchupAnalysis(source, summary, { from: 1, to: 3 }).summaryAvailable, true);
});
test("FPF zero, blank, independent averages, and supplied tied ranks are preserved", () => {
  const file = summaryFixture("TB", { QB: [0, 5, 9, 0, 8, 17], RB: [50, 1, 21, "", "", ""] });
  const fake = Data.readFPF(file.csv);
  const m = fixture(["1,A,QB,25,vs TB"]), c = Data.matchupAnalysis(m, fake).byTeam.get("TB").metrics;
  assert.equal(c.QB.actual.total, 0); assert.equal(c.QB.actual.avg, 5);
  assert.equal(c.QB.actualRank, 9); assert.equal(c.QB.expectedTotal, 0); assert.equal(c.QB.expectedAvg, 8);
  assert.equal(c.QB.expectedRank, 17); assert.equal(c.QB.delta, 0); assert.equal(c.QB.deltaPct, null);
  assert.equal(c.RB.actual.total, 50); assert.equal(c.RB.expectedTotal, null); assert.equal(c.RB.delta, null);
  assert.equal(c.WR.actual.total, null); assert.equal(c.WR.expectedTotal, null);
  // This supplied tie order cannot be inferred from displayed rounded totals.
  assert.equal(expectations.byTeam.get("LAC").metrics.RB.actualRank, summary.byTeam.get("LAC").metrics.RB.rank);
});
test("FPF rejects missing fields, duplicate/unknown teams, invalid numbers and invalid ranks", () => {
  assert.throws(() => Data.readFPF("TM,QB\nTB,0"), /Missing required columns/);
  const file = summaryFixture("TB", { QB: [1, 1, 1, 1, 1, 1] });
  assert.throws(() => Data.readFPF(file.csv + "\n" + file.row.join(",")), /duplicate FPF team/);
  assert.throws(() => Data.readFPF(file.csv.replace("\nTB,", "\nZZZ,")), /unknown FPF team/);
  for (const column of ["QB", "QBx", "QBvs", "QBvX"]) {
    const row = [...file.row]; row[file.headers.indexOf(column)] = "NA";
    assert.throws(() => Data.readFPF(file.headers.join(",") + "\n" + row.join(",")), /must be a number/);
  }
  for (const column of ["QBrk", "QBvRK"]) for (const bad of [0, 33, 1.5]) {
    const row = [...file.row]; row[file.headers.indexOf(column)] = bad;
    assert.throws(() => Data.readFPF(file.headers.join(",") + "\n" + row.join(",")), /rank from 1 to 32/);
  }
});
test("updated player source reconciles to FPF; corrected WR expectations are used directly", () => {
  assert.deepEqual(Data.summaryDifferences(source, summary), []);
  const wr = expectations.byTeam.get("BAL").metrics.WR;
  assert.equal(wr.expectedTotal, 107.8); assert.equal(wr.expectedAvg, 35.9); assert.equal(wr.expectedRank, 4);
  assert.equal(wr.actual.total, 109.2); assert.equal(wr.delta, 1.4);
  assert.notEqual(wr.expectedTotal, expectations.byTeam.get("BAL").metrics.RB.expectedTotal);
  for (const row of summary.rows) {
    for (const opponent of row.opponents) assert.equal(source.gamesByKey.get(`${row.team}|${opponent.week}`).offense, opponent.offense);
  }
});
test("weekly reader accepts supplied WK and legacy WEEK, rejecting conflicting aliases", () => {
  const body = "1,A,QB,12,vs TB";
  assert.equal(Data.readSource("WK,PLAYER NAME,POS,FPT_PPR,VS\n" + body).results[0].week, 1);
  assert.equal(Data.readSource("WEEK,PLAYER NAME,POS,FPT_PPR,VS\n" + body).results[0].week, 1);
  assert.throws(() => Data.readSource("WK,WEEK,PLAYER NAME,POS,FPT_PPR,VS\n1,2,A,QB,12,vs TB"), /WEEK and WK disagree/);
});
