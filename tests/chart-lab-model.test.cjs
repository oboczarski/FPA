const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Data = require("../DH-FPA/data-model.js");
const Lab = require("../DH-FPA/chart-lab-model.js");
const read = name => fs.readFileSync(path.join(__dirname, "../DH-FPA/data", name), "utf8");
const model = Data.readSource(read("FPAv2.csv")), summary = Data.readFPFA(read("FPFA.csv"));
const offenses = Data.readOffenses(read("FPF.csv"));
const analysis = Data.matchupAnalysis(model, summary, {}, offenses);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("chart views cover all 32 teams and all five positions without changing the analysis", () => {
  const before = JSON.stringify(analysis.rows), view = Lab.build(analysis, "QB");
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
    const view = Lab.build(analysis, pos);
    assert.equal(view.polar.length, 96);
    assert.equal(new Set(view.polar.map(row => `${row.team}:${row.week}`)).size, 96);
    for (const team of view.teams) {
      const dots = view.polar.filter(row => row.team === team);
      assert.equal(dots.length, 3); assert.deepEqual(dots.map(row => row.week), [1, 2, 3]);
      near(dots.reduce((sum, row) => sum + row.actual, 0), Data.summarize(model).byTeam.get(team).metrics[pos].total);
      assert.ok(dots.every(row => row.location === .5));
      assert.equal(new Set(dots.map(row => row.angle)).size, 1);
      near(dots[0].angle, -90 + (view.teams.indexOf(team) + .5) * 360 / view.teams.length);
      for (const dot of dots) {
        const original = analysis.byTeam.get(team).metrics[pos].entries.find(entry => entry.week === dot.week);
        assert.equal(dot.logoTeam, original.offense);
        assert.equal(dot.expected, offenses.byTeam.get(dot.logoTeam).metrics[pos].avg);
        assert.equal(dot.offenseRank, offenses.byTeam.get(dot.logoTeam).metrics[pos].rank);
        assert.notEqual(dot.logoTeam, dot.team);
        assert.ok(fs.existsSync(path.join(__dirname, '../DH-FPA/assets/NFL-Tags_webp', `${dot.logoTeam.toLowerCase()}.webp`)));
      }
    }
  }
});
test("stacked bars preserve positional and ALL averages, allowing supplied rounding", () => {
  for (const venue of ["all", "home", "away"]) {
    const scoped = Data.matchupAnalysis(model, summary, { venue }, offenses);
    for (const pos of Lab.POSITIONS) {
      const view = Lab.build(scoped, pos);
      assert.equal(view.breakdown.length, 32);
      for (const row of view.breakdown) {
        const source = scoped.byTeam.get(row.team).metrics;
        assert.equal(row.pos, "ALL"); assert.equal(row.avg, source.ALL.actual.avg);
        assert.equal(row.rank, source.ALL.actual.rank);
        for (const p of Lab.POSITIONS) assert.equal(row[p], source[p].actual.avg);
        assert.ok(Math.abs(["QB", "RB", "WR", "TE"].reduce((sum, p) => sum + row[p], 0) - row.ALL) < .11);
      }
    }
  }
  const away = Lab.build(Data.matchupAnalysis(model, summary, { venue: "away" }, offenses), "TE");
  assert.ok(away.breakdown.some(row => row.TE === 0));
});
test("dumbbells use FPFA season totals and FPF opponent averages for venue comparisons", () => {
  for (const venue of ["all", "home", "away"]) {
    const scoped = Data.matchupAnalysis(model, summary, { venue }, offenses);
    for (const pos of Lab.POSITIONS) {
      const view = Lab.build(scoped, pos);
      assert.equal(view.dumbbell.length, 32);
      for (const band of ["highest", "upper", "lower", "lowest"]) {
        assert.equal(view.dumbbell.filter(row => row.gradientKey === band).length, 8);
      }
      const totals = view.dumbbell.flatMap(row => [row.actualTotal, row.expectedTotal]);
      const bounds = Lab.dumbbellBounds(view.dumbbell);
      near(bounds.min, Math.min(...totals) - 15);
      near(bounds.max, Math.max(...totals) + 20);
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
    const scoped = Data.matchupAnalysis(model, summary, { venue }, offenses);
    const view = Lab.build(scoped, "WR");
    assert.equal(view.teams.length, 32); assert.equal(view.cells.length, 160); assert.equal(view.polar.length, 48);
    assert.ok(view.polar.every(row => row.venue === venue));
  }
});
function fixture(entries) {
  const rows = entries.map(([team, actualAvg, expectedAvg]) => ({ team, metrics: Object.fromEntries(Lab.POSITIONS.map(pos => [pos, {
    actual: { avg: actualAvg, total: actualAvg * 3, rank: 1, pool: entries.length, games: 3 },
    expectedAvg, expectedTotal: expectedAvg === null ? null : expectedAvg * 3, games: 3, entries: [],
  }])) }));
  return { rows, byTeam: new Map(rows.map(row => [row.team, row])) };
}
test("dumbbells retain zero expectations and equal endpoints but omit missing baselines", () => {
  const view = Lab.build(fixture([["BAL", 10, 20], ["PHI", 20, 10], ["KC", 20, 20], ["NE", 0, null], ["BUF", 0, 0]]), "RB");
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
test("dumbbell gradients follow actual-FPA order independently of expectation and retain endpoint sides", () => {
  const view = Lab.build(fixture([["BAL", 18, 20], ["PHI", 10, 20], ["KC", 22, 20], ["BUF", 30, 20], ["NE", 20, 20]]), "QB");
  assert.deepEqual(view.dumbbell.map(row => row.team), ["BUF", "KC", "NE", "BAL", "PHI"]);
  const byTeam = new Map(view.dumbbell.map(row => [row.team, row]));
  assert.deepEqual(view.dumbbell.map(row => row.gradientKey), ["highest", "highest", "upper", "lower", "lowest"]);
  const changedExpectations = Lab.build(fixture([["BAL", 18, 0], ["PHI", 10, 1], ["KC", 22, 50], ["BUF", 30, 60], ["NE", 20, 100]]), "QB");
  assert.deepEqual(changedExpectations.dumbbell.map(row => [row.team, row.gradientKey]), view.dumbbell.map(row => [row.team, row.gradientKey]));
  for (const row of view.dumbbell) {
    const left = row.expectedOnLeft ? row.expectedTotal : row.actualTotal;
    const right = row.expectedOnLeft ? row.actualTotal : row.expectedTotal;
    assert.ok(left <= right);
  }
  assert.equal(byTeam.get("NE").expectedOnLeft, true);
});
test("dumbbell bounds reserve exactly 15 below and 20 above both endpoints, including zero and negative scores", () => {
  const bounds = Lab.dumbbellBounds([{ actualTotal: 32.4, expectedTotal: 76.2 }]);
  near(bounds.min, 17.4); near(bounds.max, 96.2);
  assert.deepEqual(Lab.dumbbellBounds([{ actualTotal: 0, expectedTotal: 0 }]), { min: -15, max: 20 });
  const negative = Lab.dumbbellBounds([{ actualTotal: -7.2, expectedTotal: 2 }, { actualTotal: NaN, expectedTotal: null }]);
  near(negative.min, -22.2); near(negative.max, 22);
  assert.deepEqual(Lab.dumbbellBounds([]), { min: 0, max: 35 });
});
