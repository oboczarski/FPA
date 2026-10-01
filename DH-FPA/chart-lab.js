/* Additive amCharts 5 views. The original page owns scoring and selection. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id), Model = window.FPAChartLabData;
  const scenes = new Map(), observed = new Set();
  const definitions = [
    { id: "labBubble", title: "FPA bubble board", kind: "overview", create: bubbleBoard },
    { id: "labRace", title: "Position raceways", kind: "overview", create: raceways },
    { id: "labPressure", title: "Opponent-adjusted toughness", kind: "position", create: pressureMap },
    { id: "labPolar", title: "Matchup orbit", kind: "position", create: polarScatter },
  ];
  let current = null, snapshot = null, observer = null;
  const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : "—";
  const signed = n => Number.isFinite(n) ? `${n > 0 ? "+" : ""}${fmt(Math.abs(n) < 1e-9 ? 0 : n)}%` : "—";
  const teamMarkup = team => `<span class="labTeam"><img src="assets/NFL-Tags_webp/${team.toLowerCase()}.webp" alt=""><strong>${team}</strong></span>`;
  const venueText = () => current.venue === "home" ? "Defense at home" : current.venue === "away" ? "Defense away" : "All games";
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const color = value => am5.color(value);

  function styleTooltip(tip) {
    tip.setAll({ getFillFromSprite: false, autoTextColor: false });
    tip.get("background").setAll({ fill: color(0x0a1427), fillOpacity: .97,
      stroke: color(0x9cbbee), strokeOpacity: .3, cornerRadius: 9 });
    tip.label.setAll({ fill: color(0xdae6ff), fontSize: 10, paddingTop: 9,
      paddingBottom: 9, paddingLeft: 11, paddingRight: 11, lineHeight: am5.percent(135) });
  }
  function makeScene(definition) {
    const host = $(definition.id);
    host.replaceChildren();
    const root = am5.Root.new(host, { fontFamily: getComputedStyle(host).fontFamily, fontSize: 10,
      ariaLabel: definition.title });
    root.fps = 30;
    const theme = am5.Theme.new(root);
    theme.rule("Label").setAll({ fill: color(0xacbedc), fontSize: 10 });
    theme.rule("Grid").setAll({ stroke: color(0x9ab6e0), strokeOpacity: .1 });
    if (reduceMotion()) theme.rule("Component").setAll({ interpolationDuration: 0 });
    root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root), theme]);
    root.numberFormatter.set("numberFormat", "#,###.##");
    root.container.set("layout", root.verticalLayout);
    root.container.children.push(am5.Label.new(root, { text: definition.title,
      fontFamily: '"MuseoModerno", sans-serif', fontSize: host.clientWidth < 500 ? 15 : 17,
      fontWeight: "500", fill: color(0xe2ebff), paddingTop: 9, paddingBottom: 2,
      paddingLeft: 14, width: am5.percent(100), oversizedBehavior: "truncate" }));
    const subtitle = root.container.children.push(am5.Label.new(root, { text: "",
      fontSize: 8, fill: color(0x8297b8), paddingLeft: 14, paddingBottom: 6,
      width: am5.percent(100), oversizedBehavior: "truncate" }));
    const sharedTooltip = am5.Tooltip.new(root, { labelText: "{team}" });
    styleTooltip(sharedTooltip); root.container.set("tooltip", sharedTooltip);
    const scene = { id: definition.id, root, subtitle, markers: new Set(), signature: null,
      spotlight: false, button: null, labelRenderers: [], setData: null, select: () => selectMarkers(scene) };
    scenes.set(definition.id, scene);
    return scene;
  }
  function xy(scene, settings = {}) {
    return scene.root.container.children.push(am5xy.XYChart.new(scene.root, {
      panX: false, panY: false, wheelX: "none", wheelY: "none",
      paddingLeft: 10, paddingRight: 15, paddingTop: 8, paddingBottom: 8, ...settings,
    }));
  }
  function axisStyle(renderer, fontSize = 9) {
    renderer.labels.template.setAll({ fontSize, fill: color(0x91a5c6), paddingTop: 5, paddingBottom: 5 });
    renderer.grid.template.setAll({ stroke: color(0x9ab6e0), strokeOpacity: .09 });
  }
  function axisTitle(root, axis, text, vertical = false) {
    const settings = vertical ? { rotation: -90, y: am5.percent(50), centerX: am5.percent(50) } :
      { x: am5.percent(50), centerX: am5.percent(50), paddingTop: 5 };
    const label = am5.Label.new(root, { text, fontSize: 9, fill: color(0xa6bcdf), ...settings });
    if (vertical) axis.children.unshift(label); else axis.children.push(label);
  }
  function focusButton(scene) {
    const button = scene.root.container.children.push(am5.Button.new(scene.root, {
      isMeasured: false, x: am5.percent(100), centerX: am5.percent(100), dx: -13, y: 8,
      toggleKey: "active", ariaLabel: "Dim other teams and focus the selected defense",
      label: am5.Label.new(scene.root, { text: `Focus ${current.team}`, fontSize: 9,
        paddingTop: 4, paddingBottom: 4, paddingLeft: 7, paddingRight: 7, fill: color(0xbad3f5) }),
    }));
    button.get("background").setAll({ fill: color(0x8eb8f5), fillOpacity: .07,
      stroke: color(0xadcfff), strokeOpacity: .2, cornerRadiusTL: 6, cornerRadiusTR: 6,
      cornerRadiusBL: 6, cornerRadiusBR: 6 });
    button.get("background").states.create("active", { fillOpacity: .2, strokeOpacity: .55 });
    button.events.on("click", () => { scene.spotlight = button.get("active"); scene.select(); });
    scene.button = button;
  }
  function register(scene, row, sprite, paint) {
    sprite.setAll({ focusable: true, focusableGroup: `${scene.id}-${row.pos}`, hoverOnFocus: true,
      role: "button", cursorOverStyle: "pointer", ariaLabel: sprite.get("tooltipText")?.replace(/\[[^\]]*\]/g, "") });
    sprite.events.on("click", () => current.select(row.team, row.pos));
    sprite.states.create("hover", { scale: 1.09 });
    const marker = { row, sprite, paint }; scene.markers.add(marker);
    paint(row.team === current.team); sprite.set("opacity", scene.spotlight && row.team !== current.team ? .18 : 1);
    return sprite;
  }
  function selectMarkers(scene) {
    for (const renderer of scene.labelRenderers) renderer.labels.each(label => label.markDirtyKey("fill"));
    for (const marker of scene.markers) {
      if (marker.sprite.isDisposed()) { scene.markers.delete(marker); continue; }
      const selected = marker.row.team === current.team;
      marker.paint(selected); marker.sprite.set("opacity", scene.spotlight && !selected ? .18 : 1);
    }
    if (scene.button) scene.button.get("label").set("text", `${scene.spotlight ? "Focused:" : "Focus"} ${current.team}`);
  }
  function logoMarker(scene, row, stroke, text, { exact = false, label = false } = {}) {
    const root = scene.root;
    const sprite = am5.Container.new(root, { width: 28, height: 28, centerX: am5.percent(50), centerY: am5.percent(50), tooltipText: text });
    const halo = sprite.children.push(am5.Circle.new(root, { x: am5.percent(50), y: am5.percent(50), radius: 17,
      fill: stroke, fillOpacity: .07, stroke, strokeOpacity: .22, strokeWidth: 1, visible: false }));
    const circle = sprite.children.push(am5.Circle.new(root, { x: am5.percent(50), y: am5.percent(50), radius: 10,
      fill: color(0x10182b), stroke, strokeWidth: .9 }));
    const picture = sprite.children.push(am5.Picture.new(root, { src: `assets/NFL-Tags_webp/${row.team.toLowerCase()}.webp`,
      width: 16, height: 16, x: am5.percent(50), y: am5.percent(50), centerX: am5.percent(50), centerY: am5.percent(50) }));
    const name = label ? sprite.children.push(am5.Label.new(root, { text: row.team, x: am5.percent(50), centerX: am5.percent(50),
      y: 26, paddingTop: 0, paddingBottom: 0, fontSize: 8, fill: color(0xc6dafa), visible: false })) : null;
    return register(scene, row, sprite, selected => {
      circle.setAll({ radius: selected ? 12 : 10, strokeWidth: selected ? 2 : .9,
        stroke: exact && selected ? color(current.positionColor) : stroke });
      picture.setAll({ width: 16, height: 16 });
      halo.set("visible", selected && !exact); if (name) name.set("visible", selected);
    });
  }
  function cellTooltip(row) {
    return `[bold]${row.team} · ${row.pos}[/]\nActual: ${fmt(row.avg, 2)} FPA/game\nPosition rank: ${row.rank === null ? "unavailable" : `${row.rank} of ${row.pool}`}\nOpponent baseline: ${fmt(row.expectedAvg, 2)} /game\n${row.games} recorded game${row.games === 1 ? "" : "s"}\nSelect to explore this matchup`;
  }
  function positionAxes(scene, chart, ranked = false) {
    const root = scene.root;
    const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: ranked ? 35 : 12, opposite: !ranked });
    const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 15, inversed: true });
    axisStyle(xRenderer, ranked ? 9 : 8); axisStyle(yRenderer, 11);
    yRenderer.labels.template.setAll({ fontWeight: "600", paddingRight: 10 });
    yRenderer.grid.template.set("forceHidden", true);
    const xAxis = chart.xAxes.push(ranked ? am5xy.ValueAxis.new(root, { min: .3, max: 32.7, strictMinMax: true,
      maxPrecision: 0, renderer: xRenderer }) : am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: xRenderer }));
    const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "pos", renderer: yRenderer }));
    if (!ranked) {
      xRenderer.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(0xe4f0ff) : fill);
      xRenderer.grid.template.setAll({ strokeOpacity: .055, location: .5 });
      scene.labelRenderers.push(xRenderer);
    }
    yRenderer.labels.template.adapters.add("fill", (fill, target) => {
      const index = Model.POSITIONS.indexOf(target.dataItem?.dataContext?.pos);
      return index < 0 ? fill : chart.get("colors").getIndex(index);
    });
    const ranges = Model.POSITIONS.map((pos, index) => {
      const item = yAxis.makeDataItem({ category: pos, endCategory: pos });
      yAxis.createAxisRange(item); item.get("grid").set("forceHidden", true);
      item.get("label").set("forceHidden", true);
      item.get("axisFill").setAll({ visible: true, fill: chart.get("colors").getIndex(index), fillOpacity: .045 });
      return item;
    });
    return { xAxis, yAxis, ranges };
  }

  function bubbleBoard(definition) {
    const scene = makeScene(definition), root = scene.root, chart = xy(scene, { paddingBottom: 20 });
    const { xAxis, yAxis, ranges } = positionAxes(scene, chart);
    const series = Model.POSITIONS.map((pos, index) => {
      const tint = chart.get("colors").getIndex(index);
      // Category × category bubbles follow the official bubble heat-map demo.
      const series = chart.series.push(am5xy.ColumnSeries.new(root, { name: pos, xAxis, yAxis, clustered: false,
        categoryXField: "team", categoryYField: "pos", valueField: "avg", maskBullets: false, fill: tint, stroke: tint }));
      series.columns.template.set("forceHidden", true);
      series.bullets.push(function (root, series, dataItem) {
        const row = dataItem.dataContext;
        const sprite = am5.Container.new(root, { width: 28, height: 28, centerX: am5.percent(50), centerY: am5.percent(50), tooltipText: cellTooltip(row) });
        const halo = sprite.children.push(am5.Circle.new(root, { radius: row.radius + 4, x: am5.percent(50), y: am5.percent(50),
          fill: tint, fillOpacity: .08, stroke: tint, strokeOpacity: .36, visible: false }));
        const circle = sprite.children.push(am5.Circle.new(root, { radius: row.radius, x: am5.percent(50), y: am5.percent(50),
          fill: tint, fillOpacity: row.avg === null ? .03 : .72, stroke: tint, strokeOpacity: .9, strokeWidth: .7,
          fillGradient: am5.RadialGradient.new(root, { stops: [{ color: tint, opacity: .95, offset: 0 }, { color: tint, opacity: .33, offset: 1 }] }) }));
        const value = sprite.children.push(am5.Label.new(root, { text: fmt(row.avg), fontSize: 8, fontWeight: "400",
          fill: color(0x9eb4d5), x: am5.percent(50), centerX: am5.percent(50), y: 27, paddingTop: 0, paddingBottom: 0 }));
        register(scene, row, sprite, selected => {
          halo.set("visible", selected); circle.set("strokeWidth", selected ? 1.8 : .7);
          value.setAll({ fill: selected ? color(0xe2efff) : color(0x9eb4d5), fontWeight: selected ? "600" : "400" });
        });
        return am5.Bullet.new(root, { sprite });
      });
      return series;
    });
    scene.setData = view => {
      scene.markers.clear();
      scene.subtitle.set("text", `${view.teams.length} DEFENSES · ${view.cells.length} POSITION CELLS · ${venueText().toUpperCase()}`);
      xAxis.data.setAll(view.teams.map(team => ({ team })));
      yAxis.data.setAll(view.positions.map(pos => ({ pos })));
      ranges.forEach((range, index) => range.get("axisFill").set("fillOpacity", view.positions[index] === current.pos ? .08 : .035));
      series.forEach((item, index) => item.data.setAll(view.cells.filter(row => row.pos === view.positions[index])));
    };
    const select = scene.select;
    scene.select = () => {
      select(); ranges.forEach((range, index) => range.get("axisFill").set("fillOpacity", Model.POSITIONS[index] === current.pos ? .08 : .035));
    };
    return scene;
  }

  function raceways(definition) {
    const scene = makeScene(definition), root = scene.root, chart = xy(scene, { paddingTop: 17, paddingBottom: 9 });
    const { xAxis, yAxis } = positionAxes(scene, chart, true);
    axisTitle(root, xAxis, "FPA/game rank · 1 = fewest points allowed");
    const series = Model.POSITIONS.map((pos, index) => {
      const tint = chart.get("colors").getIndex(index);
      const series = chart.series.push(am5xy.LineSeries.new(root, { name: pos, xAxis, yAxis,
        valueXField: "rank", categoryYField: "pos", maskBullets: false, minBulletDistance: 0, fill: tint, stroke: tint }));
      series.strokes.template.set("forceHidden", true);
      series.bullets.push(function (root, series, dataItem) {
        const row = dataItem.dataContext;
        const sprite = logoMarker(scene, row, tint, cellTooltip(row), { label: true });
        sprite.set("dy", row.laneOffset);
        return am5.Bullet.new(root, { sprite });
      });
      return series;
    });
    scene.setData = view => {
      scene.markers.clear();
      scene.subtitle.set("text", `ALL ${view.teams.length} DEFENSES IN EACH LANE · ${venueText().toUpperCase()} · SELECT A LOGO`);
      yAxis.data.setAll(view.positions.map(pos => ({ pos })));
      xAxis.set("max", Math.max(2, view.teams.length + .7));
      series.forEach((item, index) => item.data.setAll(view.cells.filter(row => row.pos === view.positions[index] && row.rank !== null)
        .sort((a, b) => Number(a.team === current.team) - Number(b.team === current.team) || a.rank - b.rank)));
    };
    return scene;
  }

  function reference(axis) {
    const item = axis.makeDataItem({ value: 0 }); axis.createAxisRange(item);
    item.get("grid").setAll({ stroke: color(0xb6cce9), strokeOpacity: .5, strokeWidth: 1, strokeDasharray: [4, 5] });
    item.get("label").set("forceHidden", true);
  }
  function pressureMap(definition) {
    const scene = makeScene(definition), root = scene.root, chart = xy(scene, { paddingLeft: 2, paddingRight: 19, paddingTop: 13 });
    focusButton(scene);
    const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 55 });
    const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 40 });
    axisStyle(xRenderer); axisStyle(yRenderer);
    const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { renderer: xRenderer, strictMinMax: true, numberFormat: "#'%'", maxPrecision: 0 }));
    const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: yRenderer, strictMinMax: true, numberFormat: "#'%'", maxPrecision: 0 }));
    axisTitle(root, xAxis, "Opponent strength vs. league baseline →");
    axisTitle(root, yAxis, "Points suppressed vs. expected →", true);
    const regions = chart.plotContainer.children.unshift(am5.Container.new(root, { width: am5.percent(100), height: am5.percent(100), isMeasured: false }));
    const rectangles = [0, 1, 2, 3].map(index => regions.children.push(am5.Rectangle.new(root, {
      fill: chart.get("colors").getIndex(index), fillOpacity: .028, strokeOpacity: 0,
    })));
    const corners = [
      { text: "SOFTER OFFENSES\nBELOW BASELINE", right: false, bottom: false },
      { text: "STRONGER OFFENSES\nBELOW BASELINE", right: true, bottom: false },
      { text: "SOFTER OFFENSES\nABOVE BASELINE", right: false, bottom: true },
      { text: "STRONGER OFFENSES\nABOVE BASELINE", right: true, bottom: true },
    ];
    corners.forEach(corner => regions.children.push(am5.Label.new(root, { text: corner.text, fontSize: 7,
      fill: color(0x7188aa), opacity: .85, x: corner.right ? am5.percent(100) : 0,
      y: corner.bottom ? am5.percent(100) : 0, centerX: corner.right ? am5.percent(100) : 0,
      centerY: corner.bottom ? am5.percent(100) : 0, textAlign: corner.right ? "right" : "left",
      paddingTop: 7, paddingBottom: 7, paddingLeft: 7, paddingRight: 7 })));
    reference(xAxis); reference(yAxis);
    const series = chart.series.push(am5xy.LineSeries.new(root, { name: "Defense suppression", xAxis, yAxis,
      valueXField: "strength", valueYField: "suppression", minBulletDistance: 0, maskBullets: false }));
    series.strokes.template.set("forceHidden", true);
    series.bullets.push(function (root, series, dataItem) {
      const row = dataItem.dataContext;
      const text = `[bold]${row.team} · ${row.pos}[/]\nActual: ${fmt(row.actualAvg, 2)} FPA/game\nOpponent baseline: ${fmt(row.expectedAvg, 2)} /game\nOpponent strength: ${signed(row.strength)} vs league\nPoints suppressed: ${signed(row.suppression)}\nSuppression rank: ${row.adjustedRank} of ${snapshot.pressure.length}\n${row.games} recorded games · select to explore`;
      return am5.Bullet.new(root, { sprite: logoMarker(scene, row, chart.get("colors").getIndex(row.suppression >= 0 ? 0 : 3), text) });
    });
    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "none" }));
    cursor.lineX.setAll({ stroke: color(0xabc5ee), strokeOpacity: .22, strokeDasharray: [2, 4] });
    cursor.lineY.setAll({ stroke: color(0xabc5ee), strokeOpacity: .22, strokeDasharray: [2, 4] });
    scene.setData = view => {
      scene.markers.clear();
      scene.subtitle.set("text", `${view.pos} · HIGHER = MORE SUPPRESSION · RIGHT = STRONGER OFFENSES`);
      const x = Model.extent(view.pressure.map(row => row.strength), 10, true);
      const y = Model.extent(view.pressure.map(row => row.suppression), 10, true);
      x.min -= 5; x.max += 5; y.min -= 10; y.max += 10;
      xAxis.setAll({ min: x.min, max: x.max }); yAxis.setAll({ min: y.min, max: y.max });
      const splitX = -x.min / (x.max - x.min) * 100, splitY = y.max / (y.max - y.min) * 100;
      rectangles.forEach((rectangle, index) => {
        const right = index % 2 === 1, bottom = index > 1;
        rectangle.setAll({ x: am5.percent(right ? splitX : 0), y: am5.percent(bottom ? splitY : 0),
          width: am5.percent(right ? 100 - splitX : splitX), height: am5.percent(bottom ? 100 - splitY : splitY) });
      });
      series.data.setAll([...view.pressure].sort((a, b) => Number(a.team === current.team) - Number(b.team === current.team)));
      if (!view.pressure.length) scene.subtitle.set("text", "No complete comparisons with a positive offense baseline in this scope.");
    };
    return scene;
  }

  function polarScatter(definition) {
    const scene = makeScene(definition), root = scene.root;
    const chart = root.container.children.push(am5radar.RadarChart.new(root, { panX: false, panY: false,
      wheelX: "none", wheelY: "none", radius: am5.percent(83), innerRadius: am5.percent(29),
      paddingTop: 15, paddingBottom: 18, paddingLeft: 25, paddingRight: 25 }));
    focusButton(scene);
    const xRenderer = am5radar.AxisRendererCircular.new(root, { minGridDistance: 1 });
    xRenderer.labels.template.setAll({ radius: 12, fontSize: 9, fill: color(0xb6c9e9), textType: "adjusted" });
    xRenderer.grid.template.setAll({ stroke: color(0x9ab6e0), strokeOpacity: .055, location: 0 });
    const yRenderer = am5radar.AxisRendererRadial.new(root, { minGridDistance: 34 });
    yRenderer.labels.template.setAll({ fontSize: 8, fill: color(0x96acd0), centerX: am5.percent(50), paddingRight: 3,
      background: am5.RoundedRectangle.new(root, { fill: color(0x0b172b), fillOpacity: .72, cornerRadiusTL: 3, cornerRadiusTR: 3 }) });
    yRenderer.grid.template.setAll({ stroke: color(0x9ab6e0), strokeOpacity: .15, strokeDasharray: [2, 4] });
    const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, { categoryField: "team", renderer: xRenderer }));
    const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: yRenderer, min: 0, strictMinMax: true, maxPrecision: 0 }));
    xRenderer.labels.template.adapters.add("fill", (fill, target) => target.dataItem?.dataContext?.team === current.team ? color(0xf1f6ff) : fill);
    scene.labelRenderers.push(xRenderer);
    const divisionRanges = current.divisions.map((division, index) => {
      const item = xAxis.makeDataItem({ category: division.teams[0], endCategory: division.teams.at(-1) }); xAxis.createAxisRange(item);
      item.get("label").set("forceHidden", true); item.get("grid").set("forceHidden", true);
      item.get("axisFill").setAll({ visible: true, fill: chart.get("colors").getIndex(index % 2), fillOpacity: index % 2 ? .065 : .018 });
      return item;
    });
    const center = chart.radarContainer.children.push(am5.Label.new(root, { text: "", centerX: am5.percent(50),
      centerY: am5.percent(50), textAlign: "center", fontSize: 11, fill: color(0xc7daf9), lineHeight: am5.percent(125) }));
    const seriesByWeek = new Map();
    const makeWeek = week => {
      const series = chart.series.push(am5radar.RadarLineSeries.new(root, { name: `Week ${week}`, xAxis, yAxis,
        categoryXField: "team", valueYField: "actual", minBulletDistance: 0, maskBullets: false, connectEnds: false }));
      series.strokes.template.set("forceHidden", true);
      series.bullets.push(function (root, series, dataItem) {
        const row = dataItem.dataContext, stat = current.analysis.byTeam.get(row.team).metrics[row.pos].actual;
        const text = `[bold]${row.team} defense · ${row.pos} · Week ${row.week}[/]\n${row.venue === "home" ? "vs" : "@"} ${row.offense || "Unknown offense"}\nActual: ${fmt(row.actual, 2)} PPR points\nOpponent baseline: ${fmt(row.expected, 2)} points\n${row.venue === "home" ? "Defense at home" : "Defense away"}\nSelect to explore this defense`;
        return am5.Bullet.new(root, { locationX: row.location,
          sprite: logoMarker(scene, row, color(current.heatColor(stat)), text, { exact: true }) });
      });
      seriesByWeek.set(week, series); return series;
    };
    const select = scene.select;
    scene.select = () => {
      select();
      const games = snapshot.polar.filter(row => row.team === current.team).length;
      center.set("text", `[fontSize: 20px]${current.team}[/]\n${current.pos}\n[fontSize: 8px]${games} recorded games[/]`);
    };
    scene.setData = view => {
      scene.markers.clear();
      scene.subtitle.set("text", `${view.teams.length} TEAM SECTORS · ${view.polar.length} GAME DOTS · CLOCKWISE: ${view.weeks.map(week => `W${week}`).join(" → ")}`);
      const bounds = Model.extent(view.polar.map(row => row.actual), 10, true);
      yAxis.setAll({ min: bounds.min, max: Math.max(10, bounds.max) });
      xAxis.data.setAll(view.teams.map(team => ({ team })));
      divisionRanges.forEach(range => range.get("axisFill").set("visible", true));
      for (const [week, series] of seriesByWeek) if (!view.weeks.includes(week)) { series.dispose(); seriesByWeek.delete(week); }
      for (const week of view.weeks) {
        const series = seriesByWeek.get(week) || makeWeek(week);
        series.data.setAll(view.polar.filter(row => row.week === week));
      }
    };
    return scene;
  }

  function readouts() {
    if (!snapshot || !current) return;
    $("labScope").textContent = `${current.team} · ${current.pos} · ${venueText()}`;
    document.querySelectorAll("[data-lab-position]").forEach(label => label.textContent = current.pos);
    $("bubbleCoverage").textContent = `${snapshot.teams.length} defenses · ${snapshot.positions.length} positions`;
    const selectedCells = snapshot.cells.filter(row => row.team === current.team);
    $("bubbleReadout").innerHTML = teamMarkup(current.team) + selectedCells.map(row => `<span class="labValue">${row.pos} <strong>${fmt(row.avg)}</strong><span>${row.rank === null ? "" : `#${row.rank}`}</span></span>`).join("");
    $("raceReadout").innerHTML = teamMarkup(current.team) + selectedCells.map(row => `<span class="labValue">${row.pos} <strong>${row.rank === null ? "—" : `#${row.rank}`}</strong><span>${fmt(row.avg)} /game</span></span>`).join("");
    const selected = snapshot.pressure.find(row => row.team === current.team);
    $("pressureReadout").innerHTML = teamMarkup(current.team) + (selected ? `<span>Actual <strong>${fmt(selected.actualAvg, 2)}</strong> /game</span><span>Expected <strong>${fmt(selected.expectedAvg, 2)}</strong> /game</span><span>Suppression <strong>${signed(selected.suppression)}</strong></span><span>Offenses <strong>${signed(selected.strength)}</strong></span><span>Adj. rank <strong>#${selected.adjustedRank}/${snapshot.pressure.length}</strong></span>` : '<span class="labUnavailable">Complete positive offense baselines are needed for this comparison.</span>');
    const leaders = [...snapshot.pressure].sort((a, b) => a.adjustedRank - b.adjustedRank || a.team.localeCompare(b.team)).slice(0, 3);
    $("pressureLeaders").innerHTML = leaders.map(row => `<button type="button" class="labLeader" data-lab-team="${row.team}" aria-label="Explore ${row.team}, suppression rank ${row.adjustedRank}"><span><small>#${row.adjustedRank} SUPPRESSION</small>${teamMarkup(row.team)}</span><span class="labLeaderValue">${signed(row.suppression)}</span></button>`).join("");
    const games = snapshot.polar.filter(row => row.team === current.team);
    $("polarReadout").innerHTML = teamMarkup(current.team) + games.map(row => `<span>W${row.week} <strong>${fmt(row.actual, 2)}</strong> <span>${row.offense || "—"}</span></span>`).join("") + `<span>${snapshot.polar.length} total game dots</span>`;
  }
  function refresh(definition) {
    if (!snapshot || !observed.has(definition.id)) return;
    try {
      if (!window.am5 || !window.am5xy || !window.am5radar || !window.am5themes_Dark || !window.am5themes_Animated) throw new Error("The local amCharts library could not load.");
      const scene = scenes.get(definition.id) || definition.create(definition);
      const signature = `${current.venue}:${definition.kind === "position" ? current.pos : "all"}`;
      if (scene.signature !== signature) { scene.signature = signature; scene.setData(snapshot); }
      scene.select();
    } catch (error) {
      scenes.get(definition.id)?.root.dispose(); scenes.delete(definition.id);
      $(definition.id).replaceChildren();
      const message = document.createElement("p"); message.className = "labLoading";
      message.textContent = `${definition.title} could not load. ${error.message}`; $(definition.id).append(message);
    }
  }
  function update(context) {
    try {
      current = context;
      const order = context.divisions.flatMap(division => division.teams);
      snapshot = Model.build(context.analysis, context.offenses, context.pos, order);
      readouts(); definitions.forEach(refresh);
      $("labError").hidden = true;
    } catch (error) {
      $("labError").textContent = `Additional chart views could not update: ${error.message}`; $("labError").hidden = false;
    }
  }
  function dispose() {
    for (const scene of scenes.values()) scene.root.dispose();
    scenes.clear(); observer?.disconnect();
  }
  function observe() {
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          observed.add(entry.target.id); observer.unobserve(entry.target);
          const definition = definitions.find(item => item.id === entry.target.id); if (definition) refresh(definition);
        }
      }, { rootMargin: "200px 0px" });
      definitions.forEach(definition => observer.observe($(definition.id)));
    } else definitions.forEach(definition => observed.add(definition.id));
  }
  $("chartLab").addEventListener("click", event => {
    const button = event.target.closest("[data-lab-team]"); if (button && current) current.select(button.dataset.labTeam, current.pos);
  });
  window.FPAChartLab = { update, dispose };
  window.addEventListener("pagehide", dispose);
  window.addEventListener("pageshow", event => { if (event.persisted) { observe(); if (current) update(current); } });
  observe(); if (window.FPAChartContext) update(window.FPAChartContext);
})();
