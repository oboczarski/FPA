/* Additional amCharts views share the original page's data and selection. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id), Model = window.FPAChartLabData;
  const scenes = new Map(), observed = new Set();
  const definitions = [
    { id: "labSunburst", title: "Where the points came from", kind: "overview", create: scoringSunburst },
    { id: "labProfiles", title: "Five positions. One defensive profile.", kind: "overview", create: parallelProfiles },
    { id: "labToughness", title: "Toughness, measured against the opposition", kind: "position", create: toughnessBullets },
    { id: "labPolar", title: "Every game, on its defense’s spoke", kind: "position", create: polarScatter },
  ];
  let current = null, snapshot = null, observer = null;
  const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : "—";
  const signed = n => Number.isFinite(n) ? `${n > 0 ? "+" : ""}${fmt(Math.abs(n) < 1e-9 ? 0 : n)}%` : "—";
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
      theme.rule("Hierarchy").setAll({ animationDuration: 0 });
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

  function scoringSunburst(definition) {
    const scene = makeScene(definition), root = scene.root;
    const wrapper = root.container.children.push(am5.SerialChartContainer.new(root, {
      width: am5.percent(100), height: am5.percent(100), layout: root.verticalLayout }));
    wrapper.zoomableContainer.setAll({ wheelable: false, pinchZoom: false, minZoomLevel: 1, maxZoomLevel: 1, maxPanOut: 0 });
    const series = wrapper.series.push(am5hierarchy.Sunburst.new(root, { valueField: "value", categoryField: "name",
      childDataField: "children", fillField: "tint", topDepth: 1, downDepth: 2, initialDepth: 3, singleBranchOnly: false,
      radius: am5.percent(94), innerRadius: am5.percent(28), startAngle: -90, endAngle: 270 }));
    // Every team stays visible: slice clicks select the dashboard, never drill down.
    series.nodes.template.setAll({ toggleKey: "none", interactive: true });
    series.slices.template.setAll({ stroke: color(0x0b162b), strokeWidth: 1.3, fillOpacity: .7 });
    series.labels.template.setAll({ text: "{name}", textType: "circular", fontSize: 10, fill: color(0xd9e7ff),
      oversizedBehavior: "hide", paddingTop: 0, paddingBottom: 0 });
    series.labels.template.adapters.add("text", (text, target) => {
      const row = target.dataItem?.dataContext;
      return row?.pos === "ALL" ? row.team : row?.pos || "";
    });
    const center = series.nodesContainer.children.push(am5.Label.new(root, { text: "", isMeasured: false,
      centerX: am5.percent(50), centerY: am5.percent(50), textAlign: "center", fontFamily: '"MuseoModerno", sans-serif',
      fontSize: 13, fill: color(0xc7daf9), lineHeight: am5.percent(135) }));
    series.events.on("datavalidated", () => {
      scene.markers.clear();
      series.slices.each(slice => {
        const row = slice.dataItem?.dataContext; if (!row?.team) return;
        const node = slice.dataItem.get("node"); node.set("tooltipText", cellTooltip(row));
        register(scene, row, node, selected => slice.setAll({ fillOpacity: selected ? .98 : row.pos === "ALL" ? .42 : .63,
          stroke: selected ? color(0xd9eaff) : color(0x0b162b),
          strokeWidth: selected && (row.pos === current.pos || row.pos === "ALL") ? 2.4 : selected ? 1.5 : 1.3 }));
      });
      scene.select();
    });
    scene.paint = () => {
      const row = snapshot.cells.find(cell => cell.team === current.team && cell.pos === "ALL");
      center.set("text", `[fontSize: 30px]${current.team}[/]\n[fontSize: 21px]${fmt(row?.avg, 2)}[/]\nALL FPA / GAME`);
    };
    // The source palette is owned by amCharts; leaves share position colors across teams.
    const colors = series.get("colors");
    const palette = root.container.children.push(am5.Container.new(root, { width: am5.percent(100),
      layout: root.horizontalLayout, paddingLeft: 17, paddingTop: 3, paddingBottom: 25 }));
    Model.POSITIONS.slice(0, 4).forEach((pos, index) => palette.children.push(am5.Label.new(root, {
      text: `● ${pos}`, fill: colors.getIndex(index), fontSize: 11, paddingRight: 23, paddingTop: 0, paddingBottom: 0 })));
    palette.children.push(am5.Label.new(root, { text: "INNER RING = ALL", fill: color(0xa9bddc), fontSize: 10, paddingTop: 1, paddingBottom: 0 }));
    scene.setData = view => {
      scene.subtitle.set("text", `${view.teams.length} TEAM TOTALS · 128 POSITION BRANCHES · ANGLE = FPA/GAME · ${venueText().toUpperCase()}`);
      const data = { ...view.sunburst, children: view.sunburst.children.map((team, index) => ({ ...team,
        tint: colors.getIndex(index), children: team.children.map((row, p) => ({ ...row, tint: colors.getIndex(p) })) })) };
      series.data.setAll([data]); series.set("selectedDataItem", series.dataItems[0]);
    };
    return scene;
  }

  function parallelProfiles(definition) {
    const scene = makeScene(definition), root = scene.root;
    const chart = xy(scene, { paddingLeft: 12, paddingRight: 87, paddingTop: 30, paddingBottom: 20 }); focusButton(scene);
    const xr = am5xy.AxisRendererX.new(root, { minGridDistance: 1 }), yr = am5xy.AxisRendererY.new(root, { minGridDistance: 27, inversed: true });
    axisStyle(xr, 13); axisStyle(yr);
    xr.labels.template.setAll({ fontWeight: "600", paddingTop: 10 });
    xr.grid.template.setAll({ location: .5, strokeOpacity: .25, strokeWidth: 1 });
    yr.grid.template.set("forceHidden", true);
    const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "pos", renderer: xr }));
    const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { min: .5, max: 32.5, strictMinMax: true,
      maxPrecision: 0, renderer: yr }));
    const items = new Map(); let hovered = null;
    snapshot.teams.forEach((team, index) => {
      const tint = chart.get("colors").getIndex(index);
      const series = chart.series.push(am5xy.LineSeries.new(root, { name: team, xAxis, yAxis, categoryXField: "pos",
        valueYField: "rank", minBulletDistance: 0, maskBullets: false, stroke: tint, fill: tint, connect: false }));
      series.strokes.template.setAll({ strokeWidth: 1.5, strokeOpacity: .3, interactive: true, cursorOverStyle: "pointer" });
      series.strokes.template.events.on("pointerover", () => { hovered = team; scene.select(); });
      series.strokes.template.events.on("pointerout", () => { hovered = null; scene.select(); });
      series.strokes.template.events.on("click", () => current.select(team, current.pos));
      series.bullets.push((root, series, item) => {
        const row = item.dataContext;
        const sprite = am5.Container.new(root, { width: 8, height: 8, centerX: am5.percent(50), centerY: am5.percent(50), tooltipText: cellTooltip(row) });
        const halo = sprite.children.push(am5.Circle.new(root, { x: am5.percent(50), y: am5.percent(50), radius: 8,
          fill: tint, fillOpacity: .15, stroke: tint, strokeOpacity: .35, visible: false }));
        const dot = sprite.children.push(am5.Circle.new(root, { x: am5.percent(50), y: am5.percent(50), radius: 2.2,
          fill: tint, stroke: tint, strokeWidth: 1 }));
        const value = sprite.children.push(am5.Label.new(root, { text: `#${row.rank} · ${fmt(row.avg)}`, x: am5.percent(50),
          centerX: am5.percent(50), y: -31, fontSize: 10, fill: color(0xe0eeff), visible: false,
          paddingTop: 3, paddingBottom: 3, paddingLeft: 6, paddingRight: 6,
          background: am5.RoundedRectangle.new(root, { fill: color(0x0b172c), fillOpacity: .95, stroke: tint,
            strokeOpacity: .4, cornerRadiusTL: 4, cornerRadiusTR: 4, cornerRadiusBL: 4, cornerRadiusBR: 4 }) }));
        if (row.pos === "ALL") {
          sprite.children.push(am5.Picture.new(root, { src: `assets/NFL-Tags_webp/${row.team.toLowerCase()}.webp`,
            width: 11, height: 11, x: 15, y: am5.percent(50), centerY: am5.percent(50) }));
          sprite.children.push(am5.Label.new(root, { text: row.team, x: 29, y: am5.percent(50), centerY: am5.percent(50),
            fontSize: 9, paddingTop: 0, paddingBottom: 0, fill: tint }));
        }
        register(scene, row, sprite, selected => { dot.setAll({ radius: selected ? 4.2 : 2.2, fillOpacity: selected || hovered === row.team ? 1 : .55 });
          halo.set("visible", selected && row.pos === current.pos); value.set("visible", selected); });
        return am5.Bullet.new(root, { sprite });
      });
      items.set(team, series);
    });
    scene.paint = () => items.forEach((series, team) => {
      const selected = team === current.team, highlighted = selected || hovered === team;
      series.strokes.template.setAll({ strokeWidth: highlighted ? 3.2 : 1.4,
        strokeOpacity: highlighted ? 1 : scene.spotlight || hovered ? .07 : .29 });
      // Bring the selected path forward without sorting or displacing any rank.
      if (selected) chart.seriesContainer.children.moveValue(series);
    });
    scene.setData = view => {
      scene.markers.clear(); scene.subtitle.set("text", `32 CONTINUOUS TEAM PROFILES · TOP = TOUGHEST · BOTTOM = EASIEST · ${venueText().toUpperCase()}`);
      xAxis.data.setAll(view.positions.map(pos => ({ pos }))); yAxis.set("max", view.teams.length + .5);
      view.profiles.forEach(profile => {
        const series = items.get(profile.team);
        series.strokes.template.set("tooltipText", `[bold]${profile.team}[/]\n` + profile.values.map(row => `${row.pos}: #${row.rank ?? "—"} · ${fmt(row.avg, 2)} FPA/game`).join("\n"));
        series.data.setAll(profile.values);
      });
    };
    return scene;
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
    const logo = sprite.children.push(am5.Picture.new(root, { src: `assets/NFL-Tags_webp/${row.team.toLowerCase()}.webp`,
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
    document.querySelectorAll("[data-lab-position]").forEach(label => label.textContent = current.pos);
    const selectedCells = snapshot.cells.filter(row => row.team === current.team);
    $("compositionReadout").innerHTML = teamMarkup(current.team) + selectedCells.map(row => `<span class="labValue">${row.pos} <strong>${fmt(row.avg, 2)}</strong><span>/game · #${row.rank ?? "—"}</span></span>`).join("");
    $("profileReadout").innerHTML = teamMarkup(current.team) + selectedCells.map(row => `<span class="labValue">${row.pos} <strong>#${row.rank ?? "—"}</strong><span>${fmt(row.avg, 2)} /game</span></span>`).join("");
    if (!$("profileTeams").children.length) $("profileTeams").innerHTML = snapshot.teams.map(team => `<button type="button" class="labTeamChoice" data-lab-team="${team}">${teamMarkup(team)}</button>`).join("");
    $("profileTeams").querySelectorAll("[data-lab-team]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.labTeam === current.team)));
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
  $("chartLab").addEventListener("click", event => { const button = event.target.closest("[data-lab-team]"); if (button && current) current.select(button.dataset.labTeam, current.pos); });
  window.FPAChartLab = { update, dispose };
  window.addEventListener("pagehide", dispose);
  window.addEventListener("pageshow", event => { if (event.persisted) { observe(); if (current) update(current); } });
  observe(); if (window.FPAChartContext) update(window.FPAChartContext);
})();
