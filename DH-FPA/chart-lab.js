/* Additional amCharts views share the original page's data and selection. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id), Model = window.FPAChartLabData;
  const scenes = new Map(), observed = new Set();
  const definitions = [
    { id: "labBreakdown", title: "Scoring allowed, position by position", kind: "all", nativeResolution: true, create: scoringBreakdown },
    { id: "labDumbbell", title: "Actual vs. expected, team by team", kind: "position", nativeResolution: true, create: actualExpectedDumbbells },
    { id: "labPolar", title: "Every game, on its defense’s spoke", kind: "position", create: polarScatter },
  ];
  let current = null, snapshot = null, observer = null, styleObserver = null, styleTimer = null;
  const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : "—";
  const signedPoints = n => Number.isFinite(n) ? `${n > 0 ? "+" : ""}${fmt(Math.abs(n) < 1e-9 ? 0 : n, 1)}` : "—";
  const color = value => am5.color(value);
  const teamMarkup = team => `<span class="labTeam"><img src="assets/NFL-Tags_webp/${team.toLowerCase()}.webp" alt=""><strong>${team}</strong></span>`;
  const venueText = () => current.venue === "home" ? "Defense at home" : current.venue === "away" ? "Defense away" : "All games";
  // HTML headings/legends use normal CSS. Canvas text reads these CSS properties.
  function textStyle(host) {
    const css = getComputedStyle(host);
    const value = (name, fallback) => css.getPropertyValue(`--am-${name}`).trim() || fallback;
    const size = (name, fallback) => { const n = parseFloat(value(name, "")); return n > 0 ? n : fallback; };
    return { fontFamily: css.fontFamily, chartPaddingRight: size("chart-padding-right", 20),
      axisSize: size("axis-font-size", 10), axisColor: value("axis-color", "#97afd1"), axisWeight: value("axis-font-weight", "400"),
      teamSize: size("team-font-size", 11), teamColor: value("team-color", "#b6c9e9"), teamWeight: value("team-font-weight", "500"),
      labelSize: size("label-font-size", 10), labelColor: value("label-color", "#bacdeb"), labelWeight: value("label-font-weight", "400"),
      selectedColor: value("selected-text-color", "#f1f6ff"), selectedWeight: value("selected-font-weight", "600"),
      tooltipSize: size("tooltip-font-size", 11), tooltipColor: value("tooltip-color", "#dae6ff"), tooltipWeight: value("tooltip-font-weight", "400"),
      tooltipBackground: value("tooltip-background", "#0a1427"), tooltipBorder: value("tooltip-border", "#9cbbee"), tooltipLineHeight: size("tooltip-line-height", 135),
      centerSize: size("center-font-size", 13), centerTeamSize: size("center-team-font-size", 27), centerDetailSize: size("center-detail-font-size", 10),
      centerColor: value("center-color", "#c7daf9"), centerWeight: value("center-font-weight", "500") };
  }
  function makeScene(definition) {
    const host = $(definition.id); host.replaceChildren();
    const text = textStyle(host);
    // The library's safe resolution forces 1x canvases on iOS. These compact XY
    // charts can render at device pixel density without stretching a 1x bitmap.
    const root = am5.Root.new(host, { fontFamily: text.fontFamily, fontSize: text.labelSize, ariaLabel: definition.title,
      ...(definition.nativeResolution ? { useSafeResolution: false } : {}) });
    root.fps = 30;
    const theme = am5.Theme.new(root);
    theme.rule("Label").setAll({ fill: color(text.labelColor), fontSize: text.labelSize, fontFamily: text.fontFamily, fontWeight: text.labelWeight });
    theme.rule("Grid").setAll({ stroke: color(0x9ab6e0), strokeOpacity: .1 });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) theme.rule("Component").setAll({ interpolationDuration: 0 });
    root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root), theme]);
    root.numberFormatter.set("numberFormat", "#,###.##");
    root.container.set("layout", root.verticalLayout);
    const tip = am5.Tooltip.new(root, { getFillFromSprite: false, autoTextColor: false });
    tip.get("background").setAll({ fill: color(text.tooltipBackground), fillOpacity: .98,
      stroke: color(text.tooltipBorder), strokeOpacity: .35, cornerRadius: 9 });
    tip.label.setAll({ fill: color(text.tooltipColor), fontSize: text.tooltipSize, fontFamily: text.fontFamily,
      fontWeight: text.tooltipWeight, paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, lineHeight: am5.percent(text.tooltipLineHeight) });
    root.container.set("tooltip", tip);
    const button = host.closest("[data-amchart-panel]").querySelector("[data-lab-focus]");
    const scene = { id: definition.id, root, text, styleSignature: JSON.stringify(text), subtitle: $(`${definition.id}Subtitle`),
      markers: new Set(), signature: null, spotlight: button?.getAttribute("aria-pressed") === "true",
      button, labelRenderers: [], paint: null, setData: null, select: () => selectMarkers(scene) };
    scenes.set(definition.id, scene); return scene;
  }
  function xy(scene, settings = {}) {
    return scene.root.container.children.push(am5xy.XYChart.new(scene.root, { panX: false, panY: false,
      wheelX: "none", wheelY: "none", paddingLeft: 12, paddingRight: 20, paddingTop: 13, paddingBottom: 12, ...settings }));
  }
  function axisStyle(scene, renderer, team = false) {
    const t = scene.text;
    renderer.labels.template.setAll({ fontSize: team ? t.teamSize : t.axisSize, fontWeight: team ? t.teamWeight : t.axisWeight,
      fill: color(team ? t.teamColor : t.axisColor), paddingTop: 3, paddingBottom: 3 });
    renderer.grid.template.setAll({ stroke: color(0x9ab6e0), strokeOpacity: .09 });
  }
  function legend(scene, entries) {
    const host = $(`${scene.id}Legend`); host.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement("span"), swatch = document.createElement("i"), label = document.createElement("span");
      if (entry.fill) swatch.style.setProperty("--legend-color", entry.fill.toCSSHex());
      if (entry.gradient) swatch.style.setProperty("--legend-gradient", entry.gradient);
      if (entry.symbol) { swatch.className = "labLegendSymbol"; swatch.textContent = entry.symbol; }
      label.textContent = entry.text; item.append(swatch, label); host.append(item);
    }
  }
  function register(scene, row, sprite, paint) {
    sprite.setAll({ focusable: true, focusableGroup: `${scene.id}-${row.pos}`, hoverOnFocus: true, role: "button",
      cursorOverStyle: "pointer", ariaLabel: sprite.get("tooltipText")?.replace(/\[[^\]]*\]/g, "") });
    sprite.events.on("click", () => current.select(row.team, row.pos));
    const marker = { row, sprite, paint }; scene.markers.add(marker);
    paint(row.team === current.team); return sprite;
  }
  function selectMarkers(scene) {
    for (const renderer of scene.labelRenderers) renderer.labels.each(label => { label.markDirtyKey("fill"); label.markDirtyKey("text"); });
    for (const marker of scene.markers) {
      if (marker.sprite.isDisposed()) { scene.markers.delete(marker); continue; }
      const selected = marker.row.team === current.team;
      marker.paint(selected); marker.sprite.set("opacity", scene.spotlight && !selected ? .12 : 1);
    }
    if (scene.button) {
      scene.button.textContent = `${scene.spotlight ? "Focused:" : "Focus"} ${current.team}`;
      scene.button.setAttribute("aria-pressed", String(scene.spotlight));
    }
    scene.paint?.();
  }
  function cellTooltip(row) {
    return `[bold]${row.team} · ${row.pos}[/]\n${fmt(row.avg, 2)} FPA/game · rank ${row.rank ?? "—"} of ${row.pool}\nOpponent baseline: ${fmt(row.expectedAvg, 2)} /game\n${row.games} recorded games\nSelect to explore this defense and position`;
  }
  function scoringBreakdown(definition) {
    const scene = makeScene(definition), root = scene.root, palette = am5.ColorSet.new(root, {});
    const positions = Model.POSITIONS.slice(0, 4);
    legend(scene, positions.map((pos, index) => ({ text: pos, fill: palette.getIndex(index) })));
    const chart = xy(scene, { paddingLeft: 9, paddingRight: scene.text.chartPaddingRight, paddingTop: 4 });
    const xr = am5xy.AxisRendererX.new(root, { minGridDistance: 65 }), yr = am5xy.AxisRendererY.new(root, { minGridDistance: 1, inversed: true });
    axisStyle(scene, xr); axisStyle(scene, yr, true); yr.labels.template.setAll({ paddingTop: 0, paddingBottom: 0, paddingRight: 12 });
    yr.grid.template.set("forceHidden", true);
    const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { min: 0, strictMinMax: true, renderer: xr }));
    const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: yr }));
    yr.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(scene.text.selectedColor) : fill);
    scene.labelRenderers.push(yr);
    const seriesByPos = new Map();
    positions.forEach((pos, index) => {
      const tint = palette.getIndex(index);
      const gradient = am5.LinearGradient.new(root, { rotation: 0, stops: [
        { color: tint, opacity: .45 }, { color: tint, opacity: .94 } ] });
      const series = chart.series.push(am5xy.ColumnSeries.new(root, { name: pos, xAxis, yAxis, baseAxis: yAxis,
        categoryYField: "team", valueXField: pos, stacked: true, fill: tint, stroke: tint }));
      series.columns.template.setAll({ height: 14, fillGradient: gradient, strokeOpacity: .15, strokeWidth: .5,
        cornerRadiusTL: 2, cornerRadiusTR: 2, cornerRadiusBL: 2, cornerRadiusBR: 2 });
      series.events.on("datavalidated", () => {
        series.columns.each(column => {
          const data = column.dataItem?.dataContext; if (!data?.team) return;
          const row = snapshot.cells.find(cell => cell.team === data.team && cell.pos === pos);
          column.set("tooltipText", cellTooltip(row));
          register(scene, row, column, selected => column.setAll({ fillOpacity: selected ? 1 : .77,
            stroke: selected ? color(0xe2efff) : tint, strokeOpacity: selected ? .85 : .15,
            strokeWidth: selected ? 1.2 : .5 }));
        });
        scene.select();
      });
      seriesByPos.set(pos, series);
    });
    const totals = chart.series.push(am5xy.LineSeries.new(root, { xAxis, yAxis, categoryYField: "team", valueXField: "avg",
      minBulletDistance: 0, maskBullets: false }));
    totals.strokes.template.set("forceHidden", true);
    totals.bullets.push((root, series, item) => {
      const row = item.dataContext;
      const label = am5.Label.new(root, { text: fmt(row.avg, 2), centerY: am5.percent(50), dx: 7,
        fontSize: scene.text.labelSize, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, tooltipText: cellTooltip(row) });
      register(scene, row, label, selected => label.setAll({ fill: color(selected ? scene.text.selectedColor : scene.text.labelColor), fontWeight: selected ? scene.text.selectedWeight : scene.text.labelWeight }));
      return am5.Bullet.new(root, { sprite: label });
    });
    scene.setData = view => {
      scene.markers.clear();
      scene.subtitle.textContent = `ALL POSITIONS · FPA PER GAME · 32 DEFENSES · HIGHEST SCORING FIRST · ${venueText().toUpperCase()}`;
      const rows = [...view.breakdown].sort((a, b) => b.avg - a.avg || a.team.localeCompare(b.team));
      const bounds = Model.extent(rows.map(row => row.avg), 10, true);
      xAxis.setAll({ min: bounds.min, max: Math.max(10, bounds.max) }); yAxis.data.setAll(rows);
      seriesByPos.forEach(series => series.data.setAll(rows));
      totals.data.setAll(rows);
    };
    return scene;
  }

  function actualExpectedDumbbells(definition) {
    const scene = makeScene(definition), root = scene.root, palette = am5.ColorSet.new(root, {});
    const specs = { highest: [8, 7], upper: [5, 3], lower: [2, 0], lowest: [0, 18] };
    const treatments = Object.fromEntries(Object.entries(specs).map(([key, indices]) => {
      const colors = [am5.Color.brighten(palette.getIndex(indices[0]), -.3), palette.getIndex(indices[0]),
        am5.Color.brighten(palette.getIndex(indices[1]), .18)];
      const stops = colors.map((tint, index) => ({ color: tint, offset: index / 2, opacity: [.72, .95, 1][index] }));
      return [key, {
        forward: am5.LinearGradient.new(root, { rotation: 0, stops }),
        reverse: am5.LinearGradient.new(root, { rotation: 0, stops: [...stops].reverse().map((stop, index) => ({ ...stop, offset: index / 2 })) }),
        tint: colors[2], css: `linear-gradient(90deg,${colors.map(tint => tint.toCSSHex()).join(",")})` }];
    }));
    legend(scene, [{ text: "EXPECTED", symbol: "○", fill: color(0xd4e4ff) }, { text: "ACTUAL", symbol: "●", fill: color(0xd4e4ff) },
      { text: "HIGHEST FPA", gradient: treatments.highest.css }, { text: "UPPER FPA", gradient: treatments.upper.css },
      { text: "LOWER FPA", gradient: treatments.lower.css }, { text: "LOWEST FPA", gradient: treatments.lowest.css }]);
    const chart = xy(scene, { paddingLeft: 9, paddingRight: scene.text.chartPaddingRight, paddingTop: 4 });
    const xr = am5xy.AxisRendererX.new(root, { minGridDistance: 65 }), yr = am5xy.AxisRendererY.new(root, { minGridDistance: 1, inversed: true });
    axisStyle(scene, xr); axisStyle(scene, yr, true); yr.labels.template.setAll({ paddingTop: 0, paddingBottom: 0, paddingRight: 28 });
    yr.grid.template.setAll({ strokeOpacity: .04, location: .5 });
    const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { strictMinMax: true, renderer: xr }));
    const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: yr }));
    yr.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(scene.text.selectedColor) : fill);
    scene.labelRenderers.push(yr);
    const connector = chart.series.push(am5xy.ColumnSeries.new(root, { xAxis, yAxis, baseAxis: yAxis,
      categoryYField: "team", openValueXField: "lowTotal", valueXField: "highTotal", clustered: false }));
    connector.columns.template.setAll({ height: 4, strokeOpacity: 0, cornerRadiusTL: 3, cornerRadiusTR: 3,
      cornerRadiusBL: 3, cornerRadiusBR: 3 });
    connector.columns.template.adapters.add("fillGradient", (fill, target) => {
      const row = target.dataItem?.dataContext;
      const treatment = treatments[row?.gradientKey || "highest"];
      return row?.expectedOnLeft ? treatment.forward : treatment.reverse;
    });
    connector.events.on("datavalidated", () => {
      connector.columns.each(column => {
        const row = column.dataItem?.dataContext; if (!row?.team) return;
        column.set("tooltipText", dumbbellTooltip(row));
        register(scene, row, column, selected => column.set("fillOpacity", selected ? 1 : .92));
      });
      scene.select();
    });
    const endpoints = [];
    for (const expected of [true, false]) {
      const series = chart.series.push(am5xy.LineSeries.new(root, { xAxis, yAxis, categoryYField: "team",
        valueXField: expected ? "expectedTotal" : "actualTotal", minBulletDistance: 0, maskBullets: false }));
      series.strokes.template.set("forceHidden", true);
      series.bullets.push((root, series, item) => {
        const row = item.dataContext, tint = treatments[row.gradientKey].tint;
        const onLeft = expected ? row.expectedOnLeft : !row.expectedOnLeft;
        const sprite = am5.Container.new(root, { width: 12, height: 12, centerX: am5.percent(50), centerY: am5.percent(50),
          tooltipText: `${expected ? "EXPECTED" : "ACTUAL"}\n${dumbbellTooltip(row)}` });
        const dot = sprite.children.push(am5.Circle.new(root, { x: am5.percent(50), y: am5.percent(50) }));
        const label = sprite.children.push(am5.Label.new(root, { text: fmt(expected ? row.expectedTotal : row.actualTotal, 1),
          x: am5.percent(50), y: am5.percent(50), centerX: onLeft ? am5.percent(100) : 0, centerY: am5.percent(50),
          dx: onLeft ? -10 : 10, fontSize: scene.text.labelSize,
          paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 }));
        // The smaller endpoint's label goes left, the larger endpoint's label goes right.
        // Equal scores share the same point, with expected labeled left and actual right.
        register(scene, row, sprite, selected => {
          dot.setAll({ radius: expected ? (selected ? 7.3 : 5.8) : (selected ? 5.3 : 4.2),
            fill: expected ? color(0x0b172c) : tint, stroke: expected ? color(0xd4e4ff) : tint,
            strokeWidth: expected ? (selected ? 2 : 1.5) : 1, fillOpacity: 1 });
          label.setAll({ fill: color(selected ? scene.text.selectedColor : scene.text.labelColor),
            fontWeight: selected ? scene.text.selectedWeight : scene.text.labelWeight });
        });
        return am5.Bullet.new(root, { sprite });
      });
      endpoints.push(series);
    }
    const deltas = chart.series.push(am5xy.LineSeries.new(root, { xAxis, yAxis, categoryYField: "team", valueXField: "labelX",
      minBulletDistance: 0, maskBullets: false }));
    deltas.strokes.template.set("forceHidden", true);
    deltas.bullets.push((root, series, item) => {
      const row = item.dataContext;
      const label = am5.Label.new(root, { text: `Δ ${signedPoints(row.deltaTotal)}`, centerY: am5.percent(50), dx: 13,
        fontSize: scene.text.labelSize, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
        tooltipText: `ACTUAL − EXPECTED\n${dumbbellTooltip(row)}` });
      register(scene, row, label, selected => label.setAll({ fill: color(selected ? scene.text.selectedColor : scene.text.labelColor),
        fontWeight: selected ? scene.text.selectedWeight : scene.text.labelWeight }));
      return am5.Bullet.new(root, { sprite: label });
    });
    scene.setData = view => {
      scene.markers.clear();
      scene.subtitle.textContent = `${view.pos} · TOTAL PPR POINTS · ACTUAL FPA: HIGHEST FIRST · ${venueText().toUpperCase()}`;
      const { min, max } = Model.dumbbellBounds(view.dumbbell);
      const rows = view.dumbbell.map(row => ({ ...row, labelX: max }));
      xAxis.setAll({ min, max }); yAxis.data.setAll(rows);
      connector.data.setAll(rows); endpoints.forEach(series => series.data.setAll(rows)); deltas.data.setAll(rows);
    };
    return scene;
  }

  function dumbbellTooltip(row) {
    return `[bold]${row.team} · ${row.pos}[/]\nActual FPA: ${fmt(row.actualTotal, 2)} points\nExpected from opponents: ${fmt(row.expectedTotal, 2)} points\nActual − expected: ${signedPoints(row.deltaTotal)} points\n${row.games} recorded games · select to explore`;
  }

  function gameMarker(scene, row, stroke, text) {
    const root = scene.root;
    const sprite = am5.Container.new(root, { width: 20, height: 20, centerX: am5.percent(50), centerY: am5.percent(50), tooltipText: text });
    const weekIndex = snapshot.weeks.indexOf(row.week);
    const circle = sprite.children.push(am5.Circle.new(root, { x: am5.percent(50), y: am5.percent(50), radius: 7.3,
      fill: color(0x10182b), stroke, strokeWidth: 1, strokeDasharray: weekIndex === 1 ? [2, 1] : weekIndex === 2 ? [1, 1] : undefined }));
    const logo = sprite.children.push(am5.Picture.new(root, { src: row.logoTeam ? `assets/NFL-Tags_webp/${row.logoTeam.toLowerCase()}.webp` : undefined,
      width: 11.5, height: 11.5, x: am5.percent(50), y: am5.percent(50), centerX: am5.percent(50), centerY: am5.percent(50) }));
    register(scene, row, sprite, selected => {
      circle.setAll({ radius: selected ? 8.6 : 7.3, strokeWidth: selected ? 1.5 : 1, stroke: selected ? color(current.positionColor) : stroke });
      logo.setAll({ width: selected ? 13 : 11.5, height: selected ? 13 : 11.5 });
    });
    return sprite;
  }
  function polarScatter(definition) {
    const scene = makeScene(definition), root = scene.root;
    legend(scene, [{ text: "W1 SOLID RING", fill: color(0xc1d5f4) }, { text: "W2 DASHED RING", fill: color(0xc1d5f4) },
      { text: "W3 DOTTED RING", fill: color(0xc1d5f4) }]);
    const chart = root.container.children.push(am5radar.RadarChart.new(root, { panX: false, panY: false, wheelX: "none", wheelY: "none",
      radius: am5.percent(98), innerRadius: am5.percent(22), startAngle: -90, endAngle: 270,
      paddingTop: 18, paddingBottom: 24, paddingLeft: 37, paddingRight: 37 }));
    const xr = am5radar.AxisRendererCircular.new(root, { minGridDistance: 1 });
    xr.labels.template.setAll({ location: .5, radius: 13, fontSize: scene.text.teamSize, fontWeight: scene.text.teamWeight, fill: color(scene.text.teamColor), textType: "adjusted" });
    // The label, spoke, and every week bullet use the exact category center.
    xr.grid.template.setAll({ location: .5, stroke: color(0x9ab6e0), strokeOpacity: .13 });
    xr.ticks.template.setAll({ visible: true, location: .5, length: 5, strokeOpacity: .4, stroke: color(0x9ab6e0) });
    const yr = am5radar.AxisRendererRadial.new(root, { minGridDistance: 43 });
    yr.labels.template.setAll({ fontSize: scene.text.axisSize, fontWeight: scene.text.axisWeight, fill: color(scene.text.axisColor), centerX: am5.percent(50), paddingRight: 3,
      background: am5.RoundedRectangle.new(root, { fill: color(0x0b172b), fillOpacity: .88, cornerRadiusTL: 3, cornerRadiusTR: 3 }) });
    yr.grid.template.setAll({ stroke: color(0x9ab6e0), strokeOpacity: .16, strokeDasharray: [2, 4] });
    const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: xr }));
    const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: yr, min: 0, strictMinMax: true, maxPrecision: 0 }));
    xr.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(scene.text.selectedColor) : fill);
    scene.labelRenderers.push(xr);
    current.divisions.forEach((division, index) => {
      const item = xAxis.makeDataItem({ category: division.teams[0], endCategory: division.teams.at(-1) }); xAxis.createAxisRange(item);
      item.get("label").set("forceHidden", true); item.get("grid").set("forceHidden", true);
      item.get("axisFill").setAll({ visible: true, fill: chart.get("colors").getIndex(index % 2), fillOpacity: index % 2 ? .045 : .015 });
    });
    const active = xAxis.makeDataItem({ category: current.team, endCategory: current.team }); xAxis.createAxisRange(active);
    active.get("label").set("forceHidden", true);
    active.get("grid").setAll({ location: .5, stroke: color(current.positionColor), strokeWidth: 1.5, strokeOpacity: .6 });
    active.get("axisFill").setAll({ visible: true, fill: color(current.positionColor), fillOpacity: .055 });
    const center = chart.radarContainer.children.push(am5.Label.new(root, { text: "", centerX: am5.percent(50), centerY: am5.percent(50),
      textAlign: "center", fontSize: scene.text.centerSize, fontWeight: scene.text.centerWeight, fill: color(scene.text.centerColor), lineHeight: am5.percent(135) }));
    const seriesByWeek = new Map();
    const makeWeek = week => {
      const series = chart.series.push(am5radar.RadarLineSeries.new(root, { name: `Week ${week}`, xAxis, yAxis,
        categoryXField: "team", valueYField: "actual", minBulletDistance: 0, maskBullets: false, connectEnds: false }));
      series.strokes.template.set("forceHidden", true);
      series.bullets.push((root, series, item) => {
        const row = item.dataContext, stat = current.analysis.byTeam.get(row.team).metrics[row.pos].actual;
        const games = snapshot.polar.filter(game => game.team === row.team);
        const text = `[bold]${row.team} DEFENSE · ${row.pos} · W${row.week}[/]\n${row.venue === "home" ? "vs" : "@"} ${row.offense || "Unknown offense"}\nActual: ${fmt(row.actual, 2)} PPR points\nOpponent baseline: ${fmt(row.expected, 2)} points\n\n[bold]All games on this spoke[/]\n` +
          games.map(game => `W${game.week} ${game.venue === "home" ? "vs" : "@"} ${game.offense || "—"}: ${fmt(game.actual, 2)}`).join("\n");
        return am5.Bullet.new(root, { locationX: row.location, sprite: gameMarker(scene, row, color(current.heatColor(stat)), text) });
      });
      seriesByWeek.set(week, series); return series;
    };
    scene.paint = () => {
      const games = snapshot.polar.filter(row => row.team === current.team);
      center.set("text", `[fontSize: ${scene.text.centerTeamSize}px]${current.team}[/]\n${current.pos} FPA\n[fontSize: ${scene.text.centerDetailSize}px]${games.length} games · same spoke[/]`);
      active.setAll({ category: current.team, endCategory: current.team });
      active.get("grid").set("stroke", color(current.positionColor)); active.get("axisFill").set("fill", color(current.positionColor));
    };
    scene.setData = view => {
      scene.markers.clear(); scene.subtitle.textContent = `${view.pos} · 32 DEFENSE SPOKES · ${view.polar.length} OPPONENT LOGOS · RADIUS = GAME FPA · ${venueText().toUpperCase()}`;
      const bounds = Model.extent(view.polar.map(row => row.actual), 10, true);
      yAxis.setAll({ min: bounds.min, max: Math.max(10, bounds.max) }); xAxis.data.setAll(view.teams.map(team => ({ team })));
      for (const [week, series] of seriesByWeek) if (!view.weeks.includes(week)) { series.dispose(); seriesByWeek.delete(week); }
      for (const week of view.weeks) (seriesByWeek.get(week) || makeWeek(week)).data.setAll(view.polar.filter(row => row.week === week));
    };
    return scene;
  }

  function readouts() {
    if (!snapshot || !current) return;
    const selectedCells = snapshot.cells.filter(row => row.team === current.team);
    $("compositionReadout").innerHTML = teamMarkup(current.team) + selectedCells.map(row => `<span class="labValue">${row.pos} <strong>${fmt(row.avg, 2)}</strong><span>/game · #${row.rank ?? "—"}</span></span>`).join("");
    const pair = snapshot.dumbbell.find(row => row.team === current.team);
    $("dumbbellReadout").innerHTML = teamMarkup(current.team) + (pair ? `<span>Actual <strong>${fmt(pair.actualTotal, 2)}</strong></span><span>Expected <strong>${fmt(pair.expectedTotal, 2)}</strong></span><span>Difference <strong>${signedPoints(pair.deltaTotal)}</strong> points</span><span>${pair.games} games · ${current.pos}</span>` : '<span class="labUnavailable">Complete opponent baselines are needed.</span>');
    const games = snapshot.polar.filter(row => row.team === current.team);
    $("polarReadout").innerHTML = teamMarkup(current.team) + games.map(row => `<span>W${row.week} <strong>${fmt(row.actual, 2)}</strong> <span>${row.venue === "home" ? "vs" : "@"} ${row.offense || "—"}</span></span>`).join("") + `<span>${snapshot.polar.length} total game dots</span>`;
  }
  function refresh(definition) {
    if (!snapshot || !observed.has(definition.id)) return;
    try {
      if (!window.am5 || !window.am5xy || !window.am5radar || !window.am5themes_Dark || !window.am5themes_Animated) throw new Error("The local amCharts library could not load.");
      let scene = scenes.get(definition.id);
      if (scene && scene.styleSignature !== JSON.stringify(textStyle($(definition.id)))) {
        scene.root.dispose(); scenes.delete(definition.id); scene = null;
      }
      scene ||= definition.create(definition);
      const signature = `${current.venue}:${definition.kind === "position" ? current.pos : "all"}`;
      if (scene.signature !== signature) { scene.setData(snapshot); scene.signature = signature; }
      scene.select();
    } catch (error) {
      scenes.get(definition.id)?.root.dispose(); scenes.delete(definition.id); $(definition.id).replaceChildren();
      const message = document.createElement("p"); message.className = "labLoading"; message.textContent = `${definition.title} could not load. ${error.message}`; $(definition.id).append(message);
    }
  }
  function update(context) {
    try {
      current = context; snapshot = Model.build(context.analysis, context.offenses, context.pos, context.divisions.flatMap(division => division.teams));
      readouts(); definitions.forEach(refresh); $("labError").hidden = true;
    } catch (error) { $("labError").textContent = `Additional chart views could not update: ${error.message}`; $("labError").hidden = false; }
  }
  function dispose() {
    clearTimeout(styleTimer); styleObserver?.disconnect(); observer?.disconnect();
    for (const scene of scenes.values()) scene.root.dispose(); scenes.clear();
  }
  function refreshStyles() { definitions.forEach(refresh); }
  function scheduleStyles() { clearTimeout(styleTimer); styleTimer = setTimeout(refreshStyles, 100); }
  function observe() {
    styleObserver = new MutationObserver(scheduleStyles);
    for (const element of [document.documentElement, document.body, ...document.querySelectorAll("[data-amchart-panel]")]) {
      styleObserver.observe(element, { attributes: true, attributeFilter: ["style", "class"] });
    }
    styleObserver.observe(document.head, { childList: true, characterData: true, subtree: true });
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) { observed.add(entry.target.id); observer.unobserve(entry.target);
          const definition = definitions.find(item => item.id === entry.target.id); if (definition) refresh(definition); }
      }, { rootMargin: "200px 0px" }); definitions.forEach(definition => observer.observe($(definition.id)));
    } else definitions.forEach(definition => observed.add(definition.id));
  }
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-lab-focus]");
    const scene = button && scenes.get(button.dataset.labFocus);
    if (scene) { scene.spotlight = !scene.spotlight; scene.select(); }
  });
  window.addEventListener("resize", scheduleStyles);
  window.FPAChartLab = { update, dispose, refreshStyles };
  window.addEventListener("pagehide", dispose);
  window.addEventListener("pageshow", event => { if (event.persisted) { observe(); if (current) update(current); } });
  observe(); if (window.FPAChartContext) update(window.FPAChartContext);
})();
