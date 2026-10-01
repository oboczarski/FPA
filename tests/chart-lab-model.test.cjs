const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Data = require("../DH-FPA/data-model.js");
const Lab = require("../DH-FPA/chart-lab-model.js");
const read = name => fs.readFileSync(path.join(__dirname, "../DH-FPA/data", name), "utf8");
const model = Data.readSource(read("FPAv2.csv")), offenses = Data.readOffenses(read("TSUMS.csv"));
const analysis = Data.expectedMatchups(model, offenses);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("both alternatives cover all 32 teams and all five positions without changing the analysis", () => {
  const before = JSON.stringify(analysis.rows), view = Lab.build(analysis, offenses, "QB");
  assert.equal(view.teams.length, 32); assert.equal(view.cells.length, 160);
  for (const team of view.teams) assert.deepEqual(view.cells.filter(row => row.team === team).map(row => row.pos), ["QB", "RB", "WR", "TE", "ALL"]);
  for (const row of view.cells) {
    const original = analysis.byTeam.get(row.team).metrics[row.pos].actual;
    assert.equal(row.avg, original.avg); assert.equal(row.rank, original.rank);
  }
  assert.equal(JSON.stringify(analysis.rows), before);
});
test("each position has 96 distinct game dots and three correctly scored dots per defense", () => {
  for (const pos of Lab.POSITIONS) {
    const view = Lab.build(analysis, offenses, pos);
    assert.equal(view.polar.length, 96);
    assert.equal(new Set(view.polar.map(row => `${row.team}:${row.week}`)).size, 96);
    for (const team of view.teams) {
      const dots = view.polar.filter(row => row.team === team);
      assert.equal(dots.length, 3); assert.deepEqual(dots.map(row => row.week), [1, 2, 3]);
      near(dots.reduce((sum, row) => sum + row.actual, 0), analysis.byTeam.get(team).metrics[pos].actual.total);
      assert.equal(new Set(dots.map(row => row.location)).size, 3);
    }
  }
});
test("venue filters keep the team sectors but only include games at the selected defense venue", () => {
  for (const venue of ["home", "away"]) {
    const scoped = Data.expectedMatchups(model, offenses, { venue });
    const view = Lab.build(scoped, offenses, "WR");
    assert.equal(view.teams.length, 32); assert.equal(view.cells.length, 160); assert.equal(view.polar.length, 48);
    assert.ok(view.polar.every(row => row.venue === venue));
  }
});
test("suppression and schedule strength use the supplied per-position baselines, including ALLx", () => {
  for (const pos of Lab.POSITIONS) {
    const view = Lab.build(analysis, offenses, pos);
    const weighted = offenses.rows.reduce((sum, row) => sum + row.games * row.metrics[pos].avg, 0) /
      offenses.rows.reduce((sum, row) => sum + row.games, 0);
    near(view.baseline, weighted);
    for (const row of view.pressure) {
      const c = analysis.byTeam.get(row.team).metrics[pos];
      near(row.suppression, -c.deltaPct); near(row.strength, (c.expectedAvg / weighted - 1) * 100);
      assert.equal(row.actualAvg, c.actual.avg); assert.equal(row.expectedAvg, c.expectedAvg);
    }
  }
});
function fixture(entries) {
  const rows = entries.map(([team, actualAvg, expectedAvg]) => ({ team, metrics: Object.fromEntries(Lab.POSITIONS.map(pos => [pos, {
    actual: { avg: actualAvg, total: actualAvg * 3, rank: 1, pool: entries.length, games: 3 },
    expectedAvg, expectedTotal: expectedAvg === null ? null : expectedAvg * 3, games: 3, entries: [],
  }])) }));
  return { rows, byTeam: new Map(rows.map(row => [row.team, row])) };
}
const baselineFixture = { rows: [
  { games: 3, metrics: Object.fromEntries(Lab.POSITIONS.map(pos => [pos, { avg: 5 }])) },
  { games: 3, metrics: Object.fromEntries(Lab.POSITIONS.map(pos => [pos, { avg: 30 }])) },
] };
test("holding a strong offense below baseline outranks merely allowing fewer points against a weak offense", () => {
  const view = Lab.build(fixture([["BAL", 5, 5], ["PHI", 10, 30]]), baselineFixture, "QB");
  const weak = view.pressure.find(row => row.team === "BAL"), strong = view.pressure.find(row => row.team === "PHI");
  assert.equal(weak.suppression, 0); near(strong.suppression, 200 / 3);
  assert.equal(strong.adjustedRank, 1); assert.equal(weak.adjustedRank, 2);
  assert.ok(strong.strength > 0 && weak.strength < 0);
});
test("suppression ranks use competition ties and unavailable baselines never become zero", () => {
  const view = Lab.build(fixture([["BAL", 10, 20], ["PHI", 15, 30], ["KC", 20, 20], ["NE", 0, null], ["BUF", 0, 0]]), baselineFixture, "RB");
  assert.deepEqual(view.pressure.map(row => [row.team, row.adjustedRank]), [["BAL", 1], ["PHI", 1], ["KC", 3]]);
  const tied = view.cells.filter(row => row.pos === "RB");
  assert.ok(new Set(tied.map(row => row.laneOffset)).size > 1);
  assert.ok(tied.every(row => row.rank === 1));
});
test("league baselines weight averages by games and ignore missing averages", () => {
  const baseline = Lab.leagueBaseline({ rows: [
    { games: 1, metrics: { TE: { avg: 10 } } }, { games: 3, metrics: { TE: { avg: 20 } } },
    { games: 3, metrics: { TE: { avg: null } } }, { games: 0, metrics: { TE: { avg: 999 } } },
  ] }, "TE");
  assert.equal(baseline, 17.5);
});
