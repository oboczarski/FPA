/* Scatter geometry, independent of the page and scoring calculations. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FPACharts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Round each points axis outward to tens; a positive range need not start at zero.
  function pointBounds(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return { low: 0, high: 10, step: 10, ticks: [0, 10] };
    let low = Math.floor(Math.min(...finite) / 10) * 10;
    let high = Math.ceil(Math.max(...finite) / 10) * 10;
    if (low === high) { low -= 10; high += 10; }
    const rough = (high - low) / 5, magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = Math.max(10, ([1, 2, 5, 10].find(n => n * magnitude >= rough) || 10) * magnitude);
    const ticks = [];
    for (let n = low; n < high; n += step) ticks.push(n === 0 ? 0 : n);
    ticks.push(high === 0 ? 0 : high);
    return { low: low === 0 ? 0 : low, high: high === 0 ? 0 : high, step, ticks };
  }

  // Clip the two comparison regions to y=x in data coordinates. Different axis
  // ranges move the equality line away from the plot's corner-to-corner diagonal.
  function comparisonGeometry(xBounds, yBounds) {
    const rectangle = [[xBounds.low, yBounds.low], [xBounds.high, yBounds.low],
      [xBounds.high, yBounds.high], [xBounds.low, yBounds.high]];
    const clip = sign => {
      const polygon = [];
      rectangle.forEach((current, index) => {
        const previous = rectangle[(index + rectangle.length - 1) % rectangle.length];
        const a = sign * (previous[1] - previous[0]), b = sign * (current[1] - current[0]);
        if ((a >= 0) !== (b >= 0)) {
          const fraction = a / (a - b);
          polygon.push(previous.map((value, i) => value + fraction * (current[i] - value)));
        }
        if (b >= 0) polygon.push(current);
      });
      return polygon;
    };
    const low = Math.max(xBounds.low, yBounds.low), high = Math.min(xBounds.high, yBounds.high);
    return { above: clip(1), below: clip(-1), equality: low < high ? [[low, low], [high, high]] : [] };
  }

  return Object.freeze({ pointBounds, comparisonGeometry });
});
