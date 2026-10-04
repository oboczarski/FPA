// Exercise the real page renderers with a small DOM fixture; no browser/preview.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Data = require("../DH-FPA/data-model.js");
const Charts = require("../DH-FPA/chart-utils.js");
const Lab = require("../DH-FPA/chart-lab-model.js");
const read = name => fs.readFileSync(path.join(__dirname, "../DH-FPA", name), "utf8");
function page(venue = "all") {
  const nodes = new Map(), events = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: "", textContent: "", dataset: {}, hidden: true,
      clientWidth: 600, style: { setProperty() {} }, setAttribute() {}, addEventListener() {} });
    return nodes.get(id);
  };
  const context = { window: { FPAData: Data, FPACharts: Charts, addEventListener() {},
    FPAChartLab: { update(value) { context.chartView = Lab.build(value.analysis, value.pos); } } },
    document: { getElementById: element, querySelectorAll: () => [], documentElement: element("html"),
      addEventListener(name, handler) { events.set(name, handler); } },
    location: { search: `?team=BAL&pos=QB&venue=${venue}`, href: "https://example.test/?team=BAL" },
    history: { replaceState() {} }, getComputedStyle: () => ({}), innerWidth: 1200,
    URL, URLSearchParams, setTimeout, clearTimeout };
  vm.runInNewContext(read("data/2026-weekly.js"), context);
  vm.runInNewContext(read("app.js"), context);
  assert.equal(element("loadError").textContent, "", "page must load all three current source schemas");
  return { context, element, click(dataset) {
    const target = { dataset, hasAttribute: () => false, closest: () => target };
    events.get("click")({ target });
  } };
}
const cells = html => [...html.matchAll(/<td(?:\s[^>]*)?>(.*?)<\/td>/g)].map(match => match[1].replace(/<[^>]*>/g, ""));
const signed = value => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

test("Offenses faced restores six columns for every position and defense venue", () => {
  for (const venue of ["all", "home", "away"]) {
    const { context, element } = page(venue);
    for (const pos of [...Data.POSITIONS, "ALL"]) {
      context.window.FPAChartContext.select("BAL", pos);
      const html = element("opponentsTable").innerHTML;
      const headers = [...html.matchAll(/<th(?:\s[^>]*)?>(.*?)<\/th>/g)].map(match => match[1]);
      assert.deepEqual(headers, ["Wk", "Offense", "Off. rank", "Expected", "Actual", "Δ FPA"]);
      const rows = [...html.matchAll(/<tr(?:\s[^>]*)?>(.*?)<\/tr>/g)].slice(1).map(match => cells(match[1]));
      const entries = context.window.FPAChartContext.analysis.byTeam.get("BAL").metrics[pos].entries;
      assert.equal(rows.length, entries.length + 1);
      entries.forEach((entry, i) => assert.deepEqual(rows[i], [`W${entry.week}`, entry.offense,
        `#${entry.offenseRank}`, entry.expected.toFixed(1), entry.actual.toFixed(2),
        signed((Math.round(entry.actual * 100) - Math.round(entry.expected * 100)) / 100)]));
      assert.deepEqual(rows.at(-1), ["W4", "Placeholder", "—", "—", "—", "—"]);
      assert.equal(context.chartView.dumbbell.length, 32);
      assert.equal(context.chartView.polar.length, venue === "all" ? 96 : 48);
      assert.equal(element("hideZero").checked, true);
    }
  }
});

test("page retains the user's axis/zone labels and published summary values", () => {
  const { context, element, click } = page();
  const chart = element("comparisonChart").innerHTML;
  assert.ok(chart.includes(">Expected FPA  · Points | [Opponent Average]</text>"));
  assert.ok(chart.includes(">Actual FPA · total points</text>"));
  assert.ok(chart.includes("Points Allowed Above Opponenet Average"));
  assert.ok(chart.includes("Points Allowed Below Opponent Average"));
  assert.equal((chart.match(/data-chart-team=/g) || []).length, 32);
  context.window.FPAChartContext.select("BAL", "ALL");
  assert.equal(context.chartView.dumbbell.find(row => row.team === "BAL").expectedTotal, 275.5);
  click({ scatterMode: "rank" });
  assert.ok(element("comparisonChart").innerHTML.includes(">Expected FPA  · Rank</text>"));
  assert.ok(element("comparisonChart").innerHTML.includes(">Actual FPA rank</text>"));
});

test("weekly expected markers, gradient and single custom tooltip survive the source change", () => {
  const { context, element } = page();
  const weekly = element("weeklyChart").innerHTML;
  assert.equal((weekly.match(/style="fill:/g) || []).length, 3);
  assert.ok(weekly.includes('id="weekly-expected-line"'));
  assert.ok(weekly.includes('class="expectedLine"'));
  assert.ok(weekly.includes('style="fill:#e3b3ffa8"'));
  context.window.FPAChartContext.select("ARI", "QB");
  assert.ok(element("weeklyChart").innerHTML.includes('style="fill:#8af7ffb5"'));
  assert.equal(/<title[\s>]/.test(weekly), false);
  assert.equal(/<title[\s>]/.test(element("comparisonChart").innerHTML), false);
});
