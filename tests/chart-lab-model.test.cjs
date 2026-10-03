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

test("chart views cover all 32 teams and all five positions without changing the analysis", () => {
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
      assert.ok(dots.every(row => row.location === .5));
      assert.equal(new Set(dots.map(row => row.angle)).size, 1);
      near(dots[0].angle, -90 + (view.teams.indexOf(team) + .5) * 360 / view.teams.length);
      for (const dot of dots) {
        const original = analysis.byTeam.get(team).metrics[pos].entries.find(entry => entry.week === dot.week);
        assert.equal(dot.logoTeam, original.offense);
        assert.notEqual(dot.logoTeam, dot.team);
        assert.ok(fs.existsSync(path.join(__dirname, '../DH-FPA/assets/NFL-Tags_webp', `${dot.logoTeam.toLowerCase()}.webp`)));
      }
    }
  }
});
test("stacked bars preserve every positional average and sum ALL exactly in each venue", () => {
  for (const venue of ["all", "home", "away"]) {
    const scoped = Data.expectedMatchups(model, offenses, { venue });
    for (const pos of Lab.POSITIONS) {
      const view = Lab.build(scoped, offenses, pos);
      assert.equal(view.breakdown.length, 32);
      for (const row of view.breakdown) {
        const source = scoped.byTeam.get(row.team).metrics;
        assert.equal(row.pos, pos); assert.equal(row.avg, source[pos].actual.avg);
        assert.equal(row.rank, source[pos].actual.rank);
        for (const p of Lab.POSITIONS) assert.equal(row[p], source[p].actual.avg);
        near(["QB", "RB", "WR", "TE"].reduce((sum, p) => sum + row[p], 0), row.ALL);
      }
    }
  }
  const away = Lab.build(Data.expectedMatchups(model, offenses, { venue: "away" }), offenses, "TE");
  assert.ok(away.breakdown.some(row => row.TE === 0));
});
test("dumbbells use the original actual and expected totals for all positions and venues", () => {
  for (const venue of ["all", "home", "away"]) {
    const scoped = Data.expectedMatchups(model, offenses, { venue });
    for (const pos of Lab.POSITIONS) {
      const view = Lab.build(scoped, offenses, pos);
      assert.equal(view.dumbbell.length, 32);
      for (const row of view.dumbbell) {
        const original = scoped.byTeam.get(row.team).metrics[pos];
        assert.equal(row.actualTotal, original.actual.total);
        assert.equal(row.expectedTotal, original.expectedTotal);
        assert.equal(row.games, original.games);
        near(row.deltaTotal, original.delta);
        assert.equal(row.lowTotal, Math.min(row.actualTotal, row.expectedTotal));
        assert.equal(row.highTotal, Math.max(row.actualTotal, row.expectedTotal));
      }
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
  assert.ok(tied.every(row => row.rank === 1));
});
test("league baselines weight averages by games and ignore missing averages", () => {
  const baseline = Lab.leagueBaseline({ rows: [
    { games: 1, metrics: { TE: { avg: 10 } } }, { games: 3, metrics: { TE: { avg: 20 } } },
    { games: 3, metrics: { TE: { avg: null } } }, { games: 0, metrics: { TE: { avg: 999 } } },
  ] }, "TE");
  assert.equal(baseline, 17.5);
});
test("dumbbells retain zero expectations and equal endpoints but omit missing baselines", () => {
  const view = Lab.build(fixture([["BAL", 10, 20], ["PHI", 20, 10], ["KC", 20, 20], ["NE", 0, null], ["BUF", 0, 0]]), baselineFixture, "RB");
  assert.equal(view.dumbbell.length, 4);
  assert.equal(view.dumbbell.some(row => row.team === "NE"), false);
  const below = view.dumbbell.find(row => row.team === "BAL"), above = view.dumbbell.find(row => row.team === "PHI");
  assert.equal(below.actualTotal, 30); assert.equal(below.expectedTotal, 60); assert.equal(below.deltaTotal, -30);
  assert.equal(above.actualTotal, 60); assert.equal(above.expectedTotal, 30); assert.equal(above.deltaTotal, 30);
  for (const team of ["KC", "BUF"]) {
    const row = view.dumbbell.find(row => row.team === team);
    assert.equal(row.actualTotal, row.expectedTotal);
    assert.equal(row.lowTotal, row.highTotal); assert.equal(row.deltaTotal, 0);
  }
});
