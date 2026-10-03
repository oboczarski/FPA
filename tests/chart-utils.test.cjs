const test = require("node:test");
const assert = require("node:assert/strict");
const { pointBounds, comparisonGeometry } = require("../DH-FPA/chart-utils.js");

test("32.4–76.2 uses the requested 30–80 axis, without forcing zero", () => {
  assert.deepEqual(pointBounds([32.4, 55, 76.2]), { low: 30, high: 80, step: 10, ticks: [30, 40, 50, 60, 70, 80] });
});
test("expected and actual ranges can use independent bounds", () => {
  const expected = pointBounds([32.4, 76.2]), actual = pointBounds([109.3, 191.7]);
  assert.deepEqual([expected.low, expected.high, actual.low, actual.high], [30, 80, 100, 200]);
  assert.deepEqual([pointBounds([189.2, 312.8]).low, pointBounds([189.2, 312.8]).high], [180, 320]);
});
test("negative scoring rounds outward and missing values cannot corrupt bounds", () => {
  const bounds = pointBounds([null, NaN, Infinity, -32.4, -12.1]);
  assert.deepEqual([bounds.low, bounds.high], [-40, -10]);
  assert.ok(bounds.ticks.every(Number.isFinite));
});
test("empty and constant ranges still have a usable, finite scale", () => {
  for (const values of [[], [null, NaN], [30, 30], [0]]) {
    const bounds = pointBounds(values);
    assert.ok(Number.isFinite(bounds.low) && Number.isFinite(bounds.high) && bounds.high > bounds.low);
  }
});
test("unequal axes keep the equality line and both shaded regions mathematically correct", () => {
  const geometry = comparisonGeometry({ low: 30, high: 80 }, { low: 10, high: 100 });
  assert.deepEqual(geometry.equality, [[30, 30], [80, 80]]);
  assert.ok(geometry.above.every(([x, y]) => y >= x));
  assert.ok(geometry.below.every(([x, y]) => y <= x));
  const area = vertices => Math.abs(vertices.reduce((sum, [x, y], i) => {
    const [nextX, nextY] = vertices[(i + 1) % vertices.length];
    return sum + x * nextY - y * nextX;
  }, 0)) / 2;
  assert.equal(area(geometry.above) + area(geometry.below), 50 * 90);
});
test("nonoverlapping ranges do not draw a false diagonal", () => {
  const geometry = comparisonGeometry({ low: 30, high: 80 }, { low: 90, high: 100 });
  assert.deepEqual(geometry.equality, []);
  assert.deepEqual(geometry.below, []);
  assert.equal(geometry.above.length, 4);
});
test("identical rank bounds retain the original corner-to-corner equality line", () => {
  assert.deepEqual(comparisonGeometry({ low: 0, high: 33 }, { low: 0, high: 33 }).equality, [[0, 0], [33, 33]]);
});
