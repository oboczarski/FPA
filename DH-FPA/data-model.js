/* Pure 2026 FPA calculations. Works in a browser and in Node without dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FPAData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const POSITIONS = Object.freeze(["QB", "RB", "WR", "TE"]);
  const TEAM_NAMES = Object.freeze({
    ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens",
    BUF: "Buffalo Bills", CAR: "Carolina Panthers", CHI: "Chicago Bears",
    CIN: "Cincinnati Bengals", CLE: "Cleveland Browns", DAL: "Dallas Cowboys",
    DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
    HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars",
    KC: "Kansas City Chiefs", LAC: "Los Angeles Chargers", LAR: "Los Angeles Rams",
    LV: "Las Vegas Raiders", MIA: "Miami Dolphins", MIN: "Minnesota Vikings",
    NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
    NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers",
    SEA: "Seattle Seahawks", SF: "San Francisco 49ers", TB: "Tampa Bay Buccaneers",
    TEN: "Tennessee Titans", WAS: "Washington Commanders",
  });
  const TEAMS = Object.freeze(Object.keys(TEAM_NAMES).sort());
  const ALIASES = Object.freeze({ JAC: "JAX", WSH: "WAS", WFT: "WAS", SD: "LAC", OAK: "LV", STL: "LAR" });
  const REQUIRED_COLUMNS = Object.freeze(["WEEK", "PLAYER NAME", "POS", "FPT_PPR", "VS"]);
  const UNKNOWN_OPPONENTS = new Set(["", "NA", "N/A", "BYE", "-", "—", "–"]);

  function canonicalTeam(value) {
    const code = String(value ?? "").trim().toUpperCase();
    return ALIASES[code] || code;
  }

  function parseOpponent(value) {
    const text = String(value ?? "").trim();
    if (UNKNOWN_OPPONENTS.has(text.toUpperCase())) return null;
    const match = /^(vs\.?|@)\s+([a-z]{2,3})$/i.exec(text);
    if (!match) throw new Error(`Invalid VS value “${text}”. Use “vs TB” or “@ NYG”.`);
    const defense = canonicalTeam(match[2]);
    if (!TEAMS.includes(defense)) throw new Error(`Unknown defense “${match[2]}” in VS.`);
    const playerHome = match[1][0] !== "@";
    return { defense, playerVenue: playerHome ? "home" : "away", defenseVenue: playerHome ? "away" : "home" };
  }

  // Explicit CSV parser preserves quoted names, escaped quotes, CRLF and quoted newlines.
  // Unexpected row widths or broken quotes fail before the app changes its current data.
  function parseCSV(text, requiredColumns = REQUIRED_COLUMNS) {
    if (typeof text !== "string" || !text.trim()) throw new Error("The CSV is empty.");
    const input = text.replace(/^\uFEFF/, "");
    const matrix = [];
    let row = [], field = "", quoted = false, closedQuote = false;
    let line = 1, rowLine = 1;
    const finishField = () => { row.push(field); field = ""; closedQuote = false; };
    const finishRow = () => {
      finishField();
      if (row.some(value => value.trim() !== "")) matrix.push({ values: row, line: rowLine });
      row = [];
    };
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"') {
          if (input[i + 1] === '"') { field += '"'; i++; }
          else { quoted = false; closedQuote = true; }
        } else {
          field += ch;
          if (ch === "\n") line++;
        }
        continue;
      }
      if (ch === '"') {
        if (field || closedQuote) throw new Error(`Line ${line}: unexpected quote in CSV field.`);
        quoted = true;
      } else if (ch === ",") {
        finishField();
      } else if (ch === "\r" || ch === "\n") {
        finishRow();
        if (ch === "\r" && input[i + 1] === "\n") i++;
        line++;
        rowLine = line;
      } else if (closedQuote) {
        if (!/\s/.test(ch)) throw new Error(`Line ${line}: text after closing CSV quote.`);
      } else {
        field += ch;
      }
    }
    if (quoted) throw new Error(`Line ${rowLine}: unclosed CSV quote.`);
    if (field || row.length || closedQuote) finishRow();
    if (matrix.length < 2) throw new Error("The CSV needs a header and at least one data row.");
    const headers = matrix.shift().values.map(value => value.trim().toUpperCase().replace(/\s+/g, " "));
    if (headers.some(value => !value) || new Set(headers).size !== headers.length) {
      throw new Error("CSV headers must be nonempty and unique.");
    }
    const missing = requiredColumns.filter(column => !headers.includes(column));
    if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);
    const records = matrix.map(entry => {
      if (entry.values.length !== headers.length) {
        throw new Error(`Line ${entry.line}: expected ${headers.length} columns, found ${entry.values.length}.`);
      }
      return { line: entry.line, values: Object.fromEntries(headers.map((column, i) => [column, entry.values[i].trim()])) };
    });
    return { headers, records };
  }

  function pointCents(value, line, column = "FPT_PPR") {
    const text = String(value ?? "").trim();
    if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text)) {
      throw new Error(`Line ${line}: ${column} must be a number with at most two decimal places; received “${text || "blank"}”.`);
    }
    const cents = Math.round(Number(text) * 100);
    if (!Number.isSafeInteger(cents)) throw new Error(`Line ${line}: ${column} is outside the supported numeric range.`);
    return cents;
  }

  function readSource(text, { name = "FPAv2.csv", season = 2026 } = {}) {
    const parsed = parseCSV(text);
    const results = [], excluded = [], seen = new Set(), gamesByKey = new Map();
    for (const { values: row, line } of parsed.records) {
      const week = Number(row.WEEK);
      if (!/^\d+$/.test(row.WEEK) || !Number.isInteger(week) || week < 1 || week > 22) {
        throw new Error(`Line ${line}: WEEK must be an integer from 1 to 22.`);
      }
      const player = row["PLAYER NAME"];
      if (!player) throw new Error(`Line ${line}: PLAYER NAME is blank.`);
      const pos = row.POS.toUpperCase();
      if (!POSITIONS.includes(pos)) throw new Error(`Line ${line}: unsupported position “${row.POS}”. Use QB, RB, WR or TE.`);
      const cents = pointCents(row.FPT_PPR, line);
      const playerId = row.SLPR_ID && !UNKNOWN_OPPONENTS.has(row.SLPR_ID.toUpperCase())
        ? row.SLPR_ID : `${pos}:${player.toLowerCase()}`;
      const identity = `${week}|${playerId}`;
      if (seen.has(identity)) throw new Error(`Line ${line}: duplicate player result for ${player} in Week ${week}.`);
      seen.add(identity);
      let opponent;
      try { opponent = parseOpponent(row.VS); }
      catch (error) { throw new Error(`Line ${line}: ${error.message}`); }
      if (!opponent) {
        excluded.push({ week, player, playerId, pos, pts: cents / 100, vs: row.VS, reason: "No opponent", line });
        continue;
      }
      const playerTeam = canonicalTeam(row.TM);
      if (playerTeam && !TEAMS.includes(playerTeam) && !["FA", "UD", "NA", "N/A", "-", "—"].includes(playerTeam)) {
        throw new Error(`Line ${line}: unknown offense “${row.TM}” in TM.`);
      }
      const offense = TEAMS.includes(playerTeam) ? playerTeam : null;
      if (offense === opponent.defense) throw new Error(`Line ${line}: TM and the defense in VS cannot be the same team.`);
      const result = {
        week, player, playerId, pos, pts: cents / 100, cents,
        playerTeam: offense, def: opponent.defense,
        playerVenue: opponent.playerVenue, defenseVenue: opponent.defenseVenue,
        vs: `${opponent.playerVenue === "home" ? "vs" : "@"} ${opponent.defense}`, line,
      };
      results.push(result);
      const key = `${result.def}|${week}`;
      if (!gamesByKey.has(key)) gamesByKey.set(key, {
        def: result.def, week, offense, venue: result.defenseVenue,
        records: [], positionCents: Object.fromEntries(POSITIONS.map(position => [position, null])),
      });
      const game = gamesByKey.get(key);
      if (game.venue !== result.defenseVenue || (offense && game.offense && offense !== game.offense)) {
        throw new Error(`Line ${line}: conflicting opponents or venues for ${result.def} in Week ${week}.`);
      }
      if (offense) game.offense = offense;
      game.records.push(result);
      game.positionCents[pos] = (game.positionCents[pos] ?? 0) + cents;
    }
    if (!results.length) throw new Error("No usable matchup results. VS must identify an opposing NFL defense.");
    const games = [...gamesByKey.values()].sort((a, b) => a.week - b.week || a.def.localeCompare(b.def));
    const matchups = new Set(), missingPositions = [], unpairedGames = [];
    for (const game of games) {
      const absent = POSITIONS.filter(pos => game.positionCents[pos] === null);
      if (absent.length) missingPositions.push({ defense: game.def, week: game.week, positions: absent });
      if (game.offense) {
        const reverse = gamesByKey.get(`${game.offense}|${game.week}`);
        if (reverse && ((reverse.offense && reverse.offense !== game.def) || reverse.venue === game.venue)) {
          throw new Error(`Conflicting reverse matchup for ${game.def} and ${game.offense} in Week ${game.week}.`);
        }
        matchups.add(`${game.week}|${[game.def, game.offense].sort().join("|")}`);
        if (!reverse) unpairedGames.push({ defense: game.def, week: game.week });
      }
      game.totalCents = absent.length ? null : POSITIONS.reduce((sum, pos) => sum + game.positionCents[pos], 0);
    }
    const weeks = [...new Set(results.map(row => row.week))].sort((a, b) => a - b);
    const defenses = [...new Set(results.map(row => row.def))].sort();
    return {
      name, season, rawCSV: text, headers: parsed.headers, results, excluded, games, gamesByKey, weeks, defenses,
      minWeek: weeks[0], maxWeek: weeks.at(-1),
      diagnostics: { missingPositions, unpairedGames },
      audit: {
        sourceRows: parsed.records.length, usedRows: results.length, excludedRows: excluded.length,
        sourcePlayers: new Set(parsed.records.map(({ values: row }) => row.SLPR_ID || row["PLAYER NAME"])).size,
        matchedPlayers: new Set(results.map(row => row.playerId)).size,
        zeroResults: results.filter(row => row.cents === 0).length,
        negativeResults: results.filter(row => row.cents < 0).length,
        totalPoints: results.reduce((sum, row) => sum + row.cents, 0) / 100,
        defenseGames: games.length,
        matchups: games.every(game => game.offense) ? matchups.size : null,
      },
    };
  }

  function recentSpan(model, length = 2) {
    const span = Math.max(1, Math.trunc(Number(length) || 2));
    return { from: Math.max(model.minWeek, model.maxWeek - span + 1), to: model.maxWeek };
  }

  function inScope(game, { from = 1, to = Infinity, venue = "all" } = {}) {
    return game.week >= from && game.week <= to && (venue === "all" || game.venue === venue);
  }

  function emptyMetric() { return { total: null, avg: null, games: 0, rank: null, pool: 0 }; }

  function assignRanks(rows, metric) {
    const ranked = rows.filter(row => row.metrics[metric].avg !== null)
      .sort((a, b) => a.metrics[metric].avg - b.metrics[metric].avg || a.team.localeCompare(b.team));
    let rank = 0, previous = null;
    ranked.forEach((row, index) => {
      const value = row.metrics[metric].avg;
      if (previous === null || Math.abs(value - previous) > 1e-9) rank = index + 1;
      row.metrics[metric].rank = rank;
      row.metrics[metric].pool = ranked.length;
      previous = value;
    });
    return ranked.length;
  }

  function summarize(model, scope = {}) {
    const scopedGames = model.games.filter(game => inScope(game, scope));
    const metrics = [...POSITIONS, "ALL"];
    const rows = model.defenses.map(team => ({
      team, games: 0,
      metrics: Object.fromEntries(metrics.map(pos => [pos, emptyMetric()])),
    }));
    const byTeam = new Map(rows.map(row => [row.team, row]));
    const leagueCents = Object.fromEntries(metrics.map(pos => [pos, { cents: 0, games: 0 }]));
    const teamCents = new Map(rows.map(row => [row.team, Object.fromEntries(metrics.map(pos => [pos, 0]))]));
    for (const game of scopedGames) {
      const row = byTeam.get(game.def);
      row.games++;
      for (const pos of metrics) {
        const cents = pos === "ALL" ? game.totalCents : game.positionCents[pos];
        if (cents === null) continue;
        row.metrics[pos].games++;
        teamCents.get(game.def)[pos] += cents;
        leagueCents[pos].cents += cents;
        leagueCents[pos].games++;
      }
    }
    for (const row of rows) {
      for (const pos of metrics) {
        const stat = row.metrics[pos];
        if (stat.games) {
          stat.total = teamCents.get(row.team)[pos] / 100;
          stat.avg = stat.total / stat.games;
        }
      }
    }
    const pools = Object.fromEntries(metrics.map(pos => [pos, assignRanks(rows, pos)]));
    const league = Object.fromEntries(metrics.map(pos => {
      const { cents, games } = leagueCents[pos];
      return [pos, { total: games ? cents / 100 : null, avg: games ? cents / 100 / games : null, games }];
    }));
    return { rows, byTeam, league, pools, games: scopedGames, scope };
  }

  function selectResults(model, { team = null, pos = null, from = 1, to = Infinity, venue = "all", query = "", hideZero = false, minPoints = null } = {}) {
    const search = String(query).trim().toLowerCase();
    return model.results.filter(row =>
      (!team || row.def === team) && (!pos || pos === "ALL" || row.pos === pos) &&
      row.week >= from && row.week <= to && (venue === "all" || row.defenseVenue === venue) &&
      (!hideZero || row.cents !== 0) && (!Number.isFinite(minPoints) || row.cents >= Math.round(minPoints * 100)) &&
      (!search || [row.player, row.playerTeam, TEAM_NAMES[row.playerTeam], row.vs].filter(Boolean).some(value => value.toLowerCase().includes(search)))
    );
  }

  function compare(season, recent, team, pos) {
    const a = season.byTeam.get(team)?.metrics[pos] ?? emptyMetric();
    const b = recent.byTeam.get(team)?.metrics[pos] ?? emptyMetric();
    return {
      season: a, recent: b,
      deltaPoints: a.avg !== null && b.avg !== null ? b.avg - a.avg : null,
      // Ranks from different-sized pools are not directly comparable.
      deltaRank: a.rank !== null && b.rank !== null && a.pool === b.pool ? b.rank - a.rank : null,
    };
  }

  // TSUMS is the independent offense baseline. Preserve its published averages
  // and ranks; never substitute averages recalculated from weekly player data.
  function readOffenses(text, { name = "TSUMS.csv" } = {}) {
    const positions = [...POSITIONS, "ALL"];
    const columns = ["TM", "G", ...positions.flatMap(pos => [pos, `${pos}RK`, `${pos}X`])];
    const parsed = parseCSV(text, columns), rows = [], byTeam = new Map();
    for (const { values: row, line } of parsed.records) {
      const team = canonicalTeam(row.TM);
      if (!TEAMS.includes(team)) throw new Error(`Line ${line}: unknown TSUMS offense “${row.TM}”.`);
      if (byTeam.has(team)) throw new Error(`Line ${line}: duplicate TSUMS offense ${team}.`);
      if (!/^\d+$/.test(row.G)) throw new Error(`Line ${line}: TSUMS G must be a nonnegative integer.`);
      const games = Number(row.G);
      if (!Number.isSafeInteger(games)) throw new Error(`Line ${line}: TSUMS G is outside the supported numeric range.`);
      const metrics = Object.fromEntries(positions.map(pos => {
        const optionalPoints = column => row[column] === "" ? null : pointCents(row[column], line, column);
        const totalCents = optionalPoints(pos), averageCents = optionalPoints(`${pos}X`);
        const rankText = row[`${pos}RK`];
        if (rankText !== "" && (!/^\d+$/.test(rankText) || Number(rankText) < 1 || Number(rankText) > 32)) {
          throw new Error(`Line ${line}: ${pos}RK must be a rank from 1 to 32, or blank.`);
        }
        return [pos, { total: totalCents === null ? null : totalCents / 100, totalCents,
          avg: averageCents === null || !games ? null : averageCents / 100,
          averageCents: games ? averageCents : null, rank: rankText === "" ? null : Number(rankText) }];
      }));
      const offense = { team, name: TEAM_NAMES[team], games, metrics };
      rows.push(offense); byTeam.set(team, offense);
    }
    return { name, rawCSV: text, rows, byTeam };
  }

  // Each defense-week contributes the opponent's position average exactly once.
  // Expected and actual totals use the same eligible games and venue scope.
  // An unknown opponent/baseline makes the full comparison unavailable, not zero.
  function expectedMatchups(model, offenses, scope = {}) {
    const actual = summarize(model, scope), positions = [...POSITIONS, "ALL"];
    const rows = actual.rows.map(row => {
      const games = actual.games.filter(game => game.def === row.team);
      const metrics = Object.fromEntries(positions.map(pos => {
        const stat = row.metrics[pos];
        const entries = games.map(game => {
          const cents = pos === "ALL" ? game.totalCents : game.positionCents[pos];
          const baseline = offenses.byTeam.get(game.offense)?.metrics[pos];
          return { week: game.week, offense: game.offense, venue: game.venue,
            actual: cents === null ? null : cents / 100,
            expected: baseline?.avg ?? null, expectedCents: baseline?.averageCents ?? null,
            offenseRank: baseline?.rank ?? null };
        });
        const eligible = entries.filter(entry => entry.actual !== null);
        const baselineGames = eligible.filter(entry => entry.expectedCents !== null).length;
        const complete = stat.games > 0 && baselineGames === stat.games;
        const expectedCents = complete ? eligible.reduce((sum, entry) => sum + entry.expectedCents, 0) : null;
        const expectedTotal = expectedCents === null ? null : expectedCents / 100;
        const delta = complete ? (Math.round(stat.total * 100) - expectedCents) / 100 : null;
        return [pos, { actual: stat, expectedTotal, expectedAvg: complete ? expectedTotal / stat.games : null,
          delta, deltaPct: complete && expectedTotal !== 0 ? delta / Math.abs(expectedTotal) * 100 : null,
          expectedRank: null, actualRank: null, pool: 0, baselineGames, games: stat.games, entries }];
      }));
      return { team: row.team, metrics };
    });
    const pools = {};
    for (const pos of positions) {
      const comparable = rows.filter(row => row.metrics[pos].expectedTotal !== null && row.metrics[pos].actual.total !== null);
      pools[pos] = comparable.length;
      for (const [field, target] of [["expectedTotal", "expectedRank"], ["actual", "actualRank"]]) {
        const sorted = [...comparable].sort((a, b) => {
          const value = row => field === "actual" ? row.metrics[pos].actual.total : row.metrics[pos][field];
          return value(a) - value(b) || a.team.localeCompare(b.team);
        });
        let previous = null, rank = 0;
        sorted.forEach((row, index) => {
          const value = field === "actual" ? row.metrics[pos].actual.total : row.metrics[pos][field];
          if (previous === null || Math.abs(value - previous) > 1e-9) rank = index + 1;
          row.metrics[pos][target] = rank; row.metrics[pos].pool = comparable.length; previous = value;
        });
      }
    }
    return { actual, rows, byTeam: new Map(rows.map(row => [row.team, row])), pools };
  }

  // Surface source disagreements for documentation without altering either file.
  function offenseDifferences(model, offenses) {
    const sums = new Map();
    for (const row of model.results) {
      if (!row.playerTeam) continue;
      for (const pos of [row.pos, "ALL"]) {
        const key = `${row.playerTeam}|${pos}`; sums.set(key, (sums.get(key) || 0) + row.cents);
      }
    }
    return offenses.rows.flatMap(row => [...POSITIONS, "ALL"].flatMap(pos => {
      const weekly = sums.get(`${row.team}|${pos}`), supplied = row.metrics[pos].totalCents;
      return weekly !== undefined && supplied !== null && Math.abs(weekly - supplied) > 5
        ? [{ team: row.team, pos, weeklyTotal: weekly / 100, offenseTotal: supplied / 100 }] : [];
    }));
  }

  return Object.freeze({ POSITIONS, TEAM_NAMES, TEAMS, REQUIRED_COLUMNS, canonicalTeam, parseOpponent, parseCSV, readSource, recentSpan, summarize, selectResults, compare, inScope, readOffenses, expectedMatchups, offenseDifferences });
});
