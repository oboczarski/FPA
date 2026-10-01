/* Current-season matchups: FPAv2 actual scoring and TSUMS offense baselines. */
(() => {
  "use strict";
  const Data = window.FPAData, $ = id => document.getElementById(id);
  const POSITIONS = ["QB", "RB", "WR", "TE", "ALL"];
  const COLORS = { QB: "#ffb2d8", RB: "#75e0b7", WR: "#63b0de", TE: "#ab9bff", ALL: "#aabaff" };
  const LABELS = { QB: "quarterbacks", RB: "running backs", WR: "wide receivers", TE: "tight ends", ALL: "all positions" };
  const state = { team: "BAL", pos: "QB", venue: "all", mode: "points", query: "", hideZero: false,
    heatSort: { pos: "QB", direction: "desc" }, playerSort: { key: "week", direction: "desc" } };
  let model = null, offenses = null, analysis = null;
  const tooltips = new Map();

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const fmt = (value, digits = 2) => value !== null && Number.isFinite(value) ? value.toFixed(digits) : "—";
  const signed = (value, digits = 1) => value === null ? "—" : `${value > 0 ? "+" : ""}${fmt(Math.abs(value) < 1e-9 ? 0 : value, digits)}`;
  const logo = team => team ? `<img src="assets/NFL-Tags_webp/${team.toLowerCase()}.webp" alt="" width="24" height="24">` : "";
  const venueLabel = () => state.venue === "home" ? "Defense at home" : state.venue === "away" ? "Defense away" : "All games";
  const weekLabel = () => model.minWeek === model.maxWeek ? `Week ${model.maxWeek}` : `Weeks ${model.minWeek}–${model.maxWeek}`;
  const comparison = team => analysis.byTeam.get(team || state.team).metrics[state.pos];
  const direction = value => value > 0 ? "is-easy" : value < 0 ? "is-tough" : "";
  const empty = (title, detail) => `<div class="emptyState"><strong>${esc(title)}</strong>${esc(detail)}</div>`;

  function heatColor(stat) {
    if (stat.rank === null) return "#7b81a5";
    const fraction = stat.pool < 2 ? .5 : (stat.rank - 1) / (stat.pool - 1);
    const a = fraction <= .5 ? [255, 178, 216] : [171, 155, 255];
    const b = fraction <= .5 ? [171, 155, 255] : [117, 224, 183];
    const t = fraction <= .5 ? fraction * 2 : (fraction - .5) * 2;
    return "#" + a.map((value, i) => Math.round(value + (b[i] - value) * t).toString(16).padStart(2, "0")).join("");
  }

  // Keep only current matchup selection in the URL. Removed week-range controls
  // and saved uploads cannot carry an old dataset or recent window into this app.
  function readURL() {
    const params = new URLSearchParams(location.search);
    if (model.defenses.includes(params.get("team"))) state.team = params.get("team");
    else if (!model.defenses.includes(state.team)) state.team = model.defenses[0];
    if (POSITIONS.includes(params.get("pos"))) state.pos = params.get("pos");
    if (["all", "home", "away"].includes(params.get("venue"))) state.venue = params.get("venue");
    state.heatSort.pos = state.pos;
  }
  function saveURL() {
    const url = new URL(location.href);
    for (const key of ["team", "pos", "venue"]) url.searchParams.set(key, state[key]);
    for (const key of ["range", "recent", "from", "to"]) url.searchParams.delete(key);
    try { history.replaceState(null, "", url); } catch { /* Some direct-file browsers restrict history. */ }
  }
  function syncControls() {
    for (const id of ["defenseSelect", "expandedDefense"]) $(id).value = state.team;
    for (const id of ["venueSelect", "expandedVenue"]) $(id).value = state.venue;
    document.querySelectorAll("[data-position]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.position === state.pos)));
    document.documentElement.style.setProperty("--position", COLORS[state.pos]);
  }
  function render() {
    if (!model) return;
    analysis = Data.expectedMatchups(model, offenses, { venue: state.venue });
    syncControls(); tooltips.clear(); hideTooltip();
    $("coverage").innerHTML = `<strong>${weekLabel()}</strong> · ${model.defenses.length} defenses · ${model.audit.usedRows.toLocaleString("en-US")} player records`;
    $("scopeNote").textContent = `Season to date · ${weekLabel()}`;
    $("footerCoverage").textContent = `2026 · ${weekLabel()} · PPR`;
    renderProfile(); renderWeekly(); renderPlayers(); renderScatter(); renderOpponents(); renderHeatmap();
    $("analysis").setAttribute("aria-busy", "false"); saveURL();
  }
  function renderProfile() {
    const c = comparison(), stat = c.actual;
    $("defenseLogo").innerHTML = logo(state.team);
    $("defenseTitle").textContent = Data.TEAM_NAMES[state.team];
    $("defenseSubtitle").textContent = `vs. ${LABELS[state.pos]} · ${venueLabel()}`;
    $("selectedPosition").textContent = state.pos; $("selectedPosition").dataset.pos = state.pos;
    const deltaValue = c.deltaPct !== null ? `${signed(c.deltaPct)}%` : signed(c.delta, 2);
    const baselineNote = c.expectedTotal !== null ? `${fmt(c.expectedAvg, 1)} per game` : `${c.baselineGames}/${c.games} baselines available`;
    $("metrics").innerHTML = `
      <div class="metric"><div class="metricLabel">Actual FPA</div><div class="metricValue">${fmt(stat.total)}</div><div class="metricSub">${fmt(stat.avg, 1)} per game</div></div>
      <div class="metric"><div class="metricLabel">Expected FPA</div><div class="metricValue">${fmt(c.expectedTotal, 1)}</div><div class="metricSub">${baselineNote}</div></div>
      <div class="metric"><div class="metricLabel">Vs expected</div><div class="metricValue ${direction(c.delta)}">${deltaValue}</div><div class="metricSub">${c.delta === null ? "Comparison unavailable" : `${signed(c.delta, 2)} points`}</div></div>
      <div class="metric"><div class="metricLabel">Matchup rank</div><div class="metricValue" style="color:${heatColor(stat)}">${stat.rank ?? "—"}${stat.rank === null ? "" : `<small>/ ${stat.pool}</small>`}</div><div class="metricSub">${stat.games} recorded game${stat.games === 1 ? "" : "s"}</div></div>`;
  }
  function width(id) {
    const element = $(id), style = getComputedStyle(element);
    return Math.max(260, Math.round((element.clientWidth || 500) - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)));
  }
  function scale(values) {
    const finite = values.filter(value => value !== null && Number.isFinite(value));
    let low = Math.min(0, ...finite), high = Math.max(0, ...finite);
    if (high - low < 1) high = low + 1;
    const rough = (high - low) / 4, magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = ([1, 2, 5, 10].find(value => value * magnitude >= rough) || 10) * magnitude;
    low = Math.floor(low / step) * step; high = Math.ceil(high / step) * step;
    const ticks = [];
    for (let n = low; n <= high + step / 100; n += step) ticks.push(Math.abs(n) < 1e-9 ? 0 : n);
    return { low, high, ticks, step };
  }
  const tick = (value, bounds) => fmt(value, bounds.step ? Math.max(0, -Math.floor(Math.log10(bounds.step))) : 0);
  const frame = (id, W, H, title, content) => `<svg viewBox="0 0 ${W} ${H}" role="group" aria-labelledby="${id}-title"><title id="${id}-title">${esc(title)}</title>${content}</svg>`;

  // Weekly bars show positional game totals. The expected line uses each
  // opposing offense's TSUMS average for that exact same position and game.
  function renderWeekly() {
    const entries = comparison().entries;
    $("weeklyMatchups").innerHTML = entries.map(entry => `<div class="weekMatchup"><span class="weekNumber">W${entry.week}</span>${logo(entry.offense)}<span>${entry.offense ? `${entry.venue === "home" ? "vs" : "@"} ${entry.offense}` : "Offense unknown"}</span></div>`).join("");
    if (!entries.some(entry => entry.actual !== null)) { $("weeklyChart").innerHTML = empty("No recorded games", "Choose another defense venue or position."); return; }
    const W = width("weeklyChart"), H = 156, left = 31, right = W - 9, top = 22, bottom = H - 19;
    const bounds = scale(entries.flatMap(entry => [entry.actual, entry.expected]));
    const y = value => bottom - (value - bounds.low) / (bounds.high - bounds.low) * (bottom - top);
    const slot = (right - left) / entries.length, x = index => left + slot * (index + .5), barWidth = Math.min(49, slot * .4);
    let content = `<defs><linearGradient id="weekly-bar" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${COLORS[state.pos]}" stop-opacity=".83"/><stop offset="1" stop-color="${COLORS[state.pos]}" stop-opacity=".24"/></linearGradient></defs>`;
    content += bounds.ticks.map(n => `<line class="${n === 0 ? "zeroLine" : "gridLine"}" x1="${left}" x2="${right}" y1="${y(n)}" y2="${y(n)}"/><text x="${left - 6}" y="${y(n) + 3}" text-anchor="end">${tick(n, bounds)}</text>`).join("");
    let segment = [];
    const finish = () => { if (segment.length > 1) content += `<polyline class="expectedLine" points="${segment.join(" ")}"/>`; segment = []; };
    entries.forEach((entry, i) => { if (entry.expected === null) finish(); else segment.push(`${x(i)},${y(entry.expected)}`); }); finish();
    entries.forEach((entry, i) => {
      const key = `week:${entry.week}`;
      tooltips.set(key, `<strong>${state.team} vs. ${state.pos} · Week ${entry.week}</strong><br>Actual: ${fmt(entry.actual)} PPR points<br>Expected: ${fmt(entry.expected, 1)} from ${entry.offense || "unknown offense"}<br><span class="tooltipMuted">${entry.venue === "home" ? "Defense at home" : "Defense away"}${entry.offenseRank === null ? "" : ` · Offense rank ${entry.offenseRank} (1 = most points)`}</span>`);
      if (entry.actual !== null) {
        const labelY = entry.actual >= 0 ? y(entry.actual) - 7 : Math.min(bottom - 6, y(entry.actual) + 13);
        content += `<g class="chartPoint" role="img" tabindex="0" data-tooltip="${key}" aria-label="Week ${entry.week}: ${fmt(entry.actual)} actual, ${fmt(entry.expected, 1)} expected ${state.pos} points"><rect x="${x(i) - barWidth / 2}" y="${Math.min(y(0), y(entry.actual))}" width="${barWidth}" height="${Math.max(2, Math.abs(y(entry.actual) - y(0)))}" rx="4" fill="url(#weekly-bar)"/><text class="chartValue" x="${x(i)}" y="${labelY}" text-anchor="middle">${fmt(entry.actual, 1)}</text></g>`;
      }
      if (entry.expected !== null) content += `<circle class="chartPoint" cx="${x(i)}" cy="${y(entry.expected)}" r="3" fill="#aabaff" tabindex="0" role="img" data-tooltip="${key}" aria-label="${entry.offense || "Opponent"} expected Week ${entry.week} ${state.pos}: ${fmt(entry.expected, 1)} points"/>`;
      if (entries.length <= 10 || i % 2 === 0) content += `<text x="${x(i)}" y="${bottom + 14}" text-anchor="middle">W${entry.week}</text>`;
    });
    $("weeklyChart").innerHTML = frame("weekly", W, H, `${state.team} ${state.pos}: actual weekly totals versus opposing offense averages`, content);
  }

  // Both axes use totals, not individual-player scores or a recent window.
  // Rank mode uses the same comparable defense cohort for both axes.
  function renderScatter() {
    document.querySelectorAll("[data-scatter-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.scatterMode === state.mode)));
    const ranked = state.mode === "rank";
    const points = analysis.rows.map(row => {
      const c = row.metrics[state.pos];
      return { team: row.team, c, x: ranked ? c.expectedRank : c.expectedTotal, y: ranked ? c.actualRank : c.actual.total };
    }).filter(point => point.x !== null && point.y !== null);
    renderScatterDetail(state.team);
    $("comparisonNote").textContent = ranked ? `Ranks of totals · 1 = lowest · ${points.length} comparable defenses. Select a logo.` : `Above the line = more points allowed than expected. ${points.length} comparable defenses.`;
    if (!points.length) { $("comparisonChart").innerHTML = empty("No complete comparisons", "Opponent offense averages must be available for each recorded game."); return; }
    const W = width("comparisonChart"), H = innerWidth <= 620 ? 220 : 226, left = 43, right = W - 16, top = 18, bottom = H - 34;
    const pool = analysis.pools[state.pos];
    const bounds = ranked ? { low: 0, high: Math.max(2, pool + 1), ticks: [...new Set([1, Math.ceil(pool / 4), Math.ceil(pool / 2), Math.ceil(pool * 3 / 4), pool])] } : scale(points.flatMap(point => [point.x, point.y]));
    const x = value => left + (value - bounds.low) / (bounds.high - bounds.low) * (right - left);
    const y = value => bottom - (value - bounds.low) / (bounds.high - bounds.low) * (bottom - top);
    let content = `<path d="M${left} ${top}H${right}L${left} ${bottom}Z" fill="#75e0b7" fill-opacity=".025"/><path d="M${left} ${bottom}H${right}V${top}Z" fill="#ffb2d8" fill-opacity=".025"/>`;
    content += bounds.ticks.map(n => `<line class="gridLine" x1="${left}" x2="${right}" y1="${y(n)}" y2="${y(n)}"/><line class="gridLine" x1="${x(n)}" x2="${x(n)}" y1="${top}" y2="${bottom}"/><text x="${left - 7}" y="${y(n) + 3}" text-anchor="end">${tick(n, bounds)}</text><text x="${x(n)}" y="${bottom + 13}" text-anchor="middle">${tick(n, bounds)}</text>`).join("");
    content += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${top}" stroke="#9eb0d9" stroke-opacity=".6" stroke-dasharray="4 4"/><text class="zoneLabel" x="${left + 5}" y="${top + 9}">${ranked ? "Higher actual rank" : "Above expected"}</text><text class="zoneLabel" x="${right - 5}" y="${bottom - 6}" text-anchor="end">${ranked ? "Lower actual rank" : "Below expected"}</text><text class="axisTitle" x="${(left + right) / 2}" y="${H - 2}" text-anchor="middle">Expected FPA${ranked ? " rank" : " · total points"}</text><text class="axisTitle" transform="translate(11 ${(top + bottom) / 2}) rotate(-90)" text-anchor="middle">Actual FPA${ranked ? " rank" : " · total points"}</text>`;
    points.sort((a, b) => Number(a.team === state.team) - Number(b.team === state.team)).forEach(point => {
      const c = point.c, selected = point.team === state.team, key = `scatter:${point.team}`;
      tooltips.set(key, `<strong>${esc(Data.TEAM_NAMES[point.team])} · ${state.pos}</strong><br>Expected: ${fmt(c.expectedTotal, 1)} PPR points<br>Actual: ${fmt(c.actual.total)} PPR points<br><span class="${direction(c.delta)}">${signed(c.delta, 2)} points versus expected</span><br><span class="tooltipMuted">${c.games} games${ranked ? ` · Expected rank ${c.expectedRank}, actual rank ${c.actualRank}` : ""}</span>`);
      content += `<g class="chartPoint" role="button" tabindex="0" aria-pressed="${selected}" data-chart-team="${point.team}" data-tooltip="${key}" aria-label="Explore ${point.team}: expected ${fmt(point.x, ranked ? 0 : 1)}, actual ${fmt(point.y, ranked ? 0 : 2)} ${ranked ? "rank" : "total points"}"><circle cx="${x(point.x)}" cy="${y(point.y)}" r="${selected ? 12 : 10}" fill="#10182b" stroke="${selected ? COLORS[state.pos] : heatColor(c.actual)}" stroke-width="${selected ? 2 : .9}"/><image href="assets/NFL-Tags_webp/${point.team.toLowerCase()}.webp" x="${x(point.x) - 8}" y="${y(point.y) - 8}" width="16" height="16"/><title>${point.team}: ${fmt(point.x)} expected, ${fmt(point.y)} actual</title></g>`;
    });
    $("comparisonChart").innerHTML = frame("expected-actual", W, H, `${state.pos} expected versus actual FPA ${ranked ? "total ranks" : "totals"}, ${venueLabel()}`, content);
  }
  function renderScatterDetail(team) {
    const c = comparison(team), ranked = state.mode === "rank";
    const expected = ranked ? c.expectedRank === null ? "—" : `#${c.expectedRank}` : fmt(c.expectedTotal, 1);
    const actual = ranked ? c.actualRank === null ? "—" : `#${c.actualRank}` : fmt(c.actual.total);
    const delta = ranked ? c.actualRank === null || c.expectedRank === null ? null : c.actualRank - c.expectedRank : c.delta;
    $("comparisonDetail").innerHTML = `<span class="comparisonTeam">${logo(team)}<strong>${team}</strong></span><span>Expected <strong>${expected}</strong></span><span>Actual <strong>${actual}</strong></span><span class="${direction(delta)}">${signed(delta, ranked ? 0 : 2)} ${ranked ? "ranks" : "pts"}</span>`;
  }
  function renderOpponents() {
    const c = comparison();
    $("opponentsScope").textContent = `${state.team} · ${state.pos}`;
    $("opponentsTable").innerHTML = `<caption class="srOnly">${state.team} opposing offenses and their supplied ${state.pos} scoring averages</caption><thead><tr><th>Wk</th><th>Offense</th><th title="TSUMS offense position rank; 1 is the most points scored">Off. rank</th><th title="Supplied TSUMS average, counted once for this game">Expected</th><th>Actual</th><th>Δ FPA</th></tr></thead><tbody>${c.entries.length ? c.entries.map(entry => {
      const delta = entry.actual !== null && entry.expected !== null ? entry.actual - entry.expected : null;
      return `<tr><td>W${entry.week}</td><td><span class="offenseCell" title="${esc(Data.TEAM_NAMES[entry.offense] || "Offense unavailable")}">${logo(entry.offense)}${entry.offense || "—"}</span></td><td>${entry.offenseRank === null ? "—" : `#${entry.offenseRank}`}</td><td>${fmt(entry.expected, 1)}</td><td>${fmt(entry.actual)}</td><td class="${direction(delta)}">${signed(delta)}</td></tr>`;
    }).join("") : '<tr><td colspan="6">No recorded games in this venue.</td></tr>'}</tbody>`;
  }
  function renderHeatmap() {
    const sorted = [...analysis.actual.rows].sort((a, b) => {
      const first = a.metrics[state.heatSort.pos].avg, second = b.metrics[state.heatSort.pos].avg;
      if (first === null || second === null) return first === second ? a.team.localeCompare(b.team) : first === null ? 1 : -1;
      return (state.heatSort.direction === "desc" ? second - first : first - second) || a.team.localeCompare(b.team);
    });
    const head = POSITIONS.map(pos => `<th scope="col" data-pos="${pos}" aria-sort="${state.heatSort.pos === pos ? state.heatSort.direction === "desc" ? "descending" : "ascending" : "none"}"><button type="button" data-heat-sort="${pos}" aria-label="Sort matchups by ${pos}">${pos}${state.heatSort.pos === pos ? `<span class="sortArrow">${state.heatSort.direction === "desc" ? "↓" : "↑"}</span>` : ""}</button></th>`).join("");
    const body = sorted.map(row => `<tr class="${row.team === state.team ? "selectedTeam" : ""}"><td><button type="button" class="heatTeamButton" data-team="${row.team}" aria-label="Explore ${esc(Data.TEAM_NAMES[row.team])}">${logo(row.team)}${row.team}</button></td>${POSITIONS.map(pos => {
      const stat = row.metrics[pos];
      return `<td><button type="button" class="heatCell" data-team="${row.team}" data-cell-position="${pos}" style="--heat-color:${heatColor(stat)}" aria-pressed="${row.team === state.team && state.pos === pos}" aria-label="${row.team} ${pos}: ${fmt(stat.avg)} FPA per game, rank ${stat.rank ?? "unavailable"} of ${stat.pool}, ${stat.games} games"${stat.avg === null ? " disabled" : ""}>${fmt(stat.avg, 1)}${stat.rank === null ? "" : `<sup>#${stat.rank}</sup>`}</button></td>`;
    }).join("")}</tr>`).join("");
    $("heatTable").innerHTML = `<caption class="srOnly">2026 FPA per game and defense ranks, ${venueLabel()}</caption><thead><tr><th scope="col">DEF</th>${head}</tr></thead><tbody>${body}</tbody>`;
  }

  // The player list is directly below the bars and shares their matchup scope.
  // Search/hide-zero/sort only change records displayed, never FPA aggregates.
  function selectedPlayers() {
    const getters = { week: row => row.week, player: row => row.player, team: row => row.playerTeam || "", vs: row => row.vs, pts: row => row.cents };
    const sort = state.playerSort;
    return Data.selectResults(model, { team: state.team, pos: state.pos, venue: state.venue, query: state.query, hideZero: state.hideZero }).sort((a, b) => {
      const first = getters[sort.key](a), second = getters[sort.key](b);
      const difference = typeof first === "string" ? first.localeCompare(second) : first - second;
      return (sort.direction === "asc" ? difference : -difference) || b.week - a.week || b.cents - a.cents || a.player.localeCompare(b.player);
    });
  }
  function playersTable(rows) {
    const columns = [["week", "Wk", ""], ["player", "Player", ""], ["team", "Offense", "offenseColumn"], ["vs", "Player VS", ""], ["pts", "PPR", ""]];
    const head = columns.map(([key, label, className]) => `<th class="${className}" scope="col" aria-sort="${state.playerSort.key === key ? state.playerSort.direction === "desc" ? "descending" : "ascending" : "none"}"><button type="button" data-player-sort="${key}" aria-label="Sort players by ${label}">${label}${state.playerSort.key === key ? `<span class="sortArrow">${state.playerSort.direction === "desc" ? "↓" : "↑"}</span>` : ""}</button></th>`).join("");
    const body = rows.length ? rows.map(row => `<tr><td>W${row.week}</td><td>${state.pos === "ALL" ? `<span class="playerPosition" data-pos="${row.pos}">${row.pos}</span>` : ""}<span class="playerName">${esc(row.player)}</span></td><td class="offenseColumn"><span class="offenseCell" title="${esc(Data.TEAM_NAMES[row.playerTeam] || "Offense not supplied")}">${logo(row.playerTeam)}${row.playerTeam || "—"}</span></td><td><span class="playerOpponent">${esc(row.vs)}</span></td><td class="${row.cents < 0 ? "scoreNegative" : row.cents === 0 ? "scoreZero" : ""}">${fmt(row.pts)}</td></tr>`).join("") : `<tr><td colspan="5">${empty("No matching player results", "Change the matchup or clear the player filters.")}<div class="emptyState"><button type="button" data-clear-search>Clear player filters</button></div></td></tr>`;
    return `<caption class="srOnly">${state.pos} recorded player scores against ${state.team}, ${weekLabel()}, ${venueLabel()}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  }
  function renderPlayers() {
    const rows = selectedPlayers(), total = rows.reduce((sum, row) => sum + row.cents, 0) / 100;
    $("playerScope").textContent = `${state.team} · ${state.pos}`;
    for (const id of ["playerSearch", "expandedSearch"]) if ($(id).value !== state.query) $(id).value = state.query;
    for (const id of ["hideZero", "expandedHideZero"]) $(id).checked = state.hideZero;
    $("playerTable").innerHTML = playersTable(rows);
    $("expandedSubtitle").textContent = `${Data.TEAM_NAMES[state.team]} defense vs. ${LABELS[state.pos]} · ${venueLabel()}`;
    if ($("playersDialog").open) $("expandedTable").innerHTML = playersTable(rows);
    const label = `${rows.length} player record${rows.length === 1 ? "" : "s"}${state.hideZero ? " · zeros hidden" : ""}`;
    $("playerCount").textContent = label; $("expandedCount").textContent = label;
    $("playerTotal").textContent = `${fmt(total)} displayed PPR points`;
  }
  function choose(team, pos = state.pos) {
    if (!model.defenses.includes(team) || !POSITIONS.includes(pos)) return;
    if (state.team !== team || state.pos !== pos) state.query = "";
    if (state.pos !== pos) state.heatSort.pos = pos;
    state.team = team; state.pos = pos; render();
  }
  function hideTooltip() { $("chartTooltip").hidden = true; }
  function showTooltip(target, event) {
    const text = tooltips.get(target.dataset.tooltip);
    if (!text) return;
    const tip = $("chartTooltip"); tip.innerHTML = text; tip.hidden = false;
    const box = target.getBoundingClientRect(), x = event?.clientX ?? box.left + box.width / 2, y = event?.clientY ?? box.top + box.height / 2;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, x + 10))}px`;
    tip.style.top = `${Math.max(8, Math.min(innerHeight - tip.offsetHeight - 8, y + 13))}px`;
    renderScatterDetail(target.dataset.chartTeam || state.team);
  }
  function bindEvents() {
    for (const id of ["defenseSelect", "expandedDefense"]) $(id).addEventListener("change", event => { if (model) choose(event.target.value); });
    for (const id of ["venueSelect", "expandedVenue"]) $(id).addEventListener("change", event => { if (model) { state.venue = event.target.value; render(); } });
    for (const id of ["playerSearch", "expandedSearch"]) $(id).addEventListener("input", event => { if (model) { state.query = event.target.value; renderPlayers(); } });
    for (const id of ["hideZero", "expandedHideZero"]) $(id).addEventListener("change", event => { if (model) { state.hideZero = event.target.checked; renderPlayers(); } });
    $("expandPlayers").addEventListener("click", () => {
      if (!model) return;
      hideTooltip(); $("playersDialog").showModal(); document.documentElement.style.overflow = "hidden"; renderPlayers();
    });
    $("playersDialog").addEventListener("close", () => { document.documentElement.style.overflow = ""; });
    $("playersDialog").addEventListener("click", event => {
      const dialog = $("playersDialog"), box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    });
    document.addEventListener("click", event => {
      const target = event.target.closest("button,[data-chart-team]");
      if (!target) return;
      if (target.hasAttribute("data-close-dialog")) { $("playersDialog").close(); return; }
      if (!model) return;
      if (target.dataset.position) choose(state.team, target.dataset.position);
      else if (target.dataset.team || target.dataset.chartTeam) choose(target.dataset.team || target.dataset.chartTeam, target.dataset.cellPosition || state.pos);
      else if (target.dataset.scatterMode) { state.mode = target.dataset.scatterMode; hideTooltip(); renderScatter(); }
      else if (target.dataset.heatSort) {
        state.heatSort.direction = state.heatSort.pos === target.dataset.heatSort && state.heatSort.direction === "desc" ? "asc" : "desc";
        state.heatSort.pos = target.dataset.heatSort; renderHeatmap();
      } else if (target.dataset.playerSort) {
        const key = target.dataset.playerSort;
        state.playerSort.direction = state.playerSort.key === key ? state.playerSort.direction === "desc" ? "asc" : "desc" : ["week", "pts"].includes(key) ? "desc" : "asc";
        state.playerSort.key = key; renderPlayers();
      } else if (target.hasAttribute("data-clear-search")) { state.query = ""; state.hideZero = false; renderPlayers(); }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") hideTooltip();
      const target = event.target.closest("[data-chart-team]");
      if (model && target && ["Enter", " "].includes(event.key)) { event.preventDefault(); choose(target.dataset.chartTeam); }
    });
    document.addEventListener("pointerover", event => { const target = event.target.closest("[data-tooltip]"); if (target) showTooltip(target, event); });
    document.addEventListener("pointerout", event => { if (event.target.closest("[data-tooltip]") && !event.relatedTarget?.closest?.("[data-tooltip]")) { hideTooltip(); if (model) renderScatterDetail(state.team); } });
    document.addEventListener("focusin", event => { const target = event.target.closest("[data-tooltip]"); if (target) showTooltip(target); else { hideTooltip(); if (model) renderScatterDetail(state.team); } });
    document.addEventListener("scroll", hideTooltip, true);
    let resizeTimer;
    window.addEventListener("resize", () => { clearTimeout(resizeTimer); hideTooltip(); resizeTimer = setTimeout(() => { if (model) { renderWeekly(); renderScatter(); } }, 120); });
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (model) { renderWeekly(); renderScatter(); } });
  }
  function init() {
    bindEvents();
    try {
      const sources = window.FPA_SOURCE;
      if (!Data || sources?.season !== 2026 || !sources.weekly?.csv || !sources.offense?.csv) throw new Error("The 2026 matchup source pair is unavailable.");
      const nextModel = Data.readSource(sources.weekly.csv, { name: sources.weekly.name });
      const nextOffenses = Data.readOffenses(sources.offense.csv, { name: sources.offense.name });
      model = nextModel; offenses = nextOffenses; readURL();
      const options = model.defenses.map(team => `<option value="${team}">${team} · ${esc(Data.TEAM_NAMES[team])}</option>`).join("");
      for (const id of ["defenseSelect", "expandedDefense"]) $(id).innerHTML = options;
      const differences = Data.offenseDifferences(model, offenses);
      $("sourceNotes").textContent = `${model.audit.excludedRows} rows without an opposing defense are excluded. ${differences.length ? "Source differences are preserved: " + differences.map(row => `${row.team} ${row.pos} totals are ${fmt(row.weeklyTotal)} in FPAv2 and ${fmt(row.offenseTotal, 1)} in TSUMS`).join("; ") + ". Expected FPA always uses the supplied TSUMS averages." : "Expected FPA uses the supplied TSUMS averages without recalculating them from player results."}`;
      render();
    } catch (error) {
      $("loadError").textContent = `Matchup data could not load: ${error.message}`; $("loadError").hidden = false;
      $("coverage").textContent = "2026 matchup data unavailable"; $("analysis").setAttribute("aria-busy", "false");
    }
  }
  init();
})();
