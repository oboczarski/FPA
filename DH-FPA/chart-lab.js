/* Additional amCharts views share the original page's data and selection. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id), Model = window.FPAChartLabData;
  const scenes = new Map(), observed = new Set();
  const definitions = [
    { id: "labBreakdown", title: "Scoring allowed, position by position", kind: "position", create: scoringBreakdown },
    { id: "labDumbbell", title: "Actual vs. expected, team by team", kind: "position", create: actualExpectedDumbbells },
    { id: "labToughness", title: "Toughness, measured against the opposition", kind: "position", create: toughnessBullets },
    { id: "labPolar", title: "Every game, on its defense’s spoke", kind: "position", create: polarScatter },
  ];
  let current = null, snapshot = null, observer = null;
  const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : "—";
  const signed = n => Number.isFinite(n) ? `${n > 0 ? "+" : ""}${fmt(Math.abs(n) < 1e-9 ? 0 : n)}%` : "—";
  const signedPoints = n => Number.isFinite(n) ? `${n > 0 ? "+" : ""}${fmt(Math.abs(n) < 1e-9 ? 0 : n, 1)}` : "—";
  const color = value => am5.color(value);
  const teamMarkup = team => `<span class="labTeam"><img src="assets/NFL-Tags_webp/${team.toLowerCase()}.webp" alt=""><strong>${team}</strong></span>`;
  const venueText = () => current.venue === "home" ? "Defense at home" : current.venue === "away" ? "Defense away" : "All games";
  function styleTooltip(tip) {
    tip.setAll({ getFillFromSprite: false, autoTextColor: false });
    tip.get("background").setAll({ fill: color(0x0a1427), fillOpacity: .98, stroke: color(0x9cbbee), strokeOpacity: .35, cornerRadius: 9 });
    tip.label.setAll({ fill: color(0xdae6ff), fontSize: 11, paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, lineHeight: am5.percent(135) });
  }
  function makeScene(definition) {
    const host = $(definition.id); host.replaceChildren();
    const root = am5.Root.new(host, { fontFamily: getComputedStyle(host).fontFamily, fontSize: 11, ariaLabel: definition.title });
    root.fps = 30;
    const theme = am5.Theme.new(root);
    theme.rule("Label").setAll({ fill: color(0xacbedc), fontSize: 11 });
    theme.rule("Grid").setAll({ stroke: color(0x9ab6e0), strokeOpacity: .1 });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      theme.rule("Component").setAll({ interpolationDuration: 0 });
    }
    root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root), theme]);
    root.numberFormatter.set("numberFormat", "#,###.##");
    root.container.set("layout", root.verticalLayout);
    root.container.children.push(am5.Label.new(root, { text: definition.title, fontFamily: '"MuseoModerno", sans-serif',
      fontSize: 19, fontWeight: "500", fill: color(0xe2ebff), paddingTop: 10, paddingBottom: 3, paddingLeft: 17,
      width: am5.percent(100), oversizedBehavior: "truncate" }));
    const subtitle = root.container.children.push(am5.Label.new(root, { text: "", fontSize: 9, fill: color(0x8ba2c6),
      paddingLeft: 17, paddingBottom: 7, width: am5.percent(100), oversizedBehavior: "truncate" }));
    const tip = am5.Tooltip.new(root, {}); styleTooltip(tip); root.container.set("tooltip", tip);
    const scene = { id: definition.id, root, subtitle, markers: new Set(), signature: null, spotlight: false,
      button: null, labelRenderers: [], paint: null, setData: null, select: () => selectMarkers(scene) };
    scenes.set(definition.id, scene); return scene;
  }
  function xy(scene, settings = {}) {
    return scene.root.container.children.push(am5xy.XYChart.new(scene.root, { panX: false, panY: false,
      wheelX: "none", wheelY: "none", paddingLeft: 12, paddingRight: 20, paddingTop: 13, paddingBottom: 12, ...settings }));
  }
  function axisStyle(renderer, size = 10) {
    renderer.labels.template.setAll({ fontSize: size, fill: color(0x97afd1), paddingTop: 3, paddingBottom: 3 });
    renderer.grid.template.setAll({ stroke: color(0x9ab6e0), strokeOpacity: .09 });
  }
  function legend(scene, entries) {
    const line = scene.root.container.children.push(am5.Container.new(scene.root, { width: am5.percent(100),
      layout: scene.root.horizontalLayout, paddingLeft: 17, paddingBottom: 6 }));
    entries.forEach(entry => line.children.push(am5.Label.new(scene.root, { text: entry.text, fill: entry.fill,
      fontSize: 10, fontWeight: "500", paddingRight: 18, paddingTop: 0, paddingBottom: 0 })));
  }
  function focusButton(scene) {
    const button = scene.root.container.children.push(am5.Button.new(scene.root, { isMeasured: false,
      x: am5.percent(100), centerX: am5.percent(100), dx: -15, y: 9, toggleKey: "active",
      ariaLabel: "Dim other teams and focus the selected defense",
      label: am5.Label.new(scene.root, { text: `Focus ${current.team}`, fontSize: 10, paddingTop: 4, paddingBottom: 4,
        paddingLeft: 8, paddingRight: 8, fill: color(0xbad3f5) }) }));
    button.get("background").setAll({ fill: color(0x8eb8f5), fillOpacity: .07, stroke: color(0xadcfff), strokeOpacity: .22,
      cornerRadiusTL: 6, cornerRadiusTR: 6, cornerRadiusBL: 6, cornerRadiusBR: 6 });
    button.get("background").states.create("active", { fillOpacity: .2, strokeOpacity: .55 });
    button.events.on("click", () => { scene.spotlight = button.get("active"); scene.select(); }); scene.button = button;
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
    if (scene.button) scene.button.get("label").set("text", `${scene.spotlight ? "Focused:" : "Focus"} ${current.team}`);
    scene.paint?.();
  }
  function cellTooltip(row) {
    return `[bold]${row.team} · ${row.pos}[/]\n${fmt(row.avg, 2)} FPA/game · rank ${row.rank ?? "—"} of ${row.pool}\nOpponent baseline: ${fmt(row.expectedAvg, 2)} /game\n${row.games} recorded games\nSelect to explore this defense and position`;
  }
  function pressureTooltip(row) {
    return `[bold]#${row.adjustedRank} ${row.team} · ${row.pos}[/]\nActual: ${fmt(row.actualAvg, 2)} FPA/game\nExpected from opponents: ${fmt(row.expectedAvg, 2)} /game\nSuppression: ${signed(row.suppression)}\nOpponent offense strength: ${signed(row.strength)} vs league\n${row.games} recorded games · select to explore`;
  }

  function scoringBreakdown(definition) {
    const scene = makeScene(definition), root = scene.root, palette = am5.ColorSet.new(root, {});
    const positions = Model.POSITIONS.slice(0, 4);
    const key = root.container.children.push(am5.Container.new(root, { width: am5.percent(100),
      layout: root.horizontalLayout, paddingLeft: 17, paddingBottom: 6 }));
    const keys = new Map(positions.map((pos, index) => [pos, key.children.push(am5.Label.new(root, {
      text: `● ${pos}`, fill: palette.getIndex(index), fontSize: 10, fontWeight: "500", paddingRight: 20,
      paddingTop: 0, paddingBottom: 0 }))]));
    const chart = xy(scene, { paddingLeft: 9, paddingRight: 57, paddingTop: 4 });
    const xr = am5xy.AxisRendererX.new(root, { minGridDistance: 65 }), yr = am5xy.AxisRendererY.new(root, { minGridDistance: 1, inversed: true });
    axisStyle(xr); axisStyle(yr, 11); yr.labels.template.setAll({ paddingTop: 0, paddingBottom: 0, paddingRight: 12 });
    yr.grid.template.set("forceHidden", true);
    const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { min: 0, strictMinMax: true, renderer: xr }));
    const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: yr }));
    yr.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(0xf1f6ff) : fill);
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
        fontSize: 10, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, tooltipText: cellTooltip(row) });
      register(scene, row, label, selected => label.setAll({ fill: selected ? color(0xf1f6ff) : color(0x9db4d7), fontWeight: selected ? "600" : "400" }));
      return am5.Bullet.new(root, { sprite: label });
    });
    scene.setData = view => {
      scene.markers.clear();
      scene.subtitle.set("text", `${view.pos} · FPA PER GAME · 32 DEFENSES · HIGHEST SCORING FIRST · ${venueText().toUpperCase()}`);
      const rows = [...view.breakdown].sort((a, b) => b.avg - a.avg || a.team.localeCompare(b.team));
      const active = view.pos === "ALL" ? positions : [view.pos];
      keys.forEach((label, pos) => label.set("visible", active.includes(pos)));
      const bounds = Model.extent(rows.map(row => row.avg), 10, true);
      xAxis.setAll({ min: bounds.min, max: Math.max(10, bounds.max) }); yAxis.data.setAll(rows);
      seriesByPos.forEach((series, pos) => series.data.setAll(active.includes(pos) ? rows : []));
      totals.data.setAll(rows);
    };
    return scene;
  }

  function actualExpectedDumbbells(definition) {
    const scene = makeScene(definition), root = scene.root, palette = am5.ColorSet.new(root, {});
    const below = palette.getIndex(0), above = palette.getIndex(8);
    legend(scene, [{ text: "○ EXPECTED", fill: color(0xd4e4ff) }, { text: "● ACTUAL", fill: color(0xd4e4ff) },
      { text: "← BELOW", fill: below }, { text: "ABOVE →", fill: above }]);
    const chart = xy(scene, { paddingLeft: 9, paddingRight: 80, paddingTop: 4 });
    const xr = am5xy.AxisRendererX.new(root, { minGridDistance: 65 }), yr = am5xy.AxisRendererY.new(root, { minGridDistance: 1, inversed: true });
    axisStyle(xr); axisStyle(yr, 11); yr.labels.template.setAll({ paddingTop: 0, paddingBottom: 0, paddingRight: 12 });
    yr.grid.template.setAll({ strokeOpacity: .04, location: .5 });
    const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { strictMinMax: true, renderer: xr }));
    const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: yr }));
    yr.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(0xf1f6ff) : fill);
    scene.labelRenderers.push(yr);
    // Geometry always runs low -> high; its gradient runs toward the actual endpoint.
    const gradients = [am5.LinearGradient.new(root, { rotation: 0, stops: [
      { color: below, opacity: 1 }, { color: below, opacity: .15 } ] }),
      am5.LinearGradient.new(root, { rotation: 0, stops: [
      { color: above, opacity: .15 }, { color: above, opacity: 1 } ] })];
    const connector = chart.series.push(am5xy.ColumnSeries.new(root, { xAxis, yAxis, baseAxis: yAxis,
      categoryYField: "team", openValueXField: "lowTotal", valueXField: "highTotal", clustered: false }));
    connector.columns.template.setAll({ height: 5, strokeOpacity: 0, cornerRadiusTL: 3, cornerRadiusTR: 3,
      cornerRadiusBL: 3, cornerRadiusBR: 3 });
    connector.columns.template.adapters.add("fillGradient", (fill, target) => gradients[target.dataItem?.dataContext?.deltaTotal > 0 ? 1 : 0]);
    connector.events.on("datavalidated", () => {
      connector.columns.each(column => {
        const row = column.dataItem?.dataContext; if (!row?.team) return;
        column.set("tooltipText", dumbbellTooltip(row));
        register(scene, row, column, selected => column.setAll({ height: selected ? 7 : 5, fillOpacity: selected ? 1 : .72 }));
      });
      scene.select();
    });
    for (const expected of [true, false]) {
      const series = chart.series.push(am5xy.LineSeries.new(root, { xAxis, yAxis, categoryYField: "team",
        valueXField: expected ? "expectedTotal" : "actualTotal", minBulletDistance: 0, maskBullets: false }));
      series.strokes.template.set("forceHidden", true);
      series.bullets.push((root, series, item) => {
        const row = item.dataContext, tint = row.deltaTotal > 0 ? above : below;
        const dot = am5.Circle.new(root, { tooltipText: `${expected ? "EXPECTED" : "ACTUAL"}\n${dumbbellTooltip(row)}` });
        // Equal totals remain concentric: the larger expected ring surrounds the actual dot.
        register(scene, row, dot, selected => dot.setAll({ radius: expected ? (selected ? 7.3 : 5.8) : (selected ? 5.3 : 4.2),
          fill: expected ? color(0x0b172c) : tint, stroke: expected ? color(0xd4e4ff) : tint,
          strokeWidth: expected ? (selected ? 2 : 1.5) : 1, fillOpacity: 1 }));
        return am5.Bullet.new(root, { sprite: dot });
      });
      if (expected) scene.expectedSeries = series; else scene.actualSeries = series;
    }
    const deltas = chart.series.push(am5xy.LineSeries.new(root, { xAxis, yAxis, categoryYField: "team", valueXField: "labelX",
      minBulletDistance: 0, maskBullets: false }));
    deltas.strokes.template.set("forceHidden", true);
    deltas.bullets.push((root, series, item) => {
      const row = item.dataContext;
      const label = am5.Label.new(root, { text: signedPoints(row.deltaTotal), centerY: am5.percent(50), dx: 13,
        fontSize: 10, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
        tooltipText: `ACTUAL − EXPECTED\n${dumbbellTooltip(row)}` });
      register(scene, row, label, selected => label.setAll({ fill: row.deltaTotal > 0 ? above : below, fontWeight: selected ? "600" : "400" }));
      return am5.Bullet.new(root, { sprite: label });
    });
    scene.setData = view => {
      scene.markers.clear();
      scene.subtitle.set("text", `${view.pos} · TOTAL PPR POINTS · MOST BELOW EXPECTATION FIRST · ${venueText().toUpperCase()}`);
      const bounds = Model.extent(view.dumbbell.flatMap(row => [row.actualTotal, row.expectedTotal]), 10);
      const rows = [...view.dumbbell].sort((a, b) => a.deltaTotal - b.deltaTotal || a.team.localeCompare(b.team)).map(row => ({ ...row, labelX: bounds.max }));
      xAxis.setAll({ min: bounds.min, max: bounds.max }); yAxis.data.setAll(rows);
      connector.data.setAll(rows); scene.expectedSeries.data.setAll(rows); scene.actualSeries.data.setAll(rows); deltas.data.setAll(rows);
    };
    return scene;
  }

  function dumbbellTooltip(row) {
    return `[bold]${row.team} · ${row.pos}[/]\nActual FPA: ${fmt(row.actualTotal, 2)} points\nExpected from opponents: ${fmt(row.expectedTotal, 2)} points\nActual − expected: ${signedPoints(row.deltaTotal)} points\n${row.games} recorded games · select to explore`;
  }

  function toughnessBullets(definition) {
    const scene = makeScene(definition), root = scene.root;
    const palette = am5.ColorSet.new(root, {});
    legend(scene, [{ text: "━ ACTUAL FPA", fill: palette.getIndex(0) }, { text: "│ OPPONENT EXPECTATION", fill: color(0xd4e4ff) },
      { text: "─ LEAGUE BASELINE", fill: color(0x809abb) }]);
    const chart = xy(scene, { paddingLeft: 9, paddingRight: 133, paddingTop: 6, paddingBottom: 12 });
    const xr = am5xy.AxisRendererX.new(root, { minGridDistance: 65 }), yr = am5xy.AxisRendererY.new(root, { minGridDistance: 1, inversed: true });
    axisStyle(xr); axisStyle(yr, 11); yr.labels.template.setAll({ paddingTop: 0, paddingBottom: 0, paddingRight: 12 });
    yr.grid.template.set("forceHidden", true);
    const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { min: 0, strictMinMax: true, renderer: xr }));
    const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: yr }));
    yr.labels.template.adapters.add("text", (text, target) => {
      const row = target.dataItem?.dataContext; return row?.team ? `#${row.adjustedRank}  ${row.team}` : text;
    });
    yr.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(0xf1f6ff) : fill);
    scene.labelRenderers.push(yr);
    const baseline = xAxis.makeDataItem({ value: 0 }); xAxis.createAxisRange(baseline);
    baseline.get("grid").setAll({ stroke: color(0xa8bdd9), strokeOpacity: .42, strokeDasharray: [3, 5] });
    baseline.get("label").set("forceHidden", true);
    const expected = chart.series.push(am5xy.ColumnSeries.new(root, { xAxis, yAxis, categoryYField: "team",
      valueXField: "expectedAvg", clustered: false, fill: color(0xc3d9fa), stroke: color(0xc3d9fa) }));
    expected.columns.template.setAll({ height: 17, fillOpacity: .09, strokeOpacity: .14, strokeWidth: 1,
      cornerRadiusTR: 4, cornerRadiusBR: 4, tooltipText: "Expected from opponents: {expectedAvg.formatNumber('#.00')} FPA/game" });
    const actual = chart.series.push(am5xy.ColumnSeries.new(root, { xAxis, yAxis, categoryYField: "team",
      valueXField: "actualAvg", clustered: false }));
    const gradients = [0, 3].map(index => {
      const tint = chart.get("colors").getIndex(index);
      return am5.LinearGradient.new(root, { rotation: 0, stops: [{ color: tint, opacity: .35 }, { color: tint, opacity: 1 }] });
    });
    // Templates determine the initial paint even when graphics are created after data validation.
    actual.columns.template.adapters.add("fill", (fill, column) => {
      const row = column.dataItem?.dataContext; return row ? chart.get("colors").getIndex(row.suppression >= 0 ? 0 : 3) : fill;
    });
    actual.columns.template.adapters.add("fillGradient", (gradient, column) => {
      const row = column.dataItem?.dataContext; return row ? gradients[row.suppression >= 0 ? 0 : 1] : gradient;
    });
    actual.columns.template.adapters.add("fillOpacity", (opacity, column) => column.dataItem?.dataContext?.team === current.team ? 1 : .73);
    actual.columns.template.setAll({ height: 8, strokeOpacity: 0, cornerRadiusTR: 3, cornerRadiusBR: 3,
      focusable: true, hoverOnFocus: true, focusableGroup: "toughness-bars", cursorOverStyle: "pointer" });
    actual.columns.template.adapters.add("tooltipText", (text, target) => target.dataItem ? pressureTooltip(target.dataItem.dataContext) : text);
    actual.columns.template.events.on("click", event => { const row = event.target.dataItem.dataContext; current.select(row.team, row.pos); });
    const target = chart.series.push(am5xy.LineSeries.new(root, { xAxis, yAxis, categoryYField: "team", valueXField: "expectedAvg",
      minBulletDistance: 0, maskBullets: false })); target.strokes.template.set("forceHidden", true);
    target.bullets.push((root, series, item) => {
      const row = item.dataContext;
      const tick = am5.Rectangle.new(root, { width: 2, height: 19, centerX: am5.percent(50), centerY: am5.percent(50),
        fill: color(0xd4e4ff), tooltipText: pressureTooltip(row) });
      register(scene, row, tick, selected => tick.setAll({ width: selected ? 3 : 2, fillOpacity: selected ? 1 : .8 }));
      return am5.Bullet.new(root, { sprite: tick, locationX: 1 });
    });
    const badges = chart.series.push(am5xy.LineSeries.new(root, { xAxis, yAxis, categoryYField: "team", valueXField: "labelX",
      maskBullets: false, minBulletDistance: 0 })); badges.strokes.template.set("forceHidden", true);
    badges.bullets.push((root, series, item) => {
      const row = item.dataContext, tint = chart.get("colors").getIndex(row.suppression >= 0 ? 0 : 3);
      const badge = am5.Container.new(root, { width: 119, height: 23, centerY: am5.percent(50), dx: 12, tooltipText: pressureTooltip(row) });
      const score = badge.children.push(am5.Label.new(root, { text: `${fmt(Math.abs(row.suppression))}% ${row.suppression >= 0 ? "BELOW" : "ABOVE"} EXP.`,
        fontSize: 9, fill: tint, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, fontWeight: "600" }));
      badge.children.push(am5.Label.new(root, { text: `OFFENSES ${signed(row.strength)}`, fontSize: 8,
        fill: color(0x8fa6c8), y: 12, paddingTop: 0, paddingBottom: 0, paddingLeft: 0 }));
      register(scene, row, badge, selected => score.set("fontWeight", selected ? "700" : "500"));
      return am5.Bullet.new(root, { sprite: badge });
    });
    scene.paint = () => actual.columns.each(column => {
      const row = column.dataItem?.dataContext; if (!row) return;
      const tint = chart.get("colors").getIndex(row.suppression >= 0 ? 0 : 3);
      column.setAll({ fill: tint, fillOpacity: row.team === current.team ? 1 : .73, height: row.team === current.team ? 11 : 8,
        fillGradient: gradients[row.suppression >= 0 ? 0 : 1] });
    });
    actual.events.on("datavalidated", () => scene.paint());
    scene.setData = view => {
      scene.markers.clear();
      const ordered = [...view.pressure].sort((a, b) => a.adjustedRank - b.adjustedRank || a.team.localeCompare(b.team));
      const bounds = Model.extent(ordered.flatMap(row => [row.actualAvg, row.expectedAvg]), 10, true);
      xAxis.setAll({ min: Math.min(0, bounds.min), max: Math.max(10, bounds.max) }); baseline.set("value", view.baseline);
      scene.subtitle.set("text", `${view.pos} · RANKED BY SUPPRESSION · FPA/GAME → · LEAGUE OFFENSE BASELINE ${fmt(view.baseline, 2)}`);
      const rows = ordered.map(row => ({ ...row, labelX: Math.max(10, bounds.max) }));
      yAxis.data.setAll(rows); expected.data.setAll(rows); actual.data.setAll(rows); target.data.setAll(rows); badges.data.setAll(rows);
    };
    return scene;
  }

  function gameMarker(scene, row, stroke, text) {
    const root = scene.root;
    const sprite = am5.Container.new(root, { width: 14, height: 14, centerX: am5.percent(50), centerY: am5.percent(50), tooltipText: text });
    const weekIndex = snapshot.weeks.indexOf(row.week);
    const circle = sprite.children.push(am5.Circle.new(root, { x: am5.percent(50), y: am5.percent(50), radius: 5.2,
      fill: color(0x10182b), stroke, strokeWidth: 1, strokeDasharray: weekIndex === 1 ? [2, 1] : weekIndex === 2 ? [1, 1] : undefined }));
    const logo = sprite.children.push(am5.Picture.new(root, { src: row.logoTeam ? `assets/NFL-Tags_webp/${row.logoTeam.toLowerCase()}.webp` : undefined,
      width: 8, height: 8, x: am5.percent(50), y: am5.percent(50), centerX: am5.percent(50), centerY: am5.percent(50) }));
    register(scene, row, sprite, selected => {
      circle.setAll({ radius: selected ? 6.5 : 5.2, strokeWidth: selected ? 1.5 : 1, stroke: selected ? color(current.positionColor) : stroke });
      logo.setAll({ width: selected ? 9 : 8, height: selected ? 9 : 8 });
    });
    return sprite;
  }
  function polarScatter(definition) {
    const scene = makeScene(definition), root = scene.root;
    legend(scene, [{ text: "W1 SOLID RING", fill: color(0xc1d5f4) }, { text: "W2 DASHED RING", fill: color(0xc1d5f4) },
      { text: "W3 DOTTED RING", fill: color(0xc1d5f4) }]);
    const chart = root.container.children.push(am5radar.RadarChart.new(root, { panX: false, panY: false, wheelX: "none", wheelY: "none",
      radius: am5.percent(98), innerRadius: am5.percent(22), startAngle: -90, endAngle: 270,
      paddingTop: 18, paddingBottom: 24, paddingLeft: 37, paddingRight: 37 })); focusButton(scene);
    const xr = am5radar.AxisRendererCircular.new(root, { minGridDistance: 1 });
    xr.labels.template.setAll({ location: .5, radius: 13, fontSize: 11, fill: color(0xb6c9e9), textType: "adjusted" });
    // The label, spoke, and every week bullet use the exact category center.
    xr.grid.template.setAll({ location: .5, stroke: color(0x9ab6e0), strokeOpacity: .13 });
    xr.ticks.template.setAll({ visible: true, location: .5, length: 5, strokeOpacity: .4, stroke: color(0x9ab6e0) });
    const yr = am5radar.AxisRendererRadial.new(root, { minGridDistance: 43 });
    yr.labels.template.setAll({ fontSize: 10, fill: color(0xa7bcdd), centerX: am5.percent(50), paddingRight: 3,
      background: am5.RoundedRectangle.new(root, { fill: color(0x0b172b), fillOpacity: .88, cornerRadiusTL: 3, cornerRadiusTR: 3 }) });
    yr.grid.template.setAll({ stroke: color(0x9ab6e0), strokeOpacity: .16, strokeDasharray: [2, 4] });
    const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: xr }));
    const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: yr, min: 0, strictMinMax: true, maxPrecision: 0 }));
    xr.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(0xf1f6ff) : fill);
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
      textAlign: "center", fontSize: 13, fill: color(0xc7daf9), lineHeight: am5.percent(135) }));
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
      center.set("text", `[fontSize: 27px]${current.team}[/]\n${current.pos} FPA\n[fontSize: 10px]${games.length} games · same spoke[/]`);
      active.setAll({ category: current.team, endCategory: current.team });
      active.get("grid").set("stroke", color(current.positionColor)); active.get("axisFill").set("fill", color(current.positionColor));
    };
    scene.setData = view => {
      scene.markers.clear(); scene.subtitle.set("text", `32 ALIGNED TEAM SPOKES · ${view.polar.length} INDIVIDUAL GAME DOTS · RADIUS = GAME FPA · ${venueText().toUpperCase()}`);
      const bounds = Model.extent(view.polar.map(row => row.actual), 10, true);
      yAxis.setAll({ min: bounds.min, max: Math.max(10, bounds.max) }); xAxis.data.setAll(view.teams.map(team => ({ team })));
      for (const [week, series] of seriesByWeek) if (!view.weeks.includes(week)) { series.dispose(); seriesByWeek.delete(week); }
      for (const week of view.weeks) (seriesByWeek.get(week) || makeWeek(week)).data.setAll(view.polar.filter(row => row.week === week));
    };
    return scene;
  }

  function readouts() {
    if (!snapshot || !current) return;
    $("labScope").textContent = `${current.team} · ${current.pos} · ${venueText()}`;
    const selectedCells = snapshot.cells.filter(row => row.team === current.team);
    $("compositionReadout").innerHTML = teamMarkup(current.team) + selectedCells.map(row => `<span class="labValue">${row.pos} <strong>${fmt(row.avg, 2)}</strong><span>/game · #${row.rank ?? "—"}</span></span>`).join("");
    const pair = snapshot.dumbbell.find(row => row.team === current.team);
    $("dumbbellReadout").innerHTML = teamMarkup(current.team) + (pair ? `<span>Actual <strong>${fmt(pair.actualTotal, 2)}</strong></span><span>Expected <strong>${fmt(pair.expectedTotal, 2)}</strong></span><span>Difference <strong>${signedPoints(pair.deltaTotal)}</strong> points</span><span>${pair.games} games · ${current.pos}</span>` : '<span class="labUnavailable">Complete opponent baselines are needed.</span>');
    const selected = snapshot.pressure.find(row => row.team === current.team);
    $("toughnessReadout").innerHTML = teamMarkup(current.team) + (selected ? `<span>Actual <strong>${fmt(selected.actualAvg, 2)}</strong> /game</span><span>Expected <strong>${fmt(selected.expectedAvg, 2)}</strong> /game</span><span>Suppression <strong>${signed(selected.suppression)}</strong></span><span>Offenses <strong>${signed(selected.strength)}</strong></span><span>Adjusted rank <strong>#${selected.adjustedRank}/${snapshot.pressure.length}</strong></span>` : '<span class="labUnavailable">Complete positive offense baselines are needed.</span>');
    const games = snapshot.polar.filter(row => row.team === current.team);
    $("polarReadout").innerHTML = teamMarkup(current.team) + games.map(row => `<span>W${row.week} <strong>${fmt(row.actual, 2)}</strong> <span>${row.venue === "home" ? "vs" : "@"} ${row.offense || "—"}</span></span>`).join("") + `<span>${snapshot.polar.length} total game dots</span>`;
  }
  function refresh(definition) {
    if (!snapshot || !observed.has(definition.id)) return;
    try {
      if (!window.am5 || !window.am5xy || !window.am5radar || !window.am5themes_Dark || !window.am5themes_Animated) throw new Error("The local amCharts library could not load.");
      const scene = scenes.get(definition.id) || definition.create(definition);
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
  function dispose() { for (const scene of scenes.values()) scene.root.dispose(); scenes.clear(); observer?.disconnect(); }
  function observe() {
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) { observed.add(entry.target.id); observer.unobserve(entry.target);
          const definition = definitions.find(item => item.id === entry.target.id); if (definition) refresh(definition); }
      }, { rootMargin: "200px 0px" }); definitions.forEach(definition => observer.observe($(definition.id)));
    } else definitions.forEach(definition => observed.add(definition.id));
  }
  window.FPAChartLab = { update, dispose };
  window.addEventListener("pagehide", dispose);
  window.addEventListener("pageshow", event => { if (event.persisted) { observe(); if (current) update(current); } });
  observe(); if (window.FPAChartContext) update(window.FPAChartContext);
})();
