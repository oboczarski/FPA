/* 2026 Matchup Explorer. All calculations come from the supplied player CSV. */
(() => {
  "use strict";
  const Data = window.FPAData;
  const $ = id => document.getElementById(id);
  const POS_COLORS = { QB: "#ff86aa", RB: "#5be3b3", WR: "#72b8ff", TE: "#bd9aff" };
  const POS_NAMES = { QB: "quarterbacks", RB: "running backs", WR: "wide receivers", TE: "tight ends" };
  const STORE_KEY = "fpa:2026:uploaded-csv:v1";
  const state = {
    team: "BAL", pos: "QB", range: "all", recent: 2, venue: "all", from: 1, to: 3,
    scatterMode: "avg", insight: "easy", playerView: "table", query: "", hideZero: false,
    heatSort: { metric: "QB", direction: "desc" }, playerSort: { key: "week", direction: "desc" },
  };
  let model = null, datasets = null, sourceKind = "Provided CSV", importing = false, toastTimer = null;
  const tooltips = new Map();

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function fmt(value, digits = 2) { return value !== null && Number.isFinite(value) ? value.toFixed(digits) : "—"; }
  function count(value) { return Number(value).toLocaleString("en-US"); }
  function signed(value, digits = 1) { return value === null ? "—" : `${value > 0 ? "+" : ""}${fmt(Math.abs(value) < .000001 ? 0 : value, digits)}`; }
  function plural(value, word) { return `${count(value)} ${word}${value === 1 ? "" : "s"}`; }
  function weekLabel(from, to) { return from === to ? `Week ${from}` : `Weeks ${from}–${to}`; }
  function venueLabel() { return state.venue === "home" ? "Defense at home" : state.venue === "away" ? "Defense on the road" : "All venues"; }
  function logo(team, className = "") { return team ? `<img class="${esc(className)}" src="assets/NFL-Tags_webp/${team.toLowerCase()}.webp" alt="" width="24" height="24">` : ""; }
  function scope() {
    let span = { from: model.minWeek, to: model.maxWeek };
    if (state.range === "recent") span = Data.recentSpan(model, state.recent);
    else if (state.range.startsWith("week:")) span = { from: Number(state.range.slice(5)), to: Number(state.range.slice(5)) };
    else if (state.range === "custom") span = { from: state.from, to: state.to };
    return { ...span, venue: state.venue };
  }
  function rangeLabel() { const span = scope(); return weekLabel(span.from, span.to); }
  function metric(team = state.team, pos = state.pos, dataset = datasets.current) { return dataset.byTeam.get(team)?.metrics[pos]; }
  function direction(value) { return value === null || value === 0 ? "" : value > 0 ? "positive" : "negative"; }
  function heatColor(stat) {
    if (!stat || stat.rank === null) return "#718395";
    const stops = [[237,145,177], [180,158,232], [128,181,219], [98,216,197]];
    const t = stat.pool > 1 ? (stat.rank - 1) / (stat.pool - 1) : .5;
    const f = Math.min(3, Math.max(0, t * 3)), index = Math.min(2, Math.floor(f));
    const color = stops[index].map((value, i) => Math.round(value + (stops[index + 1][i] - value) * (f - index)));
    return `rgb(${color.join(",")})`;
  }
  function rankDescription(stat) {
    if (!stat || stat.rank === null) return "No matching data";
    if (stat.pool <= 1) return "One rated defense";
    const t = (stat.rank - 1) / (stat.pool - 1);
    return t <= .24 ? "Tougher matchup" : t >= .76 ? "Easier matchup" : "Middle of the league";
  }
  function empty(title, text, action = "") { return `<div class="emptyState"><strong>${esc(title)}</strong>${esc(text)}${action}</div>`; }
  function notice(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3500);
  }
  function warning(text = "") { $("loadError").textContent = text; $("loadError").hidden = !text; }

  function readURL() {
    const params = new URLSearchParams(location.search);
    if (params.has("team")) state.team = params.get("team");
    if (params.has("pos")) state.pos = params.get("pos");
    if (params.has("range")) state.range = params.get("range");
    if (params.has("recent")) state.recent = Number(params.get("recent"));
    if (params.has("venue")) state.venue = params.get("venue");
    if (params.has("from")) state.from = Number(params.get("from"));
    if (params.has("to")) state.to = Number(params.get("to"));
  }
  function saveURL() {
    const url = new URL(location.href);
    for (const key of ["team", "pos", "range", "recent", "venue"]) url.searchParams.set(key, String(state[key]));
    if (state.range === "custom") { url.searchParams.set("from", String(state.from)); url.searchParams.set("to", String(state.to)); }
    else { url.searchParams.delete("from"); url.searchParams.delete("to"); }
    try { history.replaceState(null, "", url); } catch { /* Some direct-file browsers disallow history changes. */ }
  }
  function normalizeState() {
    if (!model.defenses.includes(state.team)) state.team = model.defenses.includes("BAL") ? "BAL" : model.defenses[0];
    if (!Data.POSITIONS.includes(state.pos)) state.pos = "QB";
    if (!["all", "home", "away"].includes(state.venue)) state.venue = "all";
    const span = model.maxWeek - model.minWeek + 1;
    state.recent = Math.max(1, Math.min(span, Math.trunc(state.recent) || 2));
    if (!["all", "recent", "custom", ...model.weeks.map(week => `week:${week}`)].includes(state.range)) state.range = "all";
    if (!model.weeks.includes(state.from)) state.from = model.minWeek;
    if (!model.weeks.includes(state.to)) state.to = model.maxWeek;
    if (state.from > state.to) state.to = state.from;
  }
  function options() {
    const recent = Data.recentSpan(model, state.recent);
    const ranges = [
      ["all", `Season so far (${model.weeks.length}w)`],
      ["recent", `Recent (${weekLabel(recent.from, recent.to)})`],
      ...model.weeks.map(week => [`week:${week}`, `Week ${week}`]), ["custom", "Custom range"],
    ];
    const rangeMarkup = ranges.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join("");
    for (const id of ["rangeSelect", "expandedRange"]) { $(id).innerHTML = rangeMarkup; $(id).value = state.range; }
    $("recentSelect").innerHTML = Array.from({ length: model.maxWeek - model.minWeek + 1 }, (_, i) => `<option value="${i + 1}">Last ${i + 1} week${i ? "s" : ""}</option>`).join("");
    $("recentSelect").value = String(state.recent);
    for (const id of ["fromSelect", "toSelect"]) $(id).innerHTML = model.weeks.map(week => `<option value="${week}">Week ${week}</option>`).join("");
    $("fromSelect").value = String(state.from);
    $("toSelect").value = String(state.to);
    $("customRange").hidden = state.range !== "custom";
    const defenses = model.defenses.map(team => `<option value="${team}">${team} · ${esc(Data.TEAM_NAMES[team])}</option>`).join("");
    for (const id of ["defenseSelect", "expandedDefense"]) { $(id).innerHTML = defenses; $(id).value = state.team; }
    $("venueSelect").value = state.venue;
    document.querySelectorAll("[data-position]").forEach(button => {
      button.dataset.pos = button.dataset.position;
      button.setAttribute("aria-pressed", String(button.dataset.position === state.pos));
    });
    document.documentElement.style.setProperty("--position", POS_COLORS[state.pos]);
  }
  function refresh({ rebuildOptions = false } = {}) {
    if (!model) return;
    normalizeState();
    if (rebuildOptions) options();
    else {
      for (const id of ["rangeSelect", "expandedRange"]) $(id).value = state.range;
      for (const id of ["defenseSelect", "expandedDefense"]) $(id).value = state.team;
      $("venueSelect").value = state.venue;
      $("customRange").hidden = state.range !== "custom";
      document.querySelectorAll("[data-position]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.position === state.pos)));
      document.documentElement.style.setProperty("--position", POS_COLORS[state.pos]);
    }
    datasets = {
      season: Data.summarize(model, { from: model.minWeek, to: model.maxWeek, venue: state.venue }),
      recent: Data.summarize(model, { ...Data.recentSpan(model, state.recent), venue: state.venue }),
      current: Data.summarize(model, scope()),
    };
    tooltips.clear(); hideTooltip();
    renderCoverage(); renderProfile(); renderHeatmap(); renderComparison(); renderInsights(); renderPlayers(); renderSource();
    $("dashboard").setAttribute("aria-busy", "false");
    saveURL();
  }
  function renderCoverage() {
    $("throughWeek").textContent = `Through Week ${model.maxWeek}`;
    $("coverage").innerHTML = [[model.defenses.length, "Defenses"], [model.weeks.length, "Weeks loaded"], [model.audit.usedRows, "Player records"]].map(([value, label]) => `<div class="coverageItem"><div class="coverageValue">${count(value)}</div><div class="coverageLabel">${label}</div></div>`).join("");
    $("scopeText").innerHTML = `<strong>2026</strong> / ${esc(rangeLabel())} / ${esc(venueLabel())} / <span class="positionBadge" data-pos="${state.pos}">${state.pos}</span>`;
    $("sampleNote").textContent = model.weeks.length <= 4 ? `${plural(model.weeks.length, "week")} of results · small early-season sample` : `${plural(model.weeks.length, "week")} of supplied results`;
    $("sourceStatusText").textContent = `${sourceKind} · ${plural(model.audit.usedRows, "matched record")}`;
  }
  function renderProfile() {
    const row = datasets.current.byTeam.get(state.team), stat = metric(), league = datasets.current.league[state.pos];
    $("defenseLogo").innerHTML = logo(state.team);
    $("defenseTitle").textContent = Data.TEAM_NAMES[state.team];
    $("defenseSubtitle").innerHTML = `vs. <span class="positionBadge" data-pos="${state.pos}">${state.pos}</span> <span> ${esc(rangeLabel())} · ${esc(venueLabel())}</span>`;
    const deviation = stat.avg !== null && league.avg !== null && league.avg !== 0 ? (stat.avg - league.avg) / Math.abs(league.avg) * 100 : null;
    const sample = stat.games !== row.games ? `${stat.games} of ${row.games} games with ${state.pos} data` : plural(stat.games, "observed game");
    $("metrics").innerHTML = `
      <div class="metric"><div class="metricLabel">FPA / game</div><div class="metricValue">${fmt(stat.avg, 1)}</div><div class="metricSub">${esc(sample)}</div></div>
      <div class="metric"><div class="metricLabel">Matchup rank</div><div class="metricValue" style="color:${heatColor(stat)}">${stat.rank ?? "—"}<small>${stat.rank === null ? "" : `/ ${stat.pool}`}</small></div><div class="metricSub">${rankDescription(stat)}</div></div>
      <div class="metric"><div class="metricLabel">Versus league</div><div class="metricValue ${deviation > 0 ? "is-easy" : deviation < 0 ? "is-tough" : ""}">${signed(deviation, 1)}${deviation === null ? "" : '<span class="percent">%</span>'}</div><div class="metricSub">League: <strong>${fmt(league.avg, 1)}</strong> FPA / game</div></div>`;
    $("weeklyScope").textContent = rangeLabel();
    $("weeklyLegend").textContent = `${state.team} ${state.pos} total`;
    renderWeeklyChart();
    $("positionSummary").innerHTML = Data.POSITIONS.map(pos => {
      const p = metric(state.team, pos);
      return `<button type="button" data-position="${pos}" aria-pressed="${pos === state.pos}" aria-label="Explore ${state.team} against ${pos}"><span class="positionBadge" data-pos="${pos}">${pos}</span><strong>${fmt(p.avg, 1)}</strong><span class="positionRank">${p.rank === null ? "No data" : `Rank ${p.rank} · ${plural(p.games, "game")}`}</span></button>`;
    }).join("");
    $("profileFootnote").textContent = stat.avg === null ? "No supplied results match this defense, position, range and venue." : `${fmt(stat.total)} recorded PPR points ÷ ${plural(stat.games, "observed game")} = ${fmt(stat.avg)} FPA per game. ${stat.games < row.games ? "Some observed games have no supplied records for this position." : "All assigned player scores are included."}`;
  }
  function chartWidth(id, maximum = 900) { return Math.max(280, Math.min(maximum, Math.round($(id).clientWidth || 560))); }
  function scaleBounds(values, { zero = true, steps = 4 } = {}) {
    const finite = values.filter(value => value !== null && Number.isFinite(value));
    let low = finite.length ? Math.min(...finite) : 0, high = finite.length ? Math.max(...finite) : 1;
    if (zero) { low = Math.min(0, low); high = Math.max(0, high); }
    if (high - low < 1) high = low + 1;
    const rough = (high - low) / steps, magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = ([1, 2, 5, 10].find(value => value * magnitude >= rough) || 10) * magnitude;
    low = Math.floor(low / step) * step; high = Math.ceil(high / step) * step;
    if (low === high) high += step;
    const ticks = [];
    for (let value = low; value <= high + step / 100; value += step) ticks.push(Math.abs(value) < .00001 ? 0 : value);
    return { low, high, ticks, step };
  }
  function axisLabel(value, bounds) { return fmt(value, bounds.step ? Math.max(0, -Math.floor(Math.log10(bounds.step))) : 0); }
  function svgFrame(id, width, height, title, content) {
    return `<svg viewBox="0 0 ${width} ${height}" role="group" aria-labelledby="${id}-title"><title id="${id}-title">${esc(title)}</title>${content}</svg>`;
  }
  function renderWeeklyChart() {
    const span = scope(), weeks = model.weeks.filter(week => week >= span.from && week <= span.to);
    const entries = weeks.map(week => {
      const summary = Data.summarize(model, { from: week, to: week, venue: state.venue });
      const game = model.gamesByKey.get(`${state.team}|${week}`);
      return { week, total: summary.byTeam.get(state.team).metrics[state.pos].avg, league: summary.league[state.pos].avg, game: game && Data.inScope(game, span) ? game : null };
    });
    $("weeklyBreakdown").innerHTML = entries.map(entry => {
      const opponent = entry.game?.offense;
      const matchup = opponent ? `${entry.game.venue === "home" ? "vs" : "@"} ${opponent}` : "Opponent unavailable";
      return `<div class="weekDetail"><strong>Week ${entry.week}</strong><span>${entry.game ? esc(matchup) : "No matching result"}</span><span class="weekPoints">${fmt(entry.total)}${entry.total === null ? "" : " pts"}</span></div>`;
    }).join("");
    if (!entries.some(entry => entry.total !== null)) { $("weeklyChart").innerHTML = empty("No matching weekly totals", "Choose another week range or defense venue."); return; }
    const W = chartWidth("weeklyChart"), H = 210, left = 34, right = W - 9, top = 24, bottom = H - 27;
    const bounds = scaleBounds(entries.flatMap(entry => [entry.total, entry.league]));
    const y = value => bottom - (value - bounds.low) / (bounds.high - bounds.low) * (bottom - top);
    const slot = (right - left) / entries.length, x = index => left + slot * (index + .5), bar = Math.min(58, slot * .42);
    let markup = bounds.ticks.map(value => `<line class="${value === 0 ? "zeroLine" : "gridLine"}" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 7}" y="${y(value) + 3}" text-anchor="end">${axisLabel(value, bounds)}</text>`).join("");
    entries.forEach((entry, index) => {
      if (entry.total !== null) {
        const key = `weekly:${entry.week}`;
        tooltips.set(key, `<strong>${state.team} vs. ${state.pos} · Week ${entry.week}</strong><br>${fmt(entry.total)} total PPR points allowed<br>League: ${fmt(entry.league)} FPA / game<br><span class="tooltipMuted">${entry.game?.venue === "home" ? "Defense at home" : "Defense away"}${entry.game?.offense ? ` against ${entry.game.offense}` : ""}</span>`);
        const labelY = entry.total >= 0 ? y(entry.total) - 8 : Math.min(bottom - 6, y(entry.total) + 15);
        markup += `<g class="chartPoint" role="img" tabindex="0" data-tooltip="${key}" aria-label="Week ${entry.week}: ${fmt(entry.total)} ${state.pos} points allowed"><rect x="${x(index) - bar / 2}" y="${Math.min(y(0), y(entry.total))}" width="${bar}" height="${Math.max(2, Math.abs(y(entry.total) - y(0)))}" rx="4" fill="${POS_COLORS[state.pos]}" fill-opacity=".7"/><text class="chartValue" x="${x(index)}" y="${labelY}" text-anchor="middle">${fmt(entry.total, 1)}</text></g>`;
      }
      if (entries.length <= 10 || index % 2 === 0 || index === entries.length - 1) markup += `<text x="${x(index)}" y="${bottom + 19}" text-anchor="middle">W${entry.week}</text>`;
    });
    let segment = [];
    function finishSegment() { if (segment.length) { markup += `<polyline class="leagueLine" points="${segment.join(" ")}"/>`; segment = []; } }
    entries.forEach((entry, index) => { if (entry.league === null) finishSegment(); else segment.push(`${x(index)},${y(entry.league)}`); });
    finishSegment();
    $("weeklyChart").innerHTML = svgFrame("weekly", W, H, `${state.team} total ${state.pos} points allowed by week, compared with the league average`, markup);
  }
  function renderHeatmap() {
    const sort = state.heatSort, metrics = [...Data.POSITIONS, "ALL"];
    const rows = [...datasets.current.rows].sort((a, b) => {
      const first = a.metrics[sort.metric].avg, second = b.metrics[sort.metric].avg;
      if (first === null || second === null) return first === null && second === null ? a.team.localeCompare(b.team) : first === null ? 1 : -1;
      return (sort.direction === "desc" ? second - first : first - second) || a.team.localeCompare(b.team);
    });
    const header = metrics.map(pos => `<th scope="col" aria-sort="${sort.metric === pos ? sort.direction === "desc" ? "descending" : "ascending" : "none"}"><button type="button" class="${sort.metric === pos ? "is-sorted" : ""}" data-heat-sort="${pos}" aria-label="Sort matchups by ${pos}">${pos === "ALL" ? "Total" : pos}${sort.metric === pos ? `<span class="sortArrow">${sort.direction === "desc" ? "↓" : "↑"}</span>` : ""}</button></th>`).join("");
    $("heatTable").innerHTML = `<caption class="srOnly">2026 defense matchup ranks and FPA per game for ${esc(rangeLabel())}, ${esc(venueLabel())}</caption><thead><tr><th scope="col">DEFENSE</th>${header}</tr></thead><tbody>${rows.map(row => `<tr class="${row.team === state.team ? "is-selected" : ""}"><td><button type="button" class="heatTeamButton" data-team="${row.team}" aria-label="Explore ${esc(Data.TEAM_NAMES[row.team])}">${logo(row.team)}<span><strong>${row.team}</strong><small>${row.games}g</small></span></button></td>${metrics.map(pos => {
      const p = row.metrics[pos], label = p.rank === null ? "No matching data" : `Rank ${p.rank} of ${p.pool}, ${fmt(p.avg)} FPA per game, ${plural(p.games, "game")} of ${row.games} observed`;
      return `<td><button type="button" class="heatCell${row.team === state.team && pos === state.pos ? " is-selected" : ""}" style="--heat:${heatColor(p)}" data-team="${row.team}" data-cell-position="${pos}" aria-label="${row.team} ${pos}: ${esc(label)}" title="${esc(label)}"><span class="heatRank">${p.rank ?? "—"}</span><span class="heatAverage">${fmt(p.avg, 1)}</span></button></td>`;
    }).join("")}</tr>`).join("")}</tbody>`;
    $("rankPoolNote").textContent = `${plural(datasets.current.pools[state.pos], "defense")} rated for ${state.pos}.`;
  }
  function renderComparison() {
    const recent = Data.recentSpan(model, state.recent);
    const rankComparable = datasets.season.pools[state.pos] === datasets.recent.pools[state.pos];
    if (!rankComparable && state.scatterMode === "rank") state.scatterMode = "avg";
    document.querySelectorAll("[data-scatter-mode]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.scatterMode === state.scatterMode));
      button.disabled = button.dataset.scatterMode === "rank" && !rankComparable;
      button.title = button.disabled ? "Rank comparison needs the same number of rated defenses in each range." : "";
    });
    $("comparisonSubtitle").textContent = `${state.pos} · Season ${weekLabel(model.minWeek, model.maxWeek)} vs. ${weekLabel(recent.from, recent.to)} · ${venueLabel()}`;
    $("comparisonNote").textContent = recent.from === model.minWeek ? "These windows contain the same supplied weeks." : rankComparable ? "" : "Rank pools differ; comparisons use points.";
    const ranked = state.scatterMode === "rank", points = model.defenses.map(team => {
      const comparison = Data.compare(datasets.season, datasets.recent, team, state.pos);
      return { team, x: ranked ? comparison.season.rank : comparison.season.avg, y: ranked ? comparison.recent.rank : comparison.recent.avg, comparison };
    }).filter(point => point.x !== null && point.y !== null);
    $("comparisonExplanation").textContent = ranked ? "Above the diagonal = a higher, easier matchup rank recently." : "Above the diagonal = more points allowed recently.";
    renderComparisonDetail(state.team);
    if (!points.length) { $("comparisonChart").innerHTML = empty("No comparable results", "Choose a venue with supplied results in both windows."); return; }
    const W = chartWidth("comparisonChart"), H = 270, left = 38, right = W - 17, top = 18, bottom = H - 38;
    const bounds = ranked ? { low: 0, high: Math.max(2, datasets.season.pools[state.pos] + 1), ticks: [...new Set([1, Math.ceil(datasets.season.pools[state.pos] / 4), Math.ceil(datasets.season.pools[state.pos] / 2), Math.ceil(datasets.season.pools[state.pos] * 3 / 4), datasets.season.pools[state.pos]])] } : scaleBounds(points.flatMap(point => [point.x, point.y]));
    const x = value => left + (value - bounds.low) / (bounds.high - bounds.low) * (right - left);
    const y = value => bottom - (value - bounds.low) / (bounds.high - bounds.low) * (bottom - top);
    let markup = bounds.ticks.map(value => `<line class="gridLine" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><line class="gridLine" y1="${top}" y2="${bottom}" x1="${x(value)}" x2="${x(value)}"/><text x="${left - 7}" y="${y(value) + 3}" text-anchor="end">${axisLabel(value, bounds)}</text><text x="${x(value)}" y="${bottom + 16}" text-anchor="middle">${axisLabel(value, bounds)}</text>`).join("");
    markup += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${top}" stroke="#7890a6" stroke-opacity=".65" stroke-dasharray="4 5"/><text class="axisTitle" x="${(left + right) / 2}" y="${H - 3}" text-anchor="middle">Season ${ranked ? "rank" : "FPA / game"}</text><text class="axisTitle" transform="translate(11 ${(top + bottom) / 2}) rotate(-90)" text-anchor="middle">Recent ${ranked ? "rank" : "FPA / game"}</text>`;
    points.sort((a, b) => Number(a.team === state.team) - Number(b.team === state.team)).forEach(point => {
      const key = `comparison:${point.team}`, c = point.comparison;
      tooltips.set(key, `<strong>${esc(Data.TEAM_NAMES[point.team])} · ${state.pos}</strong><br>Season: ${fmt(c.season.avg)} FPA / game (${plural(c.season.games, "game")})<br>Recent: ${fmt(c.recent.avg)} FPA / game (${plural(c.recent.games, "game")})<br><span class="${direction(c.deltaPoints)}">${signed(c.deltaPoints)} points / game</span>`);
      const selected = point.team === state.team;
      markup += `<g class="chartPoint" role="button" tabindex="0" data-chart-team="${point.team}" data-tooltip="${key}" aria-label="Explore ${point.team}: season ${fmt(point.x)}, recent ${fmt(point.y)} ${ranked ? "rank" : "FPA per game"}"><circle cx="${x(point.x)}" cy="${y(point.y)}" r="${selected ? 14 : 11}" fill="#142231" stroke="${selected ? POS_COLORS[state.pos] : heatColor(c.season)}" stroke-width="${selected ? 2 : 1}"/><image href="assets/NFL-Tags_webp/${point.team.toLowerCase()}.webp" x="${x(point.x) - 9}" y="${y(point.y) - 9}" width="18" height="18"/><title>${point.team}: ${fmt(point.x)} season, ${fmt(point.y)} recent</title></g>`;
    });
    $("comparisonChart").innerHTML = svgFrame("comparison", W, H, `${state.pos} defenses by season versus recent ${ranked ? "rank" : "fantasy points allowed per game"}. Points retain their exact data coordinates.`, markup);
  }
  function renderComparisonDetail(team) {
    const c = Data.compare(datasets.season, datasets.recent, team, state.pos);
    $("comparisonDetail").innerHTML = `<span class="comparisonTeam">${logo(team)}<strong>${team}</strong></span><span>Season <strong>${fmt(c.season.avg, 1)}</strong></span><span>Recent <strong>${fmt(c.recent.avg, 1)}</strong></span><span class="${direction(c.deltaPoints)}">${signed(c.deltaPoints)} pts / game</span>${c.deltaRank === null ? "" : `<span>${signed(c.deltaRank, 0)} rank</span>`}`;
  }
  function renderInsights() {
    const trend = ["up", "down"].includes(state.insight), recent = Data.recentSpan(model, state.recent);
    $("insightsPosition").textContent = state.pos; $("insightsPosition").dataset.pos = state.pos;
    $("insightsSubtitle").textContent = trend ? `${weekLabel(recent.from, recent.to)} versus the season so far · ${venueLabel()}` : `${rangeLabel()} · ${venueLabel()}`;
    document.querySelectorAll("[data-insight]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.insight === state.insight)));
    let rows;
    if (trend) {
      rows = model.defenses.map(team => ({ team, ...Data.compare(datasets.season, datasets.recent, team, state.pos) }))
        .filter(row => row.deltaPoints !== null && (state.insight === "up" ? row.deltaPoints > .000001 : row.deltaPoints < -.000001))
        .sort((a, b) => (state.insight === "up" ? b.deltaPoints - a.deltaPoints : a.deltaPoints - b.deltaPoints) || a.team.localeCompare(b.team));
    } else {
      rows = datasets.current.rows.filter(row => row.metrics[state.pos].avg !== null)
        .sort((a, b) => (state.insight === "easy" ? b.metrics[state.pos].avg - a.metrics[state.pos].avg : a.metrics[state.pos].avg - b.metrics[state.pos].avg) || a.team.localeCompare(b.team));
    }
    $("insightList").innerHTML = rows.length ? rows.slice(0, 6).map((row, index) => {
      const p = trend ? row.recent : row.metrics[state.pos];
      return `<button type="button" class="insightRow" data-team="${row.team}" aria-label="Explore ${esc(Data.TEAM_NAMES[row.team])} against ${state.pos}"><span class="insightIndex">${String(index + 1).padStart(2, "0")}</span>${logo(row.team)}<span class="insightTeam">${esc(Data.TEAM_NAMES[row.team])}<small>${row.team} · ${plural(p.games, "game")}${trend ? " in recent window" : ""}</small></span><span class="insightMetric" style="color:${trend ? row.deltaPoints > 0 ? "var(--mint)" : "var(--pink)" : heatColor(p)}">${trend ? signed(row.deltaPoints) : fmt(p.avg, 1)}<small>${trend ? "Δ FPA / game" : `FPA / game · Rank ${p.rank}`}</small></span></button>`;
    }).join("") : empty(trend ? "No change in this direction" : "No matching defenses", trend ? "Try a shorter recent window or a different defense venue." : "Choose another week range or venue.");
    $("insightFootnote").textContent = trend ? "Changes compare overlapping recent and season samples. Positive = more points allowed recently." : `Top ${Math.min(6, rows.length)} ${state.pos} matchups by unrounded FPA per game. Sample counts come from the supplied data.`;
  }
  function selectedPlayers() {
    const rows = Data.selectResults(model, { ...scope(), team: state.team, pos: state.pos, query: state.query, hideZero: state.hideZero });
    const sort = state.playerSort, getters = { week: row => row.week, player: row => row.player, team: row => row.playerTeam || "", vs: row => row.vs, venue: row => row.defenseVenue, pts: row => row.cents };
    return rows.sort((a, b) => {
      const first = getters[sort.key](a), second = getters[sort.key](b);
      const difference = typeof first === "string" ? first.localeCompare(second) : first - second;
      return (sort.direction === "asc" ? difference : -difference) || b.week - a.week || b.cents - a.cents || a.player.localeCompare(b.player);
    });
  }
  function playersTable(rows) {
    const columns = [["week", "Week", ""], ["player", "Player", ""], ["team", "Offense", "offenseColumn"], ["vs", "Player VS", "opponentColumn"], ["venue", "Defense venue", "venueColumn"], ["pts", "PPR", ""]];
    const head = columns.map(([key, title, className]) => `<th scope="col" class="${className}" aria-sort="${state.playerSort.key === key ? state.playerSort.direction === "asc" ? "ascending" : "descending" : "none"}"><button type="button" data-player-sort="${key}" aria-label="Sort players by ${title}">${title}${state.playerSort.key === key ? `<span class="sortArrow">${state.playerSort.direction === "asc" ? "↑" : "↓"}</span>` : ""}</button></th>`).join("");
    const body = rows.length ? rows.map(row => {
      const color = row.cents === 0 ? "scoreZero" : row.cents < 0 ? "scoreNegative" : row.pts >= ({ QB: 22, RB: 18, WR: 18, TE: 17 }[state.pos]) ? "scoreHigh" : "";
      return `<tr><td>W${row.week}</td><td><span class="playerName">${esc(row.player)}</span></td><td class="offenseColumn"><span class="offenseCell" title="${esc(Data.TEAM_NAMES[row.playerTeam] || "Offense not supplied")}">${logo(row.playerTeam)}${row.playerTeam || "—"}</span></td><td class="opponentColumn"><span class="playerOpponent">${esc(row.vs)}</span></td><td class="venueColumn"><span class="venueTag">${row.defenseVenue === "home" ? "Home" : "Away"}</span></td><td class="${color}">${fmt(row.pts)}</td></tr>`;
    }).join("") : `<tr><td colspan="6">${empty("No player results match", "Try another defense, position, week range, or clear the player filters.", '<button type="button" class="button" data-clear-search>Clear player filters</button>')}</td></tr>`;
    return `<caption class="srOnly">Recorded ${state.pos} player results against ${state.team}, ${esc(rangeLabel())}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  }
  function renderPlayers() {
    const rows = selectedPlayers(), total = rows.reduce((sum, row) => sum + row.cents, 0) / 100;
    const subtitle = `${state.team} defense vs. ${POS_NAMES[state.pos]} · ${rangeLabel()} · ${venueLabel()}`;
    $("playersSubtitle").textContent = subtitle; $("expandedSubtitle").textContent = subtitle;
    for (const id of ["playerSearch", "expandedSearch"]) if ($(id).value !== state.query) $(id).value = state.query;
    for (const id of ["hideZero", "expandedHideZero"]) $(id).checked = state.hideZero;
    document.querySelectorAll("[data-player-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.playerView === state.playerView)));
    $("playerTableWrap").hidden = state.playerView !== "table";
    $("playerPlot").hidden = state.playerView !== "plot";
    if (state.playerView === "table") $("playerTable").innerHTML = playersTable(rows);
    else renderPlayerPlot(rows);
    if ($("playersDialog").open) $("expandedTable").innerHTML = playersTable(rows);
    const label = `${plural(rows.length, "player record")} · ${fmt(total)} displayed PPR points${state.hideZero ? " · Zero scores hidden" : " · Zero and negative scores included"}`;
    $("playerCount").textContent = label; $("expandedCount").textContent = label;
  }
  function renderPlayerPlot(rows) {
    if (!rows.length) { $("playerPlot").innerHTML = empty("No player points to plot", "Change the matchup or clear the player filters."); return; }
    const W = chartWidth("playerPlot"), H = 280, left = 38, right = W - 14, top = 24, bottom = H - 34;
    const weeks = model.weeks.filter(week => week >= scope().from && week <= scope().to);
    const x = week => left + (right - left) * (weeks.indexOf(week) + .5) / weeks.length;
    const bounds = scaleBounds(rows.map(row => row.pts)), y = value => bottom - (value - bounds.low) / (bounds.high - bounds.low) * (bottom - top);
    const groups = new Map();
    rows.forEach(row => { const key = `${row.week}|${row.cents}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
    let markup = bounds.ticks.map(value => `<line class="${value === 0 ? "zeroLine" : "gridLine"}" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 7}" y="${y(value) + 3}" text-anchor="end">${axisLabel(value, bounds)}</text>`).join("");
    weeks.forEach(week => { markup += `<line class="gridLine" x1="${x(week)}" x2="${x(week)}" y1="${top}" y2="${bottom}"/><text x="${x(week)}" y="${bottom + 19}" text-anchor="middle">W${week}</text>`; });
    const mean = rows.reduce((sum, row) => sum + row.cents, 0) / 100 / rows.length;
    markup += `<line class="leagueLine" x1="${left}" x2="${right}" y1="${y(mean)}" y2="${y(mean)}"/><text x="${right}" y="${top - 10}" text-anchor="end">Displayed player mean: ${fmt(mean)}</text>`;
    let index = 0;
    for (const group of groups.values()) {
      const first = group[0], key = `player:${index++}`;
      tooltips.set(key, `<strong>Week ${first.week} · ${fmt(first.pts)} PPR points</strong><br>${group.map(row => `${esc(row.player)}${row.playerTeam ? ` (${row.playerTeam})` : ""}`).join("<br>")}<br><span class="tooltipMuted">${group.length > 1 ? `${group.length} equal scores share this dot.` : esc(first.vs)}</span>`);
      markup += `<g class="chartPoint" role="img" tabindex="0" data-tooltip="${key}" aria-label="Week ${first.week}: ${fmt(first.pts)} points, ${esc(group.map(row => row.player).join(", "))}"><circle cx="${x(first.week)}" cy="${y(first.pts)}" r="${group.length > 1 ? 8 : 6}" fill="${POS_COLORS[state.pos]}" fill-opacity="${first.cents === 0 ? ".4" : ".75"}" stroke="${POS_COLORS[state.pos]}" stroke-width="1"/>${group.length > 1 ? `<text x="${x(first.week)}" y="${y(first.pts) + 3}" text-anchor="middle" style="fill:#0b1017;font-weight:700;font-size:9px">${group.length}</text>` : ""}</g>`;
    }
    $("playerPlot").innerHTML = svgFrame("players-plot", W, H, `${state.pos} individual player scores against ${state.team}. Negative and zero scores are included; equal scores in a week share a dot.`, markup) + '<p class="smallMuted" style="padding:8px 0">Each dot shows a player record. Hover or focus to see names. Equal scores in the same week share a dot. The dashed line is the mean of displayed player scores.</p>';
  }
  function renderSource() {
    const a = model.audit;
    $("sourceCard").innerHTML = `<div class="sourceCardTitle"><span class="liveDot"></span><strong>${esc(model.name)}</strong></div><p>${sourceKind} · 2026 · ${esc(weekLabel(model.minWeek, model.maxWeek))} · PPR scoring</p><div class="sourceCardStats"><div><strong>${count(a.sourceRows)}</strong><span>source rows</span></div><div><strong>${count(a.usedRows)}</strong><span>matched results</span></div><div><strong>${count(a.excludedRows)}</strong><span>without an opponent</span></div></div>`;
    const missing = model.diagnostics.missingPositions, unpaired = model.diagnostics.unpairedGames;
    $("sourceDiagnostics").innerHTML = `<div class="diagnosticsText">${plural(model.weeks.length, "week")} loaded: ${model.weeks.join(", ")}. ${plural(model.defenses.length, "defense")}, ${plural(a.defenseGames, "defense-game observation")}${a.matchups === null ? ". Opponent offenses are not fully supplied." : `, ${plural(a.matchups, "unique matchup")}.`}<br>${plural(a.zeroResults, "assigned zero score")} and ${plural(a.negativeResults, "negative score")} included. Total assigned points: <strong>${fmt(a.totalPoints)}</strong>.<br>${missing.length ? `${missing.length} defense games have a position without supplied records. Affected position totals stay unavailable for those games.` : "Every observed defense game has records for all four positions."}${unpaired.length ? `<br>${unpaired.length} observations lack the other defense's reverse matchup in this file.` : ""}</div>${missing.length ? `<table class="diagnosticsTable"><thead><tr><th>Week</th><th>Defense</th><th>Missing position</th></tr></thead><tbody>${missing.map(row => `<tr><td>${row.week}</td><td>${row.defense}</td><td>${row.positions.join(", ")}</td></tr>`).join("")}</tbody></table>` : ""}${model.excluded.length ? `<p class="diagnosticsText">The following rows have no opposing defense and are excluded from matchup totals.</p><table class="diagnosticsTable"><thead><tr><th>Week</th><th>Player</th><th>VS</th><th>PPR</th></tr></thead><tbody>${model.excluded.map(row => `<tr><td>${row.week}</td><td>${esc(row.player)}</td><td>${esc(row.vs) || "Blank"}</td><td>${fmt(row.pts)}</td></tr>`).join("")}</tbody></table>` : '<p class="diagnosticsText">No rows were excluded for a missing opponent.</p>'}`;
  }
  function hideTooltip() { $("chartTooltip").hidden = true; }
  function showTooltip(target, event) {
    const content = tooltips.get(target.dataset.tooltip);
    if (!content) return;
    const tip = $("chartTooltip"); tip.innerHTML = content; tip.hidden = false;
    const rect = target.getBoundingClientRect(), x = event?.clientX ?? rect.left + rect.width / 2, y = event?.clientY ?? rect.top + rect.height / 2;
    tip.style.left = `${Math.max(10, Math.min(innerWidth - tip.offsetWidth - 10, x + 12))}px`;
    tip.style.top = `${Math.max(10, Math.min(innerHeight - tip.offsetHeight - 10, y + 16))}px`;
    if (target.dataset.chartTeam) renderComparisonDetail(target.dataset.chartTeam);
  }
  function openDialog(id) {
    hideTooltip();
    if (id === "playersDialog" && model) { $("expandedTable").innerHTML = playersTable(selectedPlayers()); }
    if (!$(id).open) $(id).showModal();
    document.documentElement.style.overflow = "hidden";
  }
  function csvText(headers, rows) {
    const cell = value => {
      let text = value === null || value === undefined ? "" : String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers, ...rows].map(row => row.map(cell).join(",")).join("\r\n");
  }
  function download(name, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" }), url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportRankings() {
    const positions = [...Data.POSITIONS, "ALL"];
    const headers = ["SEASON", "FROM_WEEK", "TO_WEEK", "DEFENSE_VENUE", "DEFENSE", "OBSERVED_GAMES", ...positions.flatMap(pos => [`${pos}_FPA_PER_GAME`, `${pos}_RANK`, `${pos}_RATED_DEFENSES`, `${pos}_GAMES`])];
    const range = scope();
    const rows = datasets.current.rows.map(row => [2026, range.from, range.to, state.venue, row.team, row.games, ...positions.flatMap(pos => { const p = row.metrics[pos]; return [p.avg, p.rank, p.pool, p.games]; })]);
    download(`2026-matchup-rankings-W${range.from}-${range.to}-${state.venue}.csv`, csvText(headers, rows));
    notice("Current matchup rankings downloaded.");
  }
  function exportPlayers() {
    const rows = selectedPlayers().map(row => [row.week, row.playerId.startsWith(`${row.pos}:`) ? "" : row.playerId, row.player, row.pos, row.playerTeam, row.pts, row.vs, row.def, row.defenseVenue]);
    download(`2026-${state.team}-${state.pos}-player-results.csv`, csvText(["WEEK", "SLPR_ID", "PLAYER NAME", "POS", "TM", "FPT_PPR", "VS", "DEFENSE", "DEFENSE_VENUE"], rows));
    notice(`${plural(rows.length, "player result")} downloaded.`);
  }
  async function builtinSource() {
    const snapshot = window.FPA_SOURCE;
    let fetchError = null;
    if (location.protocol !== "file:") {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
      try {
        const name = snapshot?.name || "2026-Wkly - FPA.csv";
        const response = await fetch(`data/${encodeURIComponent(name)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`Source CSV returned HTTP ${response.status}.`);
        const parsed = Data.readSource(await response.text(), { name });
        return { model: parsed, kind: "Provided CSV", message: "" };
      } catch (error) { fetchError = error; }
      finally { clearTimeout(timer); }
    }
    if (!snapshot?.csv) throw fetchError || new Error("The bundled source is unavailable. Upload your 2026 CSV in Data & updates.");
    return {
      model: Data.readSource(snapshot.csv, { name: snapshot.name }),
      kind: location.protocol === "file:" ? "Provided CSV · offline copy" : "Bundled CSV snapshot",
      message: fetchError ? `The bundled CSV snapshot is shown because the source file could not be loaded: ${fetchError.message}` : "",
    };
  }
  function useSource(next, kind) {
    model = next; sourceKind = kind;
    state.query = ""; state.hideZero = false;
    refresh({ rebuildOptions: true });
    warning();
  }
  async function importFile(file) {
    if (importing || !file) return;
    importing = true; $("fileInput").disabled = true; $("restoreSource").disabled = true;
    $("uploadMessage").classList.remove("is-error"); $("uploadMessage").textContent = "Reading and validating weekly results…";
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("This CSV is larger than 8 MB. Use a season-to-date player export.");
      const text = await file.text(), next = Data.readSource(text, { name: file.name });
      let saved = true;
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ season: 2026, name: file.name, csv: text })); } catch { saved = false; }
      useSource(next, "Uploaded CSV");
      $("uploadMessage").textContent = `Loaded ${plural(next.audit.usedRows, "matchup result")} through Week ${next.maxWeek}. ${plural(next.audit.excludedRows, "row")} without an opponent excluded. ${saved ? "Saved in this browser." : "Browser storage is unavailable; this upload lasts for this session."}`;
    } catch (error) {
      $("uploadMessage").classList.add("is-error");
      $("uploadMessage").textContent = `${error.message} ${model ? "The current dataset is still loaded." : "Choose a valid CSV to load matchup results."}`;
    } finally { importing = false; $("fileInput").disabled = false; $("restoreSource").disabled = false; $("fileInput").value = ""; }
  }
  function changeTeam(team, pos = state.pos) {
    if (!model.defenses.includes(team)) return;
    state.team = team;
    if (Data.POSITIONS.includes(pos)) { state.pos = pos; state.heatSort.metric = pos; }
    refresh();
  }
  function bindEvents() {
    $("openData").addEventListener("click", () => openDialog("dataDialog"));
    $("sourceStatus").addEventListener("click", () => openDialog("dataDialog"));
    $("expandPlayers").addEventListener("click", () => { if (model) { openDialog("playersDialog"); renderPlayers(); } });
    document.querySelectorAll("dialog").forEach(dialog => {
      dialog.addEventListener("close", () => { document.documentElement.style.overflow = ""; });
      dialog.addEventListener("click", event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
    });
    document.addEventListener("click", event => {
      const target = event.target.closest("button,[data-chart-team]");
      if (!target) return;
      if (target.hasAttribute("data-close-dialog")) { target.closest("dialog").close(); return; }
      if (!model) return;
      if (target.dataset.position) { state.pos = target.dataset.position; state.heatSort.metric = state.pos; refresh(); }
      else if (target.dataset.team || target.dataset.chartTeam) changeTeam(target.dataset.team || target.dataset.chartTeam, target.dataset.cellPosition === "ALL" ? state.pos : target.dataset.cellPosition || state.pos);
      else if (target.dataset.heatSort) {
        state.heatSort.direction = state.heatSort.metric === target.dataset.heatSort && state.heatSort.direction === "desc" ? "asc" : "desc";
        state.heatSort.metric = target.dataset.heatSort; renderHeatmap();
      } else if (target.dataset.playerSort) {
        state.playerSort.direction = state.playerSort.key === target.dataset.playerSort ? state.playerSort.direction === "desc" ? "asc" : "desc" : ["week", "pts"].includes(target.dataset.playerSort) ? "desc" : "asc";
        state.playerSort.key = target.dataset.playerSort; renderPlayers();
      } else if (target.dataset.scatterMode) { state.scatterMode = target.dataset.scatterMode; renderComparison(); }
      else if (target.dataset.insight) { state.insight = target.dataset.insight; renderInsights(); }
      else if (target.dataset.playerView) { state.playerView = target.dataset.playerView; renderPlayers(); }
      else if (target.hasAttribute("data-clear-search")) { state.query = ""; state.hideZero = false; renderPlayers(); }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") hideTooltip();
      const point = event.target.closest("[data-chart-team]");
      if (model && point && ["Enter", " "].includes(event.key)) { event.preventDefault(); changeTeam(point.dataset.chartTeam); }
    });
    document.addEventListener("pointerover", event => { const target = event.target.closest("[data-tooltip]"); if (target) showTooltip(target, event); });
    document.addEventListener("pointerout", event => { if (event.target.closest("[data-tooltip]") && !event.relatedTarget?.closest?.("[data-tooltip]")) hideTooltip(); });
    document.addEventListener("focusin", event => { const target = event.target.closest("[data-tooltip]"); if (target) showTooltip(target); else hideTooltip(); });
    document.addEventListener("scroll", hideTooltip, true);
    for (const id of ["defenseSelect", "expandedDefense"]) $(id).addEventListener("change", event => { if (model) changeTeam(event.target.value); });
    for (const id of ["rangeSelect", "expandedRange"]) $(id).addEventListener("change", event => { if (model) { state.range = event.target.value; refresh(); } });
    $("recentSelect").addEventListener("change", event => { if (model) { state.recent = Number(event.target.value); refresh({ rebuildOptions: true }); } });
    $("venueSelect").addEventListener("change", event => { if (model) { state.venue = event.target.value; refresh(); } });
    $("fromSelect").addEventListener("change", event => { if (model) { state.from = Number(event.target.value); if (state.from > state.to) state.to = state.from; refresh({ rebuildOptions: true }); } });
    $("toSelect").addEventListener("change", event => { if (model) { state.to = Number(event.target.value); if (state.to < state.from) state.from = state.to; refresh({ rebuildOptions: true }); } });
    for (const id of ["playerSearch", "expandedSearch"]) $(id).addEventListener("input", event => { if (model) { state.query = event.target.value; renderPlayers(); } });
    for (const id of ["hideZero", "expandedHideZero"]) $(id).addEventListener("change", event => { if (model) { state.hideZero = event.target.checked; renderPlayers(); } });
    $("resetFilters").addEventListener("click", () => {
      if (!model) return;
      Object.assign(state, { pos: "QB", range: "all", recent: 2, venue: "all", from: model.minWeek, to: model.maxWeek, query: "", hideZero: false });
      state.heatSort = { metric: "QB", direction: "desc" }; refresh({ rebuildOptions: true }); notice("Filters reset to the season so far.");
    });
    $("fileInput").addEventListener("change", event => importFile(event.target.files[0]));
    $("restoreSource").addEventListener("click", async () => {
      if (importing) return;
      importing = true; $("fileInput").disabled = true; $("restoreSource").disabled = true;
      try {
        const source = await builtinSource();
        let cleared = true;
        try { localStorage.removeItem(STORE_KEY); } catch { cleared = false; }
        useSource(source.model, source.kind); warning(source.message);
        $("uploadMessage").classList.remove("is-error"); $("uploadMessage").textContent = `The supplied 2026 dataset has been restored. ${cleared ? "The browser's uploaded override was cleared." : "Browser storage is unavailable; the restore applies to this session."}`;
      } catch (error) { $("uploadMessage").classList.add("is-error"); $("uploadMessage").textContent = error.message; }
      finally { importing = false; $("fileInput").disabled = false; $("restoreSource").disabled = false; }
    });
    $("downloadSource").addEventListener("click", () => { if (model) download(model.name, model.rawCSV); });
    $("exportRankings").addEventListener("click", () => { if (model) exportRankings(); });
    $("exportPlayers").addEventListener("click", () => { if (model) exportPlayers(); });
    document.querySelectorAll(".navigation a").forEach(link => link.addEventListener("click", () => { document.querySelectorAll(".navigation a").forEach(other => other.classList.toggle("is-active", other === link)); }));
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer); hideTooltip();
      resizeTimer = setTimeout(() => { if (model) { renderWeeklyChart(); renderComparison(); if (state.playerView === "plot") renderPlayerPlot(selectedPlayers()); } }, 120);
    });
  }
  async function init() {
    bindEvents(); readURL();
    let storedWarning = "";
    try {
      try {
        const saved = localStorage.getItem(STORE_KEY);
        if (saved) {
          const source = JSON.parse(saved);
          if (source.season !== 2026) throw new Error("Saved upload is not a 2026 dataset.");
          useSource(Data.readSource(source.csv, { name: source.name }), "Uploaded CSV");
          return;
        }
      } catch (error) { storedWarning = `The saved upload could not be read. ${error.message} `; }
      const source = await builtinSource();
      useSource(source.model, source.kind); warning(storedWarning + source.message);
    } catch (error) {
      warning(error.message); $("scopeText").textContent = "Upload the supplied CSV to begin.";
      $("throughWeek").textContent = "CSV needed"; $("sourceStatusText").textContent = "Choose weekly data";
      $("dashboard").setAttribute("aria-busy", "false"); openDialog("dataDialog");
    }
  }
  init();
})();
