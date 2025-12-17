/* 2025 FPA Matchup Explorer
   - Drop the 3 CSVs next to this file (or upload them via the file input if fetch is blocked).
   - This page expects ranks where 1 = toughest, 32 = easiest (most fantasy points allowed).
*/

const CONFIG = {
  paths: {
    players: "data/WKLY-DEF_vs_POS_by_Player.csv",
    season: "data/Season_FPA_Summary.csv",
    recent: "data/WK9-15_FPA_Summary.csv",
  },
  maxWeek: 15,
  recentWeeks: [9, 15],
  positions: ["QB","RB","WR","TE"],
  teamCount: 32,
};

const els = {
  btnSeason: document.getElementById("btnSeason"),
  btnRecent: document.getElementById("btnRecent"),
  loadStatus: document.getElementById("loadStatus"),
  teamSelect: document.getElementById("teamSelect"),
  heatPosSelect: document.getElementById("heatPosSelect"),
  heatTeamSelect: document.getElementById("heatTeamSelect"),
  sortSelect: document.getElementById("sortSelect"),
  dirSelect: document.getElementById("dirSelect"),
  heatTable: document.getElementById("heatTable"),
  quickCards: document.getElementById("quickCards"),
  uploader: document.getElementById("uploader"),
  fileInput: document.getElementById("fileInput"),

  scatterTitle: document.getElementById("scatterTitle"),
  topSeason: document.getElementById("topSeason"),
  topSeasonTitle: document.getElementById("topSeasonTitle"),
  topRecent: document.getElementById("topRecent"),
  topRecentTitle: document.getElementById("topRecentTitle"),
  trendUp: document.getElementById("trendUp"),
  trendUpTitle: document.getElementById("trendUpTitle"),
  trendDown: document.getElementById("trendDown"),
  trendDownTitle: document.getElementById("trendDownTitle"),

  profilePill: document.getElementById("profilePill"),
  weeklySub: document.getElementById("weeklySub"),

  playersSub: document.getElementById("playersSub"),
  weekRange: document.getElementById("weekRange"),
  playerSearch: document.getElementById("playerSearch"),
  playerTable: document.getElementById("playerTable"),
};

let STATE = {
  activeDataset: "season", // "season" | "recent" (controls heatmap + quick cards primary)
  pos: "QB",
  selectedTeam: null, // defense team for profile
  scatterMode: "avg", // "avg" | "rank"
  sortKey: "Total_Rk",
  sortDir: "desc",
  playerSort: { key: "week", dir: "desc" },
};

let DATA = {
  season: null,   // array of rows
  recent: null,   // array of rows
  playersWide: null,
  playersLong: null, // derived
  playersWeeklyTotals: null, // Map key: team|pos => [{week,total}]
  byTeamSeason: null, // Map team => row
  byTeamRecent: null,
};

let charts = {
  scatter: null,
  radar: null,
  weekly: null,
};

function $(sel, root=document){ return root.querySelector(sel); }
function $$ (sel, root=document){ return [...root.querySelectorAll(sel)]; }
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

function fmt(x, d=2){
  if (x === null || x === undefined || x === "" || Number.isNaN(x)) return "—";
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function ordinal(x){
  const n = Math.round(toNum(x));
  if (!Number.isFinite(n)) return "—";
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  const suf = mod10 === 1 ? "st" : (mod10 === 2 ? "nd" : (mod10 === 3 ? "rd" : "th"));
  return `${n}${suf}`;
}

function toNum(x){
  if (x === null || x === undefined) return NaN;
  const s = String(x).trim().replace(/,/g,"");
  if (s === "—" || s === "–" || s === "-") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function cleanStr(x){
  if (x === null || x === undefined) return "";
  const s = String(x).trim();
  if (s === "—" || s === "–") return "";
  return s;
}

// rank 1 (tough) -> 0, rank 32 (easy) -> 1
function rankScore(rank){
  const r = toNum(rank);
  if (!Number.isFinite(r)) return 0.5;
  return clamp((r - 1) / (CONFIG.teamCount - 1), 0, 1);
}

function lerp(a, b, t){ return a + (b - a) * t; }
function lerpRGB(c1, c2, t){
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

// tough -> easy gradient (red -> mint)
function heatColor(score){
  const cTough = [255, 88, 92];
  const cEasy  = [72, 245, 177];
  return lerpRGB(cTough, cEasy, clamp(score,0,1));
}


function rgbaOf(color, alpha){
  // color: rgb(r,g,b) or rgba(r,g,b,a)
  const s = String(color).trim();
  const m = s.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\)/i);
  if (!m) return `rgba(255,255,255,${alpha})`;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
}

function setStatus(kind, text){
  const dot = els.loadStatus.querySelector(".dot");
  dot.classList.remove("is-warn");
  dot.style.background = kind === "ok" ? "rgba(72,245,177,0.85)" : (kind === "err" ? "rgba(255,88,92,0.95)" : "rgba(255,209,102,0.95)");
  dot.style.boxShadow = kind === "ok" ? "0 0 0 3px rgba(72,245,177,0.12)" : (kind === "err" ? "0 0 0 3px rgba(255,88,92,0.12)" : "0 0 0 3px rgba(255,209,102,0.12)");
  els.loadStatus.querySelector("span:last-child").textContent = text;
}

// =====================
// CSV loading
// =====================
function parseCSVText(text){
  return new Promise((resolve, reject) => {
    try{
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (res) => resolve(res.data),
        error: (err) => reject(err),
      });
    }catch(e){ reject(e); }
  });
}

function loadCSVViaFetch(path){
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    });
  });
}

async function tryAutoLoad(){
  setStatus("warn", "Loading CSVs…");
  try{
    const [playersWide, season, recent] = await Promise.all([
      loadCSVViaFetch(CONFIG.paths.players),
      loadCSVViaFetch(CONFIG.paths.season),
      loadCSVViaFetch(CONFIG.paths.recent),
    ]);
    DATA.playersWide = playersWide;
    DATA.season = season;
    DATA.recent = recent;
    setStatus("ok", "Data loaded");
    els.uploader.style.display = "none";
    return true;
  }catch(e){
    console.warn("Auto-load failed", e);
    setStatus("warn", "Auto-load blocked — upload CSVs below");
    els.uploader.style.display = "block";
    return false;
  }
}

async function handleFileUpload(files){
  const byName = new Map();
  for (const f of files){
    byName.set(f.name, f);
  }
  const needed = [CONFIG.paths.players, CONFIG.paths.season, CONFIG.paths.recent];
  const missing = needed.filter(n => !byName.has(n));
  if (missing.length){
    setStatus("err", `Missing: ${missing.join(", ")}`);
    return;
  }

  try{
    setStatus("warn", "Reading uploaded CSVs…");

    const readText = (file) => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsText(file);
    });

    const [playersText, seasonText, recentText] = await Promise.all([
      readText(byName.get(CONFIG.paths.players)),
      readText(byName.get(CONFIG.paths.season)),
      readText(byName.get(CONFIG.paths.recent)),
    ]);

    const [playersWide, season, recent] = await Promise.all([
      parseCSVText(playersText),
      parseCSVText(seasonText),
      parseCSVText(recentText),
    ]);

    DATA.playersWide = playersWide;
    DATA.season = season;
    DATA.recent = recent;

    setStatus("ok", "Data loaded");
    els.uploader.style.display = "none";
    bootstrap();
  }catch(e){
    console.error(e);
    setStatus("err", "Upload parse failed");
  }
}

// =====================
// Data transforms
// =====================
function buildMaps(){
  const toMap = (rows) => {
    const m = new Map();
    for (const r of rows){
      const tm = cleanStr(r.Team ?? r.TEAM ?? r.team).toUpperCase();
      if (!tm) continue;
      m.set(tm, r);
    }
    return m;
  };
  DATA.byTeamSeason = toMap(DATA.season);
  DATA.byTeamRecent = toMap(DATA.recent);
}

function buildPlayersLong(){
  const out = [];
  for (const row of DATA.playersWide){
    const def = cleanStr(row.TEAM).toUpperCase();
    const pos = cleanStr(row.POS).toUpperCase();
    if (!def || !pos) continue;

    for (let w=1; w<=CONFIG.maxWeek; w++){
      const nm = cleanStr(row[`${w}_NM`]);
      const plTm = cleanStr(row[`${w}_TM`]).toUpperCase();
      const pts = toNum(row[`${w}_P`]);
      if (!nm || !Number.isFinite(pts)) continue;
      out.push({ def, pos, week: w, player: nm, playerTeam: plTm, pts });
    }
  }
  DATA.playersLong = out;

  const totals = new Map(); // key def|pos -> week->sum
  for (const r of out){
    const key = `${r.def}|${r.pos}`;
    if (!totals.has(key)) totals.set(key, new Map());
    const wm = totals.get(key);
    wm.set(r.week, (wm.get(r.week) ?? 0) + r.pts);
  }

  const totalsArr = new Map(); // key -> [{week,total}]
  for (const [key, wm] of totals.entries()){
    const arr = [];
    for (let w=1; w<=CONFIG.maxWeek; w++){
      if (wm.has(w)) arr.push({ week:w, total: wm.get(w) });
    }
    totalsArr.set(key, arr);
  }
  DATA.playersWeeklyTotals = totalsArr;
}

function getRow(team, datasetName){
  const m = datasetName === "season" ? DATA.byTeamSeason : DATA.byTeamRecent;
  return m.get(team);
}

function getMetric(team, datasetName, metric){
  const row = getRow(team, datasetName);
  if (!row) return NaN;
  return toNum(row[metric]);
}

function calcTrend(team, pos){
  // positive = easier recently
  const rSeason = getMetric(team, "season", `${pos}_Rk`);
  const rRecent = getMetric(team, "recent", `${pos}_Rk`);
  const aSeason = getMetric(team, "season", `${pos}_Avg`);
  const aRecent = getMetric(team, "recent", `${pos}_Avg`);
  return {
    dRank: (Number.isFinite(rRecent) && Number.isFinite(rSeason)) ? (rRecent - rSeason) : NaN,
    dAvg:  (Number.isFinite(aRecent) && Number.isFinite(aSeason)) ? (aRecent - aSeason) : NaN,
    seasonRank: rSeason,
    recentRank: rRecent,
    seasonAvg: aSeason,
    recentAvg: aRecent,
  };
}

// =====================
// UI builders
// =====================
function buildTeamSelect(){
  els.teamSelect.innerHTML = "";
  els.heatTeamSelect.innerHTML = "";
  const teams = [...DATA.byTeamSeason.keys()].sort();
  for (const t of teams){
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    els.teamSelect.appendChild(opt);

    const opt2 = document.createElement("option");
    opt2.value = t;
    opt2.textContent = t;
    els.heatTeamSelect.appendChild(opt2);
  }
  STATE.selectedTeam = teams[0] ?? null;
  els.teamSelect.value = STATE.selectedTeam ?? "";
  els.heatTeamSelect.value = STATE.selectedTeam ?? "";
  els.heatPosSelect.value = STATE.pos;
}

function buildMiniLists(){
  const pos = STATE.pos;

  if (els.topSeasonTitle) els.topSeasonTitle.textContent = `Best matchups (through 2025) — ${pos}`;
  if (els.topRecentTitle) els.topRecentTitle.textContent = `Best matchups (last 7 games) — ${pos}`;
  if (els.trendUpTitle) els.trendUpTitle.textContent = `Trending up (Easier) — ${pos}`;
  if (els.trendDownTitle) els.trendDownTitle.textContent = `Trending down (Tougher) — ${pos}`;

  // Easiest lists
  const teams = [...DATA.byTeamSeason.keys()];
  const topN = 6;

  const topBy = (datasetName) => {
    const rows = teams.map(t => ({
      t,
      avg: getMetric(t, datasetName, `${pos}_Avg`),
      rk: getMetric(t, datasetName, `${pos}_Rk`),
    }))
    .filter(x => Number.isFinite(x.avg) && Number.isFinite(x.rk))
    .sort((a,b) => b.rk - a.rk)
    .slice(0, topN);
    return rows;
  };

  const trend = teams.map(t => ({
    t,
    ...calcTrend(t, pos),
  })).filter(x => Number.isFinite(x.dRank));

  const trendUp = [...trend].sort((a,b) => b.dRank - a.dRank).slice(0, topN);
  const trendDown = [...trend].sort((a,b) => a.dRank - b.dRank).slice(0, topN);

  const renderList = (root, rows, mode) => {
    root.innerHTML = "";
    for (const r of rows){
      const el = document.createElement("div");
      el.className = "rankRow";
      el.innerHTML = (() => {
        const isTrend = mode === "trend";
        const dot = isTrend
          ? (r.dRank > 0 ? "rgb(72, 245, 177)" : (r.dRank < 0 ? "rgb(255, 88, 92)" : "rgb(255, 209, 102)"))
          : heatColor(rankScore(r.rk));

        const meta = isTrend
          ? `ΔRk ${fmt(r.dRank,0)} • ΔAvg ${fmt(r.dAvg,2)}`
          : `Rk ${fmt(r.rk,0)} • Avg ${fmt(r.avg,2)}`;

        const badge = isTrend
          ? (() => {
              const arrow = r.dRank > 0 ? "▲" : (r.dRank < 0 ? "▼" : "•");
              return `<span class="trendBadge" style="border-color:${rgbaOf(dot,0.25)}; background:${rgbaOf(dot,0.12)}; color:${dot};">${arrow} ${Math.abs(fmt(r.dRank,0))}</span>`;
            })()
          : "View";

        return `
          <div class="lhs">
            <span class="rankDot" style="background:${dot}; box-shadow:0 0 0 3px ${rgbaOf(dot, 0.14)};"></span>
            <div class="tm">${r.t}</div>
            <div class="meta">${meta}</div>
          </div>
          <div class="rhs">${badge}</div>
        `;
      })();
	el.addEventListener("click", () => {
	        selectTeam(r.t, pos);
	      });
      root.appendChild(el);
    }
  };

  renderList(els.topSeason, topBy("season"), "top");
  renderList(els.topRecent, topBy("recent"), "top");
  renderList(els.trendUp, trendUp, "trend");
  renderList(els.trendDown, trendDown, "trend");
}

function buildQuickCards(){
  const team = STATE.selectedTeam;
  const pos = STATE.pos;

  const s = calcTrend(team, pos);

  const easyLabel = (rk) => {
    const sc = rankScore(rk);
    if (sc >= 0.78) return "Great matchup";
    if (sc >= 0.60) return "Good matchup";
    if (sc >= 0.40) return "Neutral";
    if (sc >= 0.22) return "Tough matchup";
    return "Avoid";
  };

  const chipFor = (rk) => {
    const sc = rankScore(rk);
    const c = heatColor(sc);
    return `<span class="chip" title="Higher rank = easier matchup">
      <span class="swatch" style="background:${c}; box-shadow:0 0 0 3px rgba(255,255,255,0.08)"></span>
      ${easyLabel(rk)}
    </span>`;
  };

  const card = (title, avg, rk, gm, extra) => {
    const accent = heatColor(rankScore(rk));
    const bg = `radial-gradient(260px 90px at 18% 10%, ${rgbaOf(accent,0.22)}, transparent 60%), rgba(255,255,255,0.045)`;
    return `
    <div class="card" style="background:${bg}; border-color:${rgbaOf(accent,0.22)}">
      <div class="card__top">
        <div class="card__title">${title}</div>
        ${chipFor(rk)}
      </div>
      <div class="card__big">${fmt(avg,2)} <span class="muted" style="font-size:12px;font-weight:700;">FPA</span></div>
      <div class="card__sub">Rank: <strong>${fmt(rk,0)}</strong> / 32 • Games: <strong>${fmt(gm,0)}</strong> ${extra ?? ""}</div>
    </div>
  `;
  };

  const gmS = getMetric(team,"season","GM_P");
  const gmR = getMetric(team,"recent","GM_P");

  const trendAccent = Number.isFinite(s.dRank)
    ? (s.dRank > 0 ? "rgb(72, 245, 177)" : (s.dRank < 0 ? "rgb(255, 88, 92)" : "rgb(255, 209, 102)"))
    : "rgb(0, 191, 255)";

  const deltaText = (Number.isFinite(s.dRank) && Number.isFinite(s.dAvg))
    ? `• Trend: <strong>${s.dRank > 0 ? "+" : ""}${fmt(s.dRank,0)}</strong> ranks, <strong>${s.dAvg > 0 ? "+" : ""}${fmt(s.dAvg,2)}</strong> avg`
    : "";

  els.quickCards.innerHTML = [
    card("Season", s.seasonAvg, s.seasonRank, gmS, ""),
    card("Weeks 9–15", s.recentAvg, s.recentRank, gmR, ""),
    `<div class="card" style="background:radial-gradient(260px 90px at 18% 10%, ${rgbaOf(trendAccent,0.20)}, transparent 60%), rgba(255,255,255,0.045); border-color:${rgbaOf(trendAccent,0.22)}">
      <div class="card__top">
        <div class="card__title">Season ↔ Recent Trend</div>
        <span class="chip">
          <span class="swatch" style="background:linear-gradient(135deg, rgba(0,191,255,1), rgba(207,120,255,1));"></span>
          ${deltaText ? "TREND" : "—"}
        </span>
      </div>
      <div class="card__big">${deltaText ? `${s.dRank > 0 ? "+" : ""}${fmt(s.dRank,0)} <span class="muted" style="font-size:12px;font-weight:700;">rank</span>` : "—"}</div>
      <div class="card__sub">${deltaText ? `Recent is ${s.dRank > 0 ? "<strong>easier</strong>" : (s.dRank < 0 ? "<strong>tougher</strong>" : "<strong>flat</strong>")} vs season ${deltaText}` : "Trend not available"}</div>
    </div>`
  ].join("");

}

function buildHeatTable(){
  const datasetName = STATE.activeDataset;
  const rows = datasetName === "season" ? DATA.season : DATA.recent;

  // sort
  const key = STATE.sortKey;
  const dir = STATE.sortDir;

  const sorted = [...rows].sort((a,b) => {
    const av = toNum(a[key]);
    const bv = toNum(b[key]);
    if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
    if (!Number.isFinite(av)) return 1;
    if (!Number.isFinite(bv)) return -1;

    if (key.endsWith("_Rk") || key === "Total_Rk") {
      return dir === "desc" ? (bv - av) : (av - bv);
    }
    // averages: higher avg = easier, so default "desc" aligns with easiest -> toughest
    return dir === "desc" ? (bv - av) : (av - bv);
  });

  els.heatTable.innerHTML = `
    <thead>
      <tr>
        <th style="min-width:74px;">DEF</th>
        <th>QB</th>
        <th>RB</th>
        <th>WR</th>
        <th>TE</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${sorted.map(r => {
        const t = cleanStr(r.Team).toUpperCase();
        const makeCell = (pos) => {
          const avg = toNum(r[`${pos}_Avg`]);
          const rk  = toNum(r[`${pos}_Rk`]);
          const sc = rankScore(rk);
          const c = heatColor(sc);
          const bg = `linear-gradient(135deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18)), radial-gradient(120px 60px at 20% 20%, ${rgbaOf(c,0.30)}, transparent 70%)`;

          const has = Number.isFinite(avg) && Number.isFinite(rk);
          const label = has
            ? `<span class="cell__rk">${ordinal(rk)}</span><span class="cell__avg">(${fmt(avg,1)})</span>`
            : `<span class="cell__rk">—</span>`;

          return `
            <td>
              <div class="cell" data-team="${t}" data-pos="${pos}" style="background:${bg}; border-color: ${rgbaOf(c,0.22)};">
                <div class="cell__text">${label}</div>
              </div>
            </td>
          `;
        };
        const totAvg = toNum(r["Total Avg"]);
        const totRk  = toNum(r["Total_Rk"]);
        const totSc = rankScore(totRk);
        const totC  = heatColor(totSc);
        const totBg = `linear-gradient(135deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18)), radial-gradient(120px 60px at 20% 20%, ${rgbaOf(totC,0.30)}, transparent 70%)`;

        const totHas = Number.isFinite(totAvg) && Number.isFinite(totRk);
        const totLabel = totHas
          ? `<span class="cell__rk">${ordinal(totRk)}</span><span class="cell__avg">(${fmt(totAvg,1)})</span>`
          : `<span class="cell__rk">—</span>`;

        return `
          <tr>
            <td class="tmCell">${t}</td>
            ${makeCell("QB")}
            ${makeCell("RB")}
            ${makeCell("WR")}
            ${makeCell("TE")}
            <td>
              <div class="cell" data-team="${t}" data-pos="TOTAL" style="background:${totBg}; border-color: ${rgbaOf(totC,0.22)};">
                <div class="cell__text">${totLabel}</div>
              </div>
            </td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;

  // bind clicks
  $$(".cell", els.heatTable).forEach(cell => {
    cell.addEventListener("click", () => {
      const team = cell.dataset.team;
      const pos = cell.dataset.pos === "TOTAL" ? STATE.pos : cell.dataset.pos;
      selectTeam(team, pos);
    });
  });
}

// =====================
// Charts
// =====================
function chartCommon(){
  Chart.defaults.color = "rgba(255,255,255,0.78)";
  Chart.defaults.borderColor = "rgba(255,255,255,0.10)";
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
}

function buildScatter(){
  if (!DATA.byTeamSeason || !DATA.byTeamRecent) return;

  const pos = STATE.pos;
  els.scatterTitle.textContent = pos;

  const teams = [...DATA.byTeamSeason.keys()].sort();
  const points = teams.map(t => {
    const x = STATE.scatterMode === "avg" ? getMetric(t, "season", `${pos}_Avg`) : getMetric(t, "season", `${pos}_Rk`);
    const y = STATE.scatterMode === "avg" ? getMetric(t, "recent", `${pos}_Avg`) : getMetric(t, "recent", `${pos}_Rk`);
    return { x, y, t };
  }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

  // diagonal bounds
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minV = Math.min(...xs, ...ys);
  const maxV = Math.max(...xs, ...ys);

  const diag = [
    {x:minV, y:minV},
    {x:maxV, y:maxV}
  ];

  const ctx = document.getElementById("scatterChart").getContext("2d");

  if (charts.scatter) charts.scatter.destroy();

  charts.scatter = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Defenses",
          data: points,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 0,
          pointBackgroundColor: (ctx) => {
            const team = ctx.raw?.t;
            const rk = getMetric(team, STATE.activeDataset, `${pos}_Rk`);
            return heatColor(rankScore(rk));
          },
        },
        {
          type: "line",
          label: "No-change line",
          data: diag,
          pointRadius: 0,
          borderDash: [6,6],
          borderWidth: 1,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // reduce ResizeObserver churn in some publishing environments
      resizeDelay: 120,
      parsing: false,
      scales: {
        x: {
          title: { display: true, text: `Season (${STATE.scatterMode === "avg" ? "Avg FPA" : "Rank"})` },
          grid: { color: "rgba(255,255,255,0.07)" },
        },
        y: {
          title: { display: true, text: `Weeks 9–15 (${STATE.scatterMode === "avg" ? "Avg FPA" : "Rank"})` },
          grid: { color: "rgba(255,255,255,0.07)" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const t = item.raw.t;
              const tr = calcTrend(t, pos);
              return `${t} • Season ${STATE.scatterMode === "avg" ? fmt(tr.seasonAvg,2) : fmt(tr.seasonRank,0)} • Recent ${STATE.scatterMode === "avg" ? fmt(tr.recentAvg,2) : fmt(tr.recentRank,0)} • ΔRk ${fmt(tr.dRank,0)}`;
            }
          }
        }
      },
      onClick: (_, elements) => {
        const el = elements?.[0];
        if (!el) return;
        const p = points[el.index];
        if (!p) return;
        selectTeam(p.t, pos);
      }
    }
  });
}

function buildRadar(){
  const team = STATE.selectedTeam;
  const pos = STATE.pos;

  const ctx = document.getElementById("radarChart").getContext("2d");
  if (charts.radar) charts.radar.destroy();

  const labels = ["QB","RB","WR","TE","Total"];
  const seasonVals = labels.map(l => l === "Total" ? getMetric(team,"season","Total_Rk") : getMetric(team,"season",`${l}_Rk`));
  const recentVals = labels.map(l => l === "Total" ? getMetric(team,"recent","Total_Rk") : getMetric(team,"recent",`${l}_Rk`));

  charts.radar = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: "Season",
          data: seasonVals,
          fill: true,
          backgroundColor: "rgba(207,120,255,0.12)",
          borderColor: "rgba(207,120,255,0.65)",
          pointBackgroundColor: "rgba(207,120,255,0.9)",
          borderWidth: 1.4,
        },
        {
          label: "Weeks 9–15",
          data: recentVals,
          fill: true,
          backgroundColor: "rgba(0,191,255,0.10)",
          borderColor: "rgba(0,191,255,0.65)",
          pointBackgroundColor: "rgba(0,191,255,0.9)",
          borderWidth: 1.4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      scales: {
        r: {
          min: 1,
          max: 32,
          ticks: { display: false },
          grid: { color: "rgba(255,255,255,0.08)" },
          angleLines: { color: "rgba(255,255,255,0.08)" },
          pointLabels: { color: "rgba(255,255,255,0.78)", font: { size: 11, weight: "700" } }
        }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "rgba(255,255,255,0.78)" }
        }
      }
    }
  });

  // weekly totals profile chart
  buildWeeklyTotalsProfile(team, pos);
}

function buildWeeklyTotalsProfile(team, pos){
  const ctx = document.getElementById("weeklyChart").getContext("2d");
  if (charts.weekly) charts.weekly.destroy();

  const key = `${team}|${pos}`;
  const arr = DATA.playersWeeklyTotals.get(key) ?? [];

  const labels = arr.map(d => `W${d.week}`);
  const vals = arr.map(d => d.total);

  els.weeklySub.textContent = `${team} vs ${pos} • total FPA by week (from player-level file)`;

  charts.weekly = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Weekly total", data: vals, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.06)" } },
        y: { grid: { color: "rgba(255,255,255,0.06)" }, title: { display:true, text: "FPA (total)" } }
      }
    }
  });
}

// =====================
// Players drilldown
// =====================
function getPlayerRows(team, pos){
  return DATA.playersLong.filter(r => r.def === team && r.pos === pos);
}

function filterWeeks(rows, mode){
  if (mode === "all") return rows;
  if (mode === "recent") return rows.filter(r => r.week >= 9 && r.week <= 15);
  if (mode === "1-8") return rows.filter(r => r.week >= 1 && r.week <= 8);
  if (mode === "9-12") return rows.filter(r => r.week >= 9 && r.week <= 12);
  if (mode === "13-15") return rows.filter(r => r.week >= 13 && r.week <= 15);
  return rows;
}

function sortPlayers(rows){
  const {key, dir} = STATE.playerSort;
  const mult = dir === "asc" ? 1 : -1;
  return [...rows].sort((a,b) => {
    const av = key === "player" ? a.player : (key === "team" ? a.playerTeam : (key === "week" ? a.week : a.pts));
    const bv = key === "player" ? b.player : (key === "team" ? b.playerTeam : (key === "week" ? b.week : b.pts));

    if (typeof av === "string"){
      const cmp = av.localeCompare(bv);
      if (cmp) return mult * cmp;
    }else{
      const cmp = av - bv;
      if (cmp) return mult * cmp;
    }

    // helpful tie-breakers for the default "week desc" view
    if (key === "week"){
      const pt = b.pts - a.pts;
      if (pt) return pt;
    }
    if (key === "pts"){
      const wk = b.week - a.week;
      if (wk) return wk;
    }
    return a.player.localeCompare(b.player);
  });
}

function buildPlayerTable(team, pos){
  const search = cleanStr(els.playerSearch.value).toLowerCase();
  const mode = els.weekRange.value;

  let rows = filterWeeks(getPlayerRows(team, pos), mode);

  if (search){
    rows = rows.filter(r =>
      r.player.toLowerCase().includes(search) ||
      (r.playerTeam || "").toLowerCase().includes(search)
    );
  }

  rows = sortPlayers(rows);

  const headers = [
    {k:"week", label:"Week"},
    {k:"player", label:"Player"},
    {k:"team", label:"TM"},
    {k:"pts", label:"PPR"},
  ];

  els.playerTable.innerHTML = `
    <thead>
      <tr>
        ${headers.map(h => `<th data-k="${h.k}">${h.label}${STATE.playerSort.key === h.k ? (STATE.playerSort.dir === "asc" ? " ▲" : " ▼") : ""}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>W${r.week}</td>
          <td>${r.player}</td>
          <td>${r.playerTeam || "—"}</td>
          <td style="font-weight:850;">${fmt(r.pts,2)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;

  // bind sort headers
  $$("thead th", els.playerTable).forEach(th => {
    th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (STATE.playerSort.key === k){
        STATE.playerSort.dir = STATE.playerSort.dir === "asc" ? "desc" : "asc";
      }else{
        STATE.playerSort.key = k;
        STATE.playerSort.dir = (k === "pts" || k === "week") ? "desc" : "asc";
      }
      buildPlayerTable(team, pos);
    });
  });
}

function buildPlayersSection(team, pos){
  if (!team || !pos){
    if (els.playersSub) els.playersSub.textContent = "Select a defense + position to populate.";
    if (els.playerTable) els.playerTable.innerHTML = "";
    return;
  }
  if (els.playersSub) els.playersSub.textContent = `${team} vs ${pos} • players by week`;
  buildPlayerTable(team, pos);
}

// =====================
// Selection + interactions
// =====================
function setDataset(name){
  STATE.activeDataset = name;

  // buttons
  const isSeason = name === "season";
  els.btnSeason.classList.toggle("is-active", isSeason);
  els.btnRecent.classList.toggle("is-active", !isSeason);
  els.btnSeason.setAttribute("aria-selected", String(isSeason));
  els.btnRecent.setAttribute("aria-selected", String(!isSeason));

  buildHeatTable();
  buildScatter();
  buildQuickCards();
}

function selectTeam(team, pos = STATE.pos){
  STATE.selectedTeam = team;
  STATE.pos = pos;

  // update select + pos buttons
  els.teamSelect.value = team;
  els.heatTeamSelect.value = team;
  els.heatPosSelect.value = STATE.pos;
  $$(".pos-btn").forEach(b => b.classList.toggle("is-active", b.dataset.pos === STATE.pos));

  // pill
  els.profilePill.querySelector("span:last-child").innerHTML = `Selected: <strong>${team}</strong> • Position: <strong>${STATE.pos}</strong>`;
  els.profilePill.querySelector(".dot").style.background = "rgba(0,191,255,0.85)";
  els.profilePill.querySelector(".dot").style.boxShadow = "0 0 0 3px rgba(0,191,255,0.12)";

  buildQuickCards();
  buildMiniLists();
  buildScatter();
  buildRadar();
  buildPlayersSection(team, STATE.pos);

  // highlight selected heat cells
  $$(".cell", els.heatTable).forEach(c => c.classList.toggle("is-selected", c.dataset.team === team && (c.dataset.pos === STATE.pos || c.dataset.pos === "TOTAL")));
}

// =====================
// Stars background
// =====================
function startStars(){
  const canvas = document.getElementById("stars");
  const ctx = canvas.getContext("2d");
  let w, h, stars;

  function resize(){
    w = canvas.width = window.innerWidth * devicePixelRatio;
    h = canvas.height = window.innerHeight * devicePixelRatio;
    const count = Math.floor((window.innerWidth * window.innerHeight) / 8500);
    stars = new Array(count).fill(0).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.9 + 0.1,
      r: Math.random() * 1.2 + 0.2,
      s: Math.random() * 0.6 + 0.2
    }));
  }

  let t = 0;
  function tick(){
    t += 0.006;
    ctx.clearRect(0,0,w,h);
    ctx.globalAlpha = 1;

    for (const st of stars){
      st.y += st.s * devicePixelRatio;
      st.x += Math.sin(t + st.y * 0.0006) * 0.22 * devicePixelRatio;

      if (st.y > h + 10) st.y = -10;
      if (st.x > w + 10) st.x = -10;
      if (st.x < -10) st.x = w + 10;

      const a = 0.22 + st.z * 0.55;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r * devicePixelRatio, 0, Math.PI*2);
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);
  resize();
  tick();
}

// =====================
// Bootstrap
// =====================
function bindEvents(){
  els.btnSeason.addEventListener("click", () => setDataset("season"));
  els.btnRecent.addEventListener("click", () => setDataset("recent"));

  $$(".pos-btn").forEach(b => b.addEventListener("click", () => selectTeam(STATE.selectedTeam, b.dataset.pos)));

  els.teamSelect.addEventListener("change", () => {
    selectTeam(els.teamSelect.value, STATE.pos);
  });

  els.heatPosSelect.addEventListener("change", () => {
    selectTeam(STATE.selectedTeam, els.heatPosSelect.value);
  });

  els.heatTeamSelect.addEventListener("change", () => {
    selectTeam(els.heatTeamSelect.value, STATE.pos);
  });

  els.sortSelect.addEventListener("change", () => {
    STATE.sortKey = els.sortSelect.value;
    buildHeatTable();
  });

  els.dirSelect.addEventListener("change", () => {
    STATE.sortDir = els.dirSelect.value;
    buildHeatTable();
  });

  $$(".smallToggle__btn").forEach(b => b.addEventListener("click", () => {
    $$(".smallToggle__btn").forEach(x => x.classList.toggle("is-active", x === b));
    STATE.scatterMode = b.dataset.scatmode;
    buildScatter();
  }));

  // players filters
  els.weekRange.addEventListener("change", () => buildPlayersSection(STATE.selectedTeam, STATE.pos));
  els.playerSearch.addEventListener("input", () => buildPlayersSection(STATE.selectedTeam, STATE.pos));

  // file upload
  els.fileInput.addEventListener("change", (e) => {
    const files = [...(e.target.files ?? [])];
    if (!files.length) return;
    handleFileUpload(files);
  });
}

function bootstrap(){
  chartCommon();
  buildMaps();
  buildPlayersLong();
  bindEvents();

  buildTeamSelect();
  buildHeatTable();
  buildMiniLists();
  buildScatter();
  buildQuickCards();
  selectTeam(STATE.selectedTeam, STATE.pos);
}

(async function init(){
  startStars();
  const ok = await tryAutoLoad();
  if (ok){
    bootstrap();
  }else{
    // wait for user upload
  }
})();
