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
      return { team, pos: position, avg: stat.avg, rank: stat.rank, pool: stat.pool, games: stat.games,
        expectedAvg: c.expectedAvg };
    }));
    // ALL is the parent total, never a fifth slice added to QB/RB/WR/TE.
    // Zero values retain their data node and readout, without fabricated area.
    const sunburst = { name: "2026", children: teams.map(team => ({
      ...cells.find(row => row.team === team && row.pos === "ALL"), name: team,
      children: cells.filter(row => row.team === team && row.pos !== "ALL").map(row => ({
        ...row, name: row.pos, value: row.avg,
      })),
    })) };
    const profiles = teams.map(team => ({ team, values: cells.filter(row => row.team === team) }));
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
    const polar = teams.flatMap((team, index) => analysis.byTeam.get(team).metrics[pos].entries.filter(entry => Number.isFinite(entry.actual)).map(entry => ({
      ...entry, team, pos, location: .5, angle: -90 + (index + .5) * 360 / teams.length,
    })));
    return { teams, positions: [...POSITIONS], cells, sunburst, profiles, pressure, polar, weeks, baseline, pos };
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
