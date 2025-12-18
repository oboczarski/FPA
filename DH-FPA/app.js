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

const PLAYER_SCATTER_COLORS = {
  QB: "#FF3A75ca",
  RB: "#00EBC7ca",
  WR: "#58A7FFca",
  TE: "#B469FFca",
};

const PLAYER_POINTS_THRESHOLDS = {
  QB: { solid: 16, high: 22 },
  RB: { solid: 12, high: 18 },
  WR: { solid: 12, high: 18 },
  TE: { solid: 11, high: 17 },
};

const PLAYER_POINTS_COLORS = {
  high: "#00ffbfea",
  solid: "#00c3ffe0",
  low: "#c26cfce8",
};

// Team colors (use provided/official hex values; do not auto-brighten).
const TEAM_COLORS = {
  'SF': '#B3995D', 'CHI': '#071d46', 'CIN': '#FB4F14', 'BUF': '#C60C30',
  'DEN': '#FB4F14', 'CLE': '#311D00', 'TB': '#DC4405', 'ARI': '#97233F',
  'LAC': '#0080C6', 'SD': '#0080C6', 'KC': '#E31837', 'IND': '#002C5F',
  'WAS': '#5A1414', 'DAL': '#869397', 'MIA': '#008E97', 'PHI': '#2B8C4E',
  'ATL': '#A71930', 'NYG': '#0D2266', 'JAX': '#006778', 'NYJ': '#125740',
  'DET': '#0076B6', 'GB': '#203731', 'CAR': '#0085CA', 'NE': '#002244',
  'LV': '#A5ACAF', 'OAK': '#A5ACAF', 'LAR': '#003594', 'STL': '#003594',
  'BAL': '#241773', 'NO': '#D3BC8D', 'SEA': '#69BE28', 'PIT': '#FFB612',
  'HOU': '#00143f', 'TEN': '#4B92DB', 'MIN': '#4F2683'
};

const TEAM_LOGO_ALIASES = {
  SD: "LAC",
  OAK: "LV",
  STL: "LAR",
  JAC: "JAX",
};

const SCATTER_TEAM_LOGO_PX = 20; // Chart.js draws image pointStyles at intrinsic width/height
const TEAM_LOGOS = new Map(); // TEAM -> HTMLImageElement (sized for scatter points)

function canonicalTeamCode(team){
  const t = cleanStr(team).toUpperCase();
  return TEAM_LOGO_ALIASES[t] ?? t;
}

function teamLogoSrc(team){
  const code = canonicalTeamCode(team);
  return `assets/NFL-Tags_webp/${code.toLowerCase()}.webp`;
}

function getTeamLogo(team){
  const code = canonicalTeamCode(team);
  return TEAM_LOGOS.get(code) ?? null;
}

async function loadTeamLogos(codes){
  const unique = [...new Set((codes ?? []).map(canonicalTeamCode).filter(Boolean))];
  const loaders = unique.map((code) => new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = teamLogoSrc(code);
    img.onload = () => {
      // IMPORTANT: Chart.js uses image.width/height for pointStyle drawing (not pointRadius).
      img.width = SCATTER_TEAM_LOGO_PX;
      img.height = SCATTER_TEAM_LOGO_PX;
      resolve([code, img]);
    };
    img.onerror = () => resolve([code, null]);
  }));
  const entries = await Promise.all(loaders);
  for (const [code, img] of entries){
    if (img) TEAM_LOGOS.set(code, img);
  }
}
const els = {
  btnSeason: document.getElementById("btnSeason"),
  btnRecent: document.getElementById("btnRecent"),
  loadStatus: document.getElementById("loadStatus"),
  teamPicker: document.getElementById("teamPicker"),
  teamPickerBtn: document.getElementById("teamPickerBtn"),
  teamPickerPanel: document.getElementById("teamPickerPanel"),
  teamPickerLogo: document.getElementById("teamPickerLogo"),
  teamPickerCode: document.getElementById("teamPickerCode"),
  selTeamLogo: document.getElementById("selTeamLogo"),
  selTeamText: document.getElementById("selTeamText"),
  selPosText: document.getElementById("selPosText"),
  heatPosToggle: document.getElementById("heatPosToggle"),
  heatTeamSelect: document.getElementById("heatTeamSelect"),
  sortSelect: document.getElementById("sortSelect"),
  dirSelect: document.getElementById("dirSelect"),
  heatTable: document.getElementById("heatTable"),
  quickCards: document.getElementById("quickCards"),
  uploader: document.getElementById("uploader"),
  fileInput: document.getElementById("fileInput"),

  scatterTitle: document.getElementById("scatterTitle"),
  playerScatterPosToggle: document.getElementById("playerScatterPosToggle"),
  playerWeekAvgPills: document.getElementById("playerWeekAvgPills"),
  playerWeekTitlePos: document.getElementById("playerWeekTitlePos"),
  playerWeekTitleTeam: document.getElementById("playerWeekTitleTeam"),
  topSeason: document.getElementById("topSeason"),
  topSeasonTitle: document.getElementById("topSeasonTitle"),
  topRecent: document.getElementById("topRecent"),
  topRecentTitle: document.getElementById("topRecentTitle"),
  trendUp: document.getElementById("trendUp"),
  trendUpTitle: document.getElementById("trendUpTitle"),
  trendDown: document.getElementById("trendDown"),
  trendDownTitle: document.getElementById("trendDownTitle"),

  profilePill: document.getElementById("profilePill"),

  playersSub: document.getElementById("playersSub"),
  weekRange: document.getElementById("weekRange"),
  playerSearch: document.getElementById("playerSearch"),
  playerTable: document.getElementById("playerTable"),
};

let STATE = {
  activeDataset: "season", // "season" | "recent" (controls heatmap + quick cards primary)
  pos: "QB",
  selectedTeam: null, // defense team for profile
  heatPos: "QB",
  heatTeam: null,
  scatterMode: "avg", // "avg" | "rank"
  sortKey: "Total_Rk",
  sortDir: "desc",
  playerSort: { key: "week", dir: "desc" },
  playerWeekScatterPos: "QB", // "ALL" | "QB" | "RB" | "WR" | "TE"
};

let DATA = {
  season: null,   // array of rows
  recent: null,   // array of rows
  playersWide: null,
  playersLong: null, // derived
  playersWeeklyTotals: null, // Map key: team|pos => [{week,total}]
  leaguePosAvg: null, // { season: {QB:number,...}, recent: {QB:number,...} }
  byTeamSeason: null, // Map team => row
  byTeamRecent: null,
};

let charts = {
  scatter: null,
  playerWeekScatter: null,
};

function $(sel, root=document){ return root.querySelector(sel); }
function $$ (sel, root=document){ return [...root.querySelectorAll(sel)]; }
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function cssEsc(s){
  try{
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(String(s));
  }catch{}
  return String(s);
}

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

function hexToRgbaArr(hex){
  const s = String(hex ?? "").trim().replace(/^#/, "");
  if (s.length === 6 || s.length === 8){
    const r = Number.parseInt(s.slice(0,2), 16);
    const g = Number.parseInt(s.slice(2,4), 16);
    const b = Number.parseInt(s.slice(4,6), 16);
    const a = s.length === 8 ? (Number.parseInt(s.slice(6,8), 16) / 255) : 1;
    if ([r,g,b,a].every(Number.isFinite)) return [r,g,b,a];
  }
  return [255,255,255,1];
}

const PLAYER_SCATTER_RGBA = Object.fromEntries(
  Object.entries(PLAYER_SCATTER_COLORS).map(([k,v]) => [k, hexToRgbaArr(v)])
);

// tough -> easy gradient (purple -> aqua)
function heatColor(score){
  const cTough = [194, 108, 252];
  const cEasy  = [0, 255, 193];
  return lerpRGB(cTough, cEasy, clamp(score,0,1));
}

function pointGradientColor(baseRgba, value, minV, maxV){
  const [r0,g0,b0,a0] = baseRgba ?? [255,255,255,1];
  const denom = (Number.isFinite(maxV) && Number.isFinite(minV)) ? (maxV - minV) : 0;
  const t0 = (Number.isFinite(value) && denom > 0) ? clamp((value - minV) / denom, 0, 1) : 0.5;
  const t = t0;

  const dark = 0.32;
  const light = 0.18;

  const rD = r0 * dark;
  const gD = g0 * dark;
  const bD = b0 * dark;

  const rL = lerp(r0, 255, light);
  const gL = lerp(g0, 255, light);
  const bL = lerp(b0, 255, light);

  const r = Math.round(lerp(rD, rL, t));
  const g = Math.round(lerp(gD, gL, t));
  const b = Math.round(lerp(bD, bL, t));

  const aHi = Math.min(0.95, a0 + 0.12);
  const a = lerp(0.18, aHi, t);

  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

function teamColorText(tm){
  const key = cleanStr(tm).toUpperCase();
  const hex = TEAM_COLORS[key];
  if (!hex) return null;
  return hex;
}

function syncHeatPosToggle(pos){
  if (!els.heatPosToggle) return;
  const p = cleanStr(pos).toUpperCase();
  $$("button.heatPosBtn", els.heatPosToggle).forEach(b => {
    const on = b.dataset.pos === p;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function syncPlayerScatterPosToggle(pos){
  if (!els.playerScatterPosToggle) return;
  const next = CONFIG.positions.includes(pos) ? pos : "ALL";
  $$("button.pos2-btn", els.playerScatterPosToggle).forEach(b => {
    b.classList.toggle("is-active", b.dataset.pos === next);
  });
}

function setPlayerWeekScatterPos(pos, { rebuild = true } = {}){
  const next = CONFIG.positions.includes(pos) ? pos : "ALL";
  STATE.playerWeekScatterPos = next;
  syncPlayerScatterPosToggle(next);
  if (rebuild) buildPlayerWeekScatter();
}

function isTeamPickerOpen(){
  return !!els.teamPicker?.classList?.contains("is-open");
}

function setTeamPickerOpen(open){
  if (!els.teamPicker) return;
  els.teamPicker.classList.toggle("is-open", !!open);
  if (els.teamPickerBtn) els.teamPickerBtn.setAttribute("aria-expanded", String(!!open));
}

function syncTeamPicker(team){
  const t = cleanStr(team).toUpperCase();

  if (els.teamPickerCode) els.teamPickerCode.textContent = t || "—";
  if (els.teamPickerLogo){
    if (t){
      els.teamPickerLogo.src = teamLogoSrc(t);
      els.teamPickerLogo.alt = t;
      els.teamPickerLogo.style.opacity = "1";
    }else{
      els.teamPickerLogo.removeAttribute("src");
      els.teamPickerLogo.alt = "";
      els.teamPickerLogo.style.opacity = "0";
    }
  }

  if (els.teamPickerPanel){
    $$("button.teamOption", els.teamPickerPanel).forEach(btn => {
      const on = btn.dataset.team === t;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-selected", String(on));
    });
  }
}

function syncSelectionChips(team, pos){
  const t = cleanStr(team).toUpperCase();
  const p = cleanStr(pos).toUpperCase();

  if (els.selTeamLogo){
    if (t){
      els.selTeamLogo.src = teamLogoSrc(t);
      els.selTeamLogo.alt = t;
      els.selTeamLogo.style.opacity = "1";
    }else{
      els.selTeamLogo.removeAttribute("src");
      els.selTeamLogo.alt = "";
      els.selTeamLogo.style.opacity = "0";
    }
  }

  if (els.selTeamText){
    els.selTeamText.textContent = t || "—";
    const c = teamColorText(t);
    if (c){
      els.selTeamText.style.color = c;
      els.selTeamText.style.textShadow = `0 0 16px ${rgbaOf(`rgb(${hexToRgbaArr(c).slice(0,3).join(",")})`, 0.30)}`;
    }else{
      els.selTeamText.style.color = "rgba(255,255,255,0.86)";
      els.selTeamText.style.textShadow = "none";
    }
  }

  if (els.selPosText){
    els.selPosText.textContent = p || "—";
    els.selPosText.dataset.pos = p || "QB";
  }
}

function syncPlayerWeekScatterTitle(team){
  const t = cleanStr(team).toUpperCase();

  if (els.playerWeekTitlePos){
    const p = cleanStr(STATE.playerWeekScatterPos).toUpperCase();
    const isSingle = CONFIG.positions.includes(p);
    els.playerWeekTitlePos.textContent = isSingle ? p : "ALL";
    els.playerWeekTitlePos.dataset.pos = isSingle ? p : "ALL";
    els.playerWeekTitlePos.classList.toggle("posText--all", !isSingle);
  }

  if (els.playerWeekTitleTeam){
    els.playerWeekTitleTeam.textContent = t || "—";
    const c = teamColorText(t);
    if (c){
      els.playerWeekTitleTeam.style.color = c;
      els.playerWeekTitleTeam.style.textShadow = `0 0 16px ${rgbaOf(`rgb(${hexToRgbaArr(c).slice(0,3).join(",")})`, 0.24)}`;
    }else{
      els.playerWeekTitleTeam.style.color = "rgba(255,255,255,0.86)";
      els.playerWeekTitleTeam.style.textShadow = "none";
    }
  }
}

function applyHeatHighlights(){
  if (!els.heatTable) return;
  const cells = $$(".cell", els.heatTable);
  if (!cells.length) return;

  const mainTeam = STATE.selectedTeam;
  const mainPos = STATE.pos;
  const heatTeam = STATE.heatTeam;
  const heatPos = STATE.heatPos;

  for (const c of cells){
    const isMain = !!mainTeam && c.dataset.team === mainTeam && (c.dataset.pos === mainPos || c.dataset.pos === "TOTAL");
    c.classList.toggle("is-selected", isMain);

    const isHeat = !!heatTeam && !!heatPos && c.dataset.team === heatTeam && c.dataset.pos === heatPos;
    c.classList.toggle("is-heat-focus", isHeat);
  }
}

function setHeatPos(pos){
  const p = cleanStr(pos).toUpperCase();
  if (!CONFIG.positions.includes(p)) return;
  STATE.heatPos = p;
  syncHeatPosToggle(p);
  applyHeatHighlights();
}

function setHeatTeam(team, { scroll = true } = {}){
  const t = cleanStr(team).toUpperCase();
  if (!t) return;
  STATE.heatTeam = t;
  if (els.heatTeamSelect) els.heatTeamSelect.value = t;
  applyHeatHighlights();

  if (scroll){
    const cell = $(`.cell[data-team="${cssEsc(t)}"][data-pos="${cssEsc(STATE.heatPos)}"]`, els.heatTable);
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function pointsColor(pos, pts){
  const p = cleanStr(pos).toUpperCase();
  const th = PLAYER_POINTS_THRESHOLDS[p];
  const v = Number(pts);
  if (!th || !Number.isFinite(v)) return null;
  if (v >= th.high) return PLAYER_POINTS_COLORS.high;
  if (v >= th.solid) return PLAYER_POINTS_COLORS.solid;
  return PLAYER_POINTS_COLORS.low;
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
    await bootstrap();
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

  const mean = (arr) => {
    const xs = arr.filter(Number.isFinite);
    if (!xs.length) return NaN;
    return xs.reduce((a,b) => a + b, 0) / xs.length;
  };

  const league = { season: {}, recent: {} };
  for (const pos of CONFIG.positions){
    league.season[pos] = mean(DATA.season.map(r => toNum(r[`${pos}_Avg`])));
    league.recent[pos] = mean(DATA.recent.map(r => toNum(r[`${pos}_Avg`])));
  }
  DATA.leaguePosAvg = league;
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
  els.heatTeamSelect.innerHTML = "";
  if (els.teamPickerPanel) els.teamPickerPanel.innerHTML = "";
  const teams = [...DATA.byTeamSeason.keys()].sort();
  for (const t of teams){
    const opt2 = document.createElement("option");
    opt2.value = t;
    opt2.textContent = t;
    els.heatTeamSelect.appendChild(opt2);

    if (els.teamPickerPanel){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "teamOption";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", "false");
      btn.dataset.team = t;
      const src = teamLogoSrc(t);
      btn.innerHTML = `
        <img class="teamLogo teamLogo--opt" src="${src}" alt="${t}" />
        <span class="teamOption__code">${t}</span>
      `;
      els.teamPickerPanel.appendChild(btn);
    }
  }
  STATE.selectedTeam = teams[0] ?? null;
  STATE.heatTeam = teams[0] ?? null;
  els.heatTeamSelect.value = STATE.heatTeam ?? "";
  syncHeatPosToggle(STATE.heatPos);
  syncTeamPicker(STATE.selectedTeam);
}

function buildMiniLists(){
  const pos = STATE.pos;

  const posTag = `<span class="posText" data-pos="${pos}">${pos}</span>`;
  if (els.topSeasonTitle) els.topSeasonTitle.innerHTML = `Best matchups (through 2025) — ${posTag}`;
  if (els.topRecentTitle) els.topRecentTitle.innerHTML = `Best matchups (last 7 games) — ${posTag}`;
  if (els.trendUpTitle) els.trendUpTitle.innerHTML = `Trending up (Easier) — ${posTag}`;
  if (els.trendDownTitle) els.trendDownTitle.innerHTML = `Trending down (Tougher) — ${posTag}`;

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
          : "";

        return `
          <div class="lhs">
            <span class="rankDot" style="background:${dot}; box-shadow:0 0 0 3px ${rgbaOf(dot, 0.14)};"></span>
            <div class="tm">${r.t}</div>
            <div class="meta">${meta}</div>
          </div>
          <div class="rhs">${badge}</div>
        `;
      })();
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

  const hasTrend = Number.isFinite(s.dRank) && Number.isFinite(s.dAvg);
  const dRankTxt = hasTrend ? `${s.dRank > 0 ? "+" : ""}${fmt(s.dRank,0)}` : "—";
  const dAvgTxt = hasTrend ? `${s.dAvg > 0 ? "+" : ""}${fmt(s.dAvg,2)}` : "—";

  els.quickCards.innerHTML = [
    card("Season", s.seasonAvg, s.seasonRank, gmS, ""),
    card("Weeks 9–15", s.recentAvg, s.recentRank, gmR, ""),
	    `<div class="card" style="background:radial-gradient(260px 90px at 18% 10%, ${rgbaOf(trendAccent,0.20)}, transparent 60%), rgba(255,255,255,0.045); border-color:${rgbaOf(trendAccent,0.22)}">
	      <div class="card__top">
	        <div class="card__title">Season ↔ Recent Trend</div>
	        <span class="chip">
	          <span class="swatch" style="background:linear-gradient(135deg, rgba(0,191,255,1), rgba(207,120,255,1));"></span>
	          ${hasTrend ? "TREND" : "—"}
	        </span>
	      </div>
	      <div class="card__big">${hasTrend ? `${dRankTxt} <span class="muted" style="font-size:12px;font-weight:700;">rank</span>` : "—"}</div>
	      <div class="card__sub">${hasTrend ? `ΔRank: <strong>${dRankTxt}</strong> • ΔAvg: <strong>${dAvgTxt}</strong>` : "Trend not available"}</div>
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
      const rawPos = cell.dataset.pos;
      if (team) setHeatTeam(team, { scroll: false });
      if (CONFIG.positions.includes(rawPos)) setHeatPos(rawPos);

      const pos = rawPos === "TOTAL" ? STATE.pos : rawPos;
      selectTeam(team, pos);
    });
  });

  applyHeatHighlights();
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

// Scatter: resolve visual overlap by iteratively separating point elements in pixel space.
// Note: we intentionally operate on Chart.js element x/y so tooltips/clicks match what the user sees.
const NO_OVERLAP_SCATTER_PLUGIN = {
  id: "noOverlapScatter",
  afterDatasetsUpdate(chart, _, opts){
    const datasetIndex = Number.isFinite(opts?.datasetIndex) ? opts.datasetIndex : 0;
    const meta = chart.getDatasetMeta(datasetIndex);
    const elements = meta?.data ?? [];
    if (elements.length < 2) return;

    const area = chart.chartArea;
    if (!area) return;

    const ds = chart.data?.datasets?.[datasetIndex] ?? {};
    const dsRadius = typeof ds.pointRadius === "number" ? ds.pointRadius : NaN;
    const radius = Number.isFinite(dsRadius) ? dsRadius : (Number.isFinite(opts?.radius) ? opts.radius : 5);

    const minDistTarget = Number.isFinite(opts?.minDist) ? opts.minDist : (radius * 2 + 4);
    const minDistFloor = Math.max(radius * 2 + 2, 2);
    const padding = Number.isFinite(opts?.padding) ? opts.padding : (radius + 3);
    const iterations = Number.isFinite(opts?.iterations) ? opts.iterations : 240;
    const spring = Number.isFinite(opts?.spring) ? opts.spring : 0.012;

    const clampNode = (n) => {
      n.x = clamp(n.x, area.left + padding, area.right - padding);
      n.y = clamp(n.y, area.top + padding, area.bottom - padding);
    };

    const nodes = elements.map((el, i) => ({ i, x: el.x, y: el.y, x0: el.x, y0: el.y }));
    nodes.forEach(clampNode);

    const run = (minDist) => {
      for (let iter = 0; iter < iterations; iter++){
        let overlaps = 0;

        // collision resolution pass (pairwise, symmetric)
        for (let a = 0; a < nodes.length; a++){
          for (let b = a + 1; b < nodes.length; b++){
            const p = nodes[a];
            const q = nodes[b];

            let dx = p.x - q.x;
            let dy = p.y - q.y;
            let dist = Math.hypot(dx, dy);
            if (!Number.isFinite(dist)) continue;

            if (dist === 0){
              const h = ((p.i + 1) * 92821 + (q.i + 1) * 68917) % 360;
              const ang = (h * Math.PI) / 180;
              dx = Math.cos(ang);
              dy = Math.sin(ang);
              dist = 1;
            }

            if (dist < minDist){
              overlaps++;
              const overlap = (minDist - dist);
              const ux = dx / dist;
              const uy = dy / dist;
              const push = overlap / 2 + 0.01;
              p.x += ux * push;
              p.y += uy * push;
              q.x -= ux * push;
              q.y -= uy * push;
            }
          }
        }

        // gentle pull back toward the original layout (keeps the plot meaningfully arranged)
        for (const n of nodes){
          n.x += (n.x0 - n.x) * spring;
          n.y += (n.y0 - n.y) * spring;
          clampNode(n);
        }

        if (overlaps === 0) return true;
      }
      return false;
    };

    // If the requested spacing is too aggressive to fit, step it down a bit while keeping non-overlap.
    let minDist = minDistTarget;
    for (let attempt = 0; attempt < 4; attempt++){
      if (run(minDist)) break;
      minDist = Math.max(minDistFloor, minDist - 2);
    }

    for (const n of nodes){
      elements[n.i].x = n.x;
      elements[n.i].y = n.y;
    }
  },
};

const PLAYER_WEEK_AVG_MARKERS_PLUGIN = {
  id: "playerWeekAvgMarkers",
  afterDraw(chart, _, opts){
    const area = chart.chartArea;
    const yScale = chart.scales?.y;
    if (!area || !yScale) return;

    const teamAvg = opts?.teamAvg;
    const leagueAvg = opts?.leagueAvg;
    const teamColor = opts?.teamColor ?? "rgba(0,191,255,0.90)";
    const leagueColor = opts?.leagueColor ?? "rgba(255,255,255,0.75)";

    const drawMarker = (x, y, kind, fill) => {
      const ctx = chart.ctx;
      ctx.save();
      ctx.translate(0.5, 0.5);

      if (kind === "triangle"){
        ctx.fillStyle = fill;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + 4, y - 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }else{
        ctx.fillStyle = fill;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    };

    const within = (y) => Number.isFinite(y) && y >= area.top - 1 && y <= area.bottom + 1;
    const xTeam = area.left + 6;
    const xLeague = area.left + 18;

    if (Number.isFinite(teamAvg)){
      const y = yScale.getPixelForValue(teamAvg);
      if (within(y)) drawMarker(xTeam, y, "triangle", teamColor);
    }

    if (Number.isFinite(leagueAvg)){
      const y = yScale.getPixelForValue(leagueAvg);
      if (within(y)) drawMarker(xLeague, y, "circle", leagueColor);
    }
  }
};

function buildScatter(){
  if (!DATA.byTeamSeason || !DATA.byTeamRecent) return;

  const pos = STATE.pos;
  els.scatterTitle.textContent = pos;
  els.scatterTitle.dataset.pos = pos;

  const teams = [...DATA.byTeamSeason.keys()].sort();
  const points = teams.map(t => {
    const x = STATE.scatterMode === "avg" ? getMetric(t, "season", `${pos}_Avg`) : getMetric(t, "season", `${pos}_Rk`);
    const y = STATE.scatterMode === "avg" ? getMetric(t, "recent", `${pos}_Avg`) : getMetric(t, "recent", `${pos}_Rk`);
    return { x, y, t };
  }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

  // Dynamic bounds (esp. important in AVG mode so points aren't overly compressed).
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  const xMinData = Math.min(...xs);
  const xMaxData = Math.max(...xs);
  const yMinData = Math.min(...ys);
  const yMaxData = Math.max(...ys);

  const isAvg = STATE.scatterMode === "avg";
  const padMinMax = (mn, mx, frac = 0.06) => {
    const range = mx - mn;
    const pad = range > 0 ? (range * frac) : (isAvg ? 0.5 : 1);
    return [mn - pad, mx + pad];
  };

  let xMin, xMax, yMin, yMax;
  if (isAvg){
    [xMin, xMax] = padMinMax(xMinData, xMaxData, 0.065);
    [yMin, yMax] = padMinMax(yMinData, yMaxData, 0.065);
  }else{
    // ranks are ~1..32
    xMin = 0.5;
    xMax = 32.5;
    yMin = 0.5;
    yMax = 32.5;
  }

  // "No change" line (y=x), clipped to the visible intersection of x/y ranges.
  const dMin = Math.max(xMin, yMin);
  const dMax = Math.min(xMax, yMax);
  const diag = (Number.isFinite(dMin) && Number.isFinite(dMax) && dMin < dMax)
    ? [{x:dMin, y:dMin}, {x:dMax, y:dMax}]
    : [{x:xMinData, y:xMinData}, {x:xMaxData, y:xMaxData}];

  const ctx = document.getElementById("scatterChart").getContext("2d");

  if (charts.scatter) charts.scatter.destroy();

  const logoRadius = Math.max(6, Math.round(SCATTER_TEAM_LOGO_PX / 2));
  const logoMinDist = logoRadius * 2 + 4;
  const logoPad = logoRadius + 4;

	  charts.scatter = new Chart(ctx, {
	    type: "scatter",
	    plugins: [NO_OVERLAP_SCATTER_PLUGIN],
	    data: {
      datasets: [
	        {
	          label: "Defenses",
	          data: points,
	          pointRadius: logoRadius,
	          pointHoverRadius: logoRadius,
	          pointBorderWidth: 0,
	          pointStyle: (ctx) => getTeamLogo(ctx.raw?.t) ?? "circle",
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
          pointRadius: 1,
          borderDash: [6,6],
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.3)",
        }
      ]
    },
	    options: {
	      responsive: true,
	      maintainAspectRatio: false,
	      animation: false,
	      // reduce ResizeObserver churn in some publishing environments
	      resizeDelay: 120,
	      parsing: false,
        layout: { padding: { left: 10, right: 10, top: 8, bottom: 6 } },
      scales: {
        x: {
          title: { display: true, text: `Season (${STATE.scatterMode === "avg" ? "Avg FPA" : "Rank"})` },
          min: xMin,
          max: xMax,
          grid: { color: "rgba(255,255,255,0.01)" },
        },
        y: {
          title: { display: true, text: `Weeks 9–15 (${STATE.scatterMode === "avg" ? "Avg FPA" : "Rank"})` },
          min: yMin,
          max: yMax,
          grid: { color: "rgba(255,255,255,0.01)" },
        },
      },
	      plugins: {
	        noOverlapScatter: { datasetIndex: 0, minDist: logoMinDist, padding: logoPad, iterations: 520, spring: 0.008 },
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

function renderPlayerWeekAvgPills(team, pos){
  if (!els.playerWeekAvgPills) return;
  const t = cleanStr(team).toUpperCase();
  const p = cleanStr(pos).toUpperCase();
  if (!t || !CONFIG.positions.includes(p)){
    els.playerWeekAvgPills.innerHTML = "";
    return;
  }

  const datasetName = STATE.activeDataset;
  const teamAvg = getMetric(t, datasetName, `${p}_Avg`);
  const leagueAvg = DATA.leaguePosAvg?.[datasetName]?.[p];
  const posHex = PLAYER_SCATTER_COLORS[p] ?? "#ffffff";
  const [pr, pg, pb] = hexToRgbaArr(posHex);
  const posSwatch = `rgba(${pr}, ${pg}, ${pb}, 0.92)`;

  const pill = (label, value, swatch) => `
    <div class="avgPill" title="${label}">
      <span class="avgPill__swatch" style="background:${swatch}; box-shadow:0 0 0 3px ${rgbaOf(swatch,0.10)};"></span>
      <span>${label}: <strong>${fmt(value,2)}</strong></span>
    </div>
  `;

  const parts = [];
  if (Number.isFinite(teamAvg)) parts.push(pill("Team avg", teamAvg, posSwatch));
  if (Number.isFinite(leagueAvg)) parts.push(pill("League avg", leagueAvg, "rgba(255,255,255,0.55)"));
  els.playerWeekAvgPills.innerHTML = parts.join("");
}

function buildPlayerWeekScatter(){
  const canvas = document.getElementById("playerWeekScatterChart");
  if (!canvas || !DATA.playersLong) return;

  const team = STATE.selectedTeam;
  syncPlayerWeekScatterTitle(team);
  if (!team){
    if (charts.playerWeekScatter) charts.playerWeekScatter.destroy();
    charts.playerWeekScatter = null;
    renderPlayerWeekAvgPills(null, null);
    return;
  }

  renderPlayerWeekAvgPills(team, STATE.playerWeekScatterPos);

  const activePos = STATE.playerWeekScatterPos === "ALL"
    ? [...CONFIG.positions]
    : [STATE.playerWeekScatterPos].filter(p => CONFIG.positions.includes(p));
  const byPos = new Map(CONFIG.positions.map(p => [p, []]));

  for (const r of DATA.playersLong){
    if (r.def !== team) continue;
    if (!activePos.includes(r.pos)) continue;
    byPos.get(r.pos)?.push(r);
  }

  const datasets = [];

  for (const pos of activePos){
    const rows = byPos.get(pos) ?? [];
    if (!rows.length) continue;

    let minPts = Infinity;
    let maxPts = -Infinity;
    for (const r of rows){
      if (!Number.isFinite(r.pts)) continue;
      minPts = Math.min(minPts, r.pts);
      maxPts = Math.max(maxPts, r.pts);
    }
    if (!Number.isFinite(minPts) || !Number.isFinite(maxPts)) continue;
    if (minPts === maxPts){
      minPts -= 1;
      maxPts += 1;
    }

    const base = PLAYER_SCATTER_RGBA[pos] ?? [255,255,255,0.85];

    datasets.push({
      label: pos,
      data: rows
        .filter(r => Number.isFinite(r.week) && Number.isFinite(r.pts))
        .map(r => ({ x: r.week, y: r.pts, player: r.player, playerTeam: r.playerTeam, pos: r.pos })),
      _minPts: minPts,
      _maxPts: maxPts,
      _base: base,
      clip: false,
      pointRadius: 7.5,
      pointHoverRadius: 6.5,
      pointBorderWidth: 1,
      pointBackgroundColor: (ctx) => {
        const d = ctx.dataset;
        const y = ctx.raw?.y;
        return pointGradientColor(d._base, y, d._minPts, d._maxPts);
      },
      pointBorderColor: (ctx) => {
        const d = ctx.dataset;
        const y = ctx.raw?.y;
        const c = pointGradientColor(d._base, y, d._minPts, d._maxPts);
        return rgbaOf(c, 0.95);
      },
    });
  }

  // Average markers (only when a single position is selected)
  let teamAvg = NaN;
  let leagueAvg = NaN;
  let teamAvgColor = "rgba(0,191,255,0.90)";
  if (CONFIG.positions.includes(STATE.playerWeekScatterPos)){
    const p = STATE.playerWeekScatterPos;
    const dsName = STATE.activeDataset;
    teamAvg = getMetric(team, dsName, `${p}_Avg`);
    leagueAvg = DATA.leaguePosAvg?.[dsName]?.[p];
    const [r,g,b] = hexToRgbaArr(PLAYER_SCATTER_COLORS[p] ?? "#ffffff");
    teamAvgColor = `rgba(${r}, ${g}, ${b}, 0.90)`;
  }

  const ctx = canvas.getContext("2d");
  if (charts.playerWeekScatter) charts.playerWeekScatter.destroy();

  charts.playerWeekScatter = new Chart(ctx, {
    type: "scatter",
    plugins: [PLAYER_WEEK_AVG_MARKERS_PLUGIN],
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      parsing: false,
      interaction: { mode: "nearest", intersect: true },
      layout: { padding: { left: 14, right: 14, top: 8, bottom: 6 } },
      plugins: {
        playerWeekAvgMarkers: { teamAvg, leagueAvg, teamColor: teamAvgColor, leagueColor: "rgba(255,255,255,0.75)" },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const r = item.raw ?? {};
              const tm = r.playerTeam ? ` (${r.playerTeam})` : "";
              return `${r.player ?? "—"}${tm} • ${r.pos ?? "—"} • W${r.x}: ${fmt(r.y,2)} pts`;
            }
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          min: 1,
          max: CONFIG.maxWeek,
          ticks: {
            stepSize: 1,
            callback: (v) => `W${v}`,
          },
          title: { display: true, text: "Week" },
          grid: { color: "rgba(255,255,255,0.02)" },
        },
        y: {
          min: 0,
          suggestedMax: 40,
          title: { display: true, text: "Points" },
          grid: { color: "rgba(255,255,255,0.03)" },
        }
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
	      ${rows.map(r => {
	        const tm = r.playerTeam || "—";
	        const tmColor = teamColorText(tm);
	        const ptsColor = pointsColor(r.pos, r.pts);
	        const ptsStyle = `font-weight:850;${ptsColor ? `color:${ptsColor};` : ""}`;
	        const tmStyle = tmColor ? `style="font-weight:900;color:${tmColor};"` : `style="font-weight:900;"`;
	        return `
	          <tr>
	            <td>W${r.week}</td>
	            <td>${r.player}</td>
	            <td><span ${tmStyle}>${tm}</span></td>
	            <td style="${ptsStyle}">${fmt(r.pts,2)}</td>
	          </tr>
	        `;
	      }).join("")}
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
  if (els.playersSub) els.playersSub.innerHTML = `${team} vs <span class="posText" data-pos="${pos}">${pos}</span> • players by week`;
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
  buildPlayerWeekScatter();
}

function selectTeam(team, pos = STATE.pos){
  const prevPos = STATE.pos;
  STATE.selectedTeam = team;
  STATE.pos = pos;
  setTeamPickerOpen(false);
  const posChanged = prevPos !== STATE.pos;
  if (posChanged){
    // Main position controls the player-week scatter too (unless the user later overrides via pos2).
    setPlayerWeekScatterPos(STATE.pos, { rebuild: false });
  }

  // update controls
  syncTeamPicker(team);
  $$(".pos-btn").forEach(b => b.classList.toggle("is-active", b.dataset.pos === STATE.pos));

  // pill
  els.profilePill.querySelector("span:last-child").innerHTML = `Selected: <strong>${team}</strong> • Position: <strong class="posText" data-pos="${STATE.pos}">${STATE.pos}</strong>`;
  els.profilePill.querySelector(".dot").style.background = "rgba(0,191,255,0.85)";
  els.profilePill.querySelector(".dot").style.boxShadow = "0 0 0 3px rgba(0,191,255,0.12)";

  buildQuickCards();
  buildMiniLists();
  buildScatter();
  buildPlayerWeekScatter();
  buildPlayersSection(team, STATE.pos);

  applyHeatHighlights();
  syncSelectionChips(team, STATE.pos);
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

  // opponent defense picker (custom dropdown)
  if (els.teamPickerBtn && els.teamPickerPanel){
    const close = () => setTeamPickerOpen(false);

    els.teamPickerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setTeamPickerOpen(!isTeamPickerOpen());
    });

    els.teamPickerPanel.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button.teamOption");
      const team = btn?.dataset?.team;
      if (!team) return;
      close();
      selectTeam(team, STATE.pos);
    });

    document.addEventListener("click", (e) => {
      if (!isTeamPickerOpen()) return;
      const inside = els.teamPicker?.contains(e.target);
      if (!inside) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isTeamPickerOpen()) close();
    });
  }

  if (els.heatPosToggle){
    $$("button.heatPosBtn", els.heatPosToggle).forEach(b => b.addEventListener("click", () => {
      const p = b.dataset.pos;
      if (!CONFIG.positions.includes(p)) return;
      setHeatPos(p);
    }));
  }

  els.heatTeamSelect.addEventListener("change", () => {
    setHeatTeam(els.heatTeamSelect.value);
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

  // player week scatter pos filters
  if (els.playerScatterPosToggle){
    const btns = $$("button.pos2-btn", els.playerScatterPosToggle);
    setPlayerWeekScatterPos(STATE.playerWeekScatterPos ?? STATE.pos, { rebuild: false });

    btns.forEach(b => b.addEventListener("click", () => {
      setPlayerWeekScatterPos(b.dataset.pos, { rebuild: true });
    }));
  }

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

async function bootstrap(){
  chartCommon();
  buildMaps();
  buildPlayersLong();
  await loadTeamLogos([...DATA.byTeamSeason.keys()]);
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
    await bootstrap();
  }else{
    // wait for user upload
  }
})();
