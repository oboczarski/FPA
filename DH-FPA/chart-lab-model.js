/* Read-only views of FPAv2 actuals and the supplied TSUMS offense baselines. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FPAChartLabData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const POSITIONS = Object.freeze(["QB", "RB", "WR", "TE", "ALL"]);

  function leagueBaseline(offenses, pos) {
    let total = 0, games = 0;
    for (const offense of offenses.rows) {
      const average = offense.metrics[pos]?.avg;
      if (!Number.isFinite(average) || !(offense.games > 0)) continue;
      total += average * offense.games; games += offense.games;
    }
    return games ? total / games : null;
  }
  function build(analysis, offenses, pos, order = []) {
    const teams = [...new Set([...order, ...analysis.rows.map(row => row.team)])].filter(team => analysis.byTeam.has(team));
    const cells = teams.flatMap(team => POSITIONS.map(position => {
      const c = analysis.byTeam.get(team).metrics[position], stat = c.actual;
      const percentile = stat.rank === null ? null : stat.pool < 2 ? .5 : (stat.rank - 1) / (stat.pool - 1);
      return { team, pos: position, avg: stat.avg, rank: stat.rank, pool: stat.pool, games: stat.games,
        expectedAvg: c.expectedAvg, percentile, radius: percentile === null ? 3 : Math.sqrt(16 + percentile * 105), laneOffset: 0 };
    }));
    // Tied ranks retain their exact x coordinate; small vertical offsets keep
    // the logos separately selectable without pretending they have different ranks.
    for (const position of POSITIONS) {
      const groups = new Map();
      for (const cell of cells.filter(row => row.pos === position && row.rank !== null)) {
        if (!groups.has(cell.rank)) groups.set(cell.rank, []);
        groups.get(cell.rank).push(cell);
      }
      for (const tied of groups.values()) tied.forEach((cell, index) => {
        cell.laneOffset = (index - (tied.length - 1) / 2) * Math.min(14, 36 / Math.max(1, tied.length - 1));
      });
    }
    const baseline = leagueBaseline(offenses, pos);
    const pressure = teams.flatMap(team => {
      const c = analysis.byTeam.get(team).metrics[pos];
      if (!(baseline > 0) || !(c.expectedTotal > 0) || !Number.isFinite(c.actual.avg)) return [];
      const ratio = c.actual.total / c.expectedTotal;
      return [{ team, pos, actualAvg: c.actual.avg, expectedAvg: c.expectedAvg, actualTotal: c.actual.total,
        expectedTotal: c.expectedTotal, games: c.games, ratio, suppression: (1 - ratio) * 100,
        strength: (c.expectedAvg / baseline - 1) * 100, adjustedRank: null }];
    });
    const ranked = [...pressure].sort((a, b) => a.ratio - b.ratio || a.team.localeCompare(b.team));
    let previous = null, rank = 0;
    ranked.forEach((row, index) => {
      if (previous === null || Math.abs(row.ratio - previous) > 1e-9) rank = index + 1;
      row.adjustedRank = rank; previous = row.ratio;
    });
    const weeks = [...new Set(teams.flatMap(team => analysis.byTeam.get(team).metrics[pos].entries.map(entry => entry.week)))].sort((a, b) => a - b);
    const polar = teams.flatMap(team => analysis.byTeam.get(team).metrics[pos].entries.filter(entry => Number.isFinite(entry.actual)).map(entry => ({
      ...entry, team, pos, location: weeks.length < 2 ? .5 : .14 + .72 * weeks.indexOf(entry.week) / (weeks.length - 1),
    })));
    return { teams, positions: [...POSITIONS], cells, pressure, polar, weeks, baseline, pos };
  }
  function extent(values, unit = 5, includeZero = false) {
    const finite = values.filter(Number.isFinite);
    if (includeZero) finite.push(0);
    if (!finite.length) return { min: 0, max: unit };
    let min = Math.floor(Math.min(...finite) / unit) * unit, max = Math.ceil(Math.max(...finite) / unit) * unit;
    if (min === max) { min -= unit; max += unit; }
    return { min, max };
  }
  return Object.freeze({ POSITIONS, leagueBaseline, build, extent });
});
