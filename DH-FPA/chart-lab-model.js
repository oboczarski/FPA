/* Read-only views of FPAv2 actuals and the supplied TSUMS offense baselines. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FPAChartLabData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const POSITIONS = Object.freeze(["QB", "RB", "WR", "TE", "ALL"]);

  function build(analysis, offenses, pos, order = []) {
    const teams = [...new Set([...order, ...analysis.rows.map(row => row.team)])].filter(team => analysis.byTeam.has(team));
    const cells = teams.flatMap(team => POSITIONS.map(position => {
      const c = analysis.byTeam.get(team).metrics[position], stat = c.actual;
      return { team, pos: position, avg: stat.avg, rank: stat.rank, pool: stat.pool, games: stat.games,
        expectedAvg: c.expectedAvg };
    }));
    // ALL is the sum of the four positional segments, never a fifth stacked segment.
    // Keep zero values and the original positional averages without inventing bar area.
    const breakdown = teams.map(team => ({
      ...cells.find(row => row.team === team && row.pos === "ALL"),
      ...Object.fromEntries(cells.filter(row => row.team === team).map(row => [row.pos, row.avg])),
    }));
    const dumbbell = teams.flatMap(team => {
      const c = analysis.byTeam.get(team).metrics[pos];
      if (!Number.isFinite(c.actual.total) || !Number.isFinite(c.expectedTotal)) return [];
      const deltaTotal = c.actual.total - c.expectedTotal;
      const strong = Math.abs(deltaTotal) >= Math.abs(c.expectedTotal) * .25 && Math.abs(deltaTotal) > 1e-9;
      return [{ team, pos, expectedOnLeft: c.expectedTotal <= c.actual.total,
        gradientKey: `${deltaTotal > 0 ? "above" : "below"}${strong ? "Strong" : "Soft"}`, actualTotal: c.actual.total, expectedTotal: c.expectedTotal,
        actualAvg: c.actual.avg, expectedAvg: c.expectedAvg, games: c.games,
        deltaTotal,
        lowTotal: Math.min(c.actual.total, c.expectedTotal), highTotal: Math.max(c.actual.total, c.expectedTotal) }];
    });
    dumbbell.sort((a, b) => b.actualTotal - a.actualTotal || a.team.localeCompare(b.team));
    const weeks = [...new Set(teams.flatMap(team => analysis.byTeam.get(team).metrics[pos].entries.map(entry => entry.week)))].sort((a, b) => a - b);
    const polar = teams.flatMap((team, index) => analysis.byTeam.get(team).metrics[pos].entries.filter(entry => Number.isFinite(entry.actual)).map(entry => ({
      ...entry, team, pos, logoTeam: entry.offense, location: .5, angle: -90 + (index + .5) * 360 / teams.length,
    })));
    return { teams, positions: [...POSITIONS], cells, breakdown, dumbbell, polar, weeks, pos };
  }
  function extent(values, unit = 5, includeZero = false) {
    const finite = values.filter(Number.isFinite);
    if (includeZero) finite.push(0);
    if (!finite.length) return { min: 0, max: unit };
    let min = Math.floor(Math.min(...finite) / unit) * unit, max = Math.ceil(Math.max(...finite) / unit) * unit;
    if (min === max) { min -= unit; max += unit; }
    return { min, max };
  }
  return Object.freeze({ POSITIONS, build, extent });
});
