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
  'SF': '#B3995D', 'CHI': '#b1c7efff', 'CIN': '#FB4F14', 'BUF': '#C60C30',
  'DEN': '#FB4F14', 'CLE': '#ff3c00', 'TB': '#ca3d00ff', 'ARI': '#97233F',
  'LAC': '#0080C6', 'SD': '#0080C6', 'KC': '#E31837', 'IND': '#033f84ff',
  'WAS': '#821f1fff', 'DAL': '#869397', 'MIA': '#008E97', 'PHI': '#2B8C4E',
  'ATL': '#A71930', 'NYG': '#0c2780ff', 'JAX': '#006778', 'NYJ': '#125740',
  'DET': '#0076B6', 'GB': '#ffb612', 'CAR': '#0085CA', 'NE': '#003b76ff',
  'LV': '#A5ACAF', 'OAK': '#A5ACAF', 'LAR': '#003aa5ff', 'STL': '#003594',
  'BAL': '#491ca9ff', 'NO': '#D3BC8D', 'SEA': '#69BE28', 'PIT': '#FFB612',
  'HOU': '#a71930', 'TEN': '#4B92DB', 'MIN': '#4F2683'
};

// Per-team logo glow specs (color + radius) to match the CSS glow tuning.
// blur values are tuned for ~17px logos and scaled for the Season vs Weeks scatter.
const TEAM_LOGO_GLOW = {
  ARI: { glow: "rgba(151, 35, 63, 0.95)", blur: 3.2 },
  ATL: { glow: "rgba(255, 56, 95, 0.93)", blur: 3.0 },
  BAL: { glow: "rgba(158, 43, 246, 0.95)", blur: 3.2 },
  BUF: { glow: "rgba(198, 12, 48, 0.93)", blur: 3.2 },
  CAR: { glow: "rgba(0, 133, 202, 0.95)", blur: 3.2 },
  CHI: { glow: "rgba(120, 90, 240, 0.93)", blur: 3.2 },
  CIN: { glow: "rgba(251, 79, 20, 0.95)", blur: 3.2 },
  CLE: { glow: "rgba(225, 135, 0, 0.68)", blur: 2.4 },
  DAL: { glow: "rgba(134, 147, 151, 0.86)", blur: 2.4 },
  DEN: { glow: "rgba(251, 79, 20, 0.93)", blur: 3.2 },
  DET: { glow: "rgba(0, 183, 235, 0.86)", blur: 2.8 },
  GB:  { glow: "rgba(0, 235, 150, 0.68)", blur: 2.4 },
  HOU: { glow: "rgba(167, 25, 48, 0.95)", blur: 3.2 },
  IND: { glow: "rgba(0, 183, 235, 0.93)", blur: 2.4 },
  JAX: { glow: "rgba(0, 103, 120, 0.95)", blur: 3.2 },
  KC:  { glow: "rgba(255, 0, 64, 0.84)", blur: 2.6 },
  LAC: { glow: "rgba(0, 191, 255, 0.74)", blur: 3.2 },
  LAR: { glow: "rgba(0, 91, 200, 0.93)", blur: 2.6 },
  LV:  { glow: "rgba(165, 172, 175, 0.86)", blur: 2.8 },
  MIA: { glow: "rgba(0, 142, 151, 0.93)", blur: 2.8 },
  MIN: { glow: "rgba(115, 0, 255, 0.95)", blur: 3.0 },
  NE:  { glow: "rgba(255, 56, 95, 0.93)", blur: 3.2 },
  NO:  { glow: "rgba(160, 148, 101, 0.86)", blur: 2.6 },
  NYG: { glow: "rgba(55, 56, 200, 0.95)", blur: 3.2 },
  NYJ: { glow: "rgba(64, 160, 120, 0.95)", blur: 3.2 },
  PHI: { glow: "rgba(43, 140, 78, 0.95)", blur: 2.6 },
  PIT: { glow: "rgba(255, 182, 18, 0.61)", blur: 2.4 },
  SEA: { glow: "rgba(105, 190, 40, 0.86)", blur: 2.4 },
  SF:  { glow: "rgba(179, 153, 93, 0.74)", blur: 2.6 },
  TB:  { glow: "rgba(247, 122, 97, 0.74)", blur: 2.4 },
  TEN: { glow: "rgba(75, 146, 219, 0.95)", blur: 3.2 },
  WAS: { glow: "rgba(180, 36, 36, 0.95)", blur: 3.2 },
};

const TEAM_LOGO_ALIASES = {
  SD: "LAC",
  OAK: "LV",
  STL: "LAR",
  JAC: "JAX",
};

const SCATTER_TEAM_LOGO_PX_DESKTOP = 34;
const SCATTER_TEAM_LOGO_PX_MOBILE = 28;
const SCATTER_MOBILE_MQ = window.matchMedia("(max-width: 760px)");
let SCATTER_TEAM_LOGO_PX = SCATTER_MOBILE_MQ.matches ? SCATTER_TEAM_LOGO_PX_MOBILE : SCATTER_TEAM_LOGO_PX_DESKTOP; // Chart.js draws image pointStyles at intrinsic width/height
const TEAM_LOGOS = new Map(); // TEAM -> HTMLImageElement (sized for scatter points)

function canonicalTeamCode(team){
  const t = cleanStr(team).toUpperCase();
  return TEAM_LOGO_ALIASES[t] ?? t;
}

// Keep the Season vs Weeks scatter point-logo sizing responsive to the viewport.
{
  const onChange = (e) => {
    setScatterTeamLogoPx(e.matches ? SCATTER_TEAM_LOGO_PX_MOBILE : SCATTER_TEAM_LOGO_PX_DESKTOP);
    buildScatter();
  };
  if (typeof SCATTER_MOBILE_MQ?.addEventListener === "function"){
    SCATTER_MOBILE_MQ.addEventListener("change", onChange);
  }else if (typeof SCATTER_MOBILE_MQ?.addListener === "function"){
    SCATTER_MOBILE_MQ.addListener(onChange);
  }
}

function teamLogoSrc(team){
  const code = canonicalTeamCode(team);
  return `assets/NFL-Tags_webp/${code.toLowerCase()}.webp`;
}

function getTeamLogo(team){
  const code = canonicalTeamCode(team);
  return TEAM_LOGOS.get(code) ?? null;
}

function getTeamLogoGlowSpec(team){
  const code = canonicalTeamCode(team);
  return TEAM_LOGO_GLOW[code] ?? null;
}

function setScatterTeamLogoPx(px){
  const next = Math.max(16, Math.round(Number(px) || SCATTER_TEAM_LOGO_PX));
  SCATTER_TEAM_LOGO_PX = next;
  for (const img of TEAM_LOGOS.values()){
    img.width = next;
    img.height = next;
  }
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
  heatTable: document.getElementById("heatTable"),
  quickCards: document.getElementById("quickCards"),
  uploader: document.getElementById("uploader"),
  fileInput: document.getElementById("fileInput"),

  scatterTitle: document.getElementById("scatterTitle"),
  playerScatterPosToggle: document.getElementById("playerScatterPosToggle"),
  playerWeekAvgPills: document.getElementById("playerWeekAvgPills"),
  playerWeekTitlePos: document.getElementById("playerWeekTitlePos"),
  playerWeekTitleLogo: document.getElementById("playerWeekTitleLogo"),
  playerWeekTitleTeam: document.getElementById("playerWeekTitleTeam"),
  topSeason: document.getElementById("topSeason"),
  topSeasonTitle: document.getElementById("topSeasonTitle"),
  topRecent: document.getElementById("topRecent"),
  topRecentTitle: document.getElementById("topRecentTitle"),
  trendUp: document.getElementById("trendUp"),
  trendUpTitle: document.getElementById("trendUpTitle"),
  trendDown: document.getElementById("trendDown"),
  trendDownTitle: document.getElementById("trendDownTitle"),
  miniPosToggle: document.getElementById("miniPosToggle"),

  playersSub: document.getElementById("playersSub"),
  weekRange: document.getElementById("weekRange"),
  playerSearch: document.getElementById("playerSearch"),
  playerTable: document.getElementById("playerTable"),
};

let STATE = {
  activeDataset: "season", // "season" | "recent" (controls heatmap only)
  pos: "QB",
  selectedTeam: null, // defense team for profile
  miniPos: "QB",
  heatSort: { col: "TOTAL", cycle: 0 }, // cycle: 0=default, 1=desc, 2=asc
  scatterMode: "avg", // "avg" | "rank"
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

function ordinalMarkup(x){
  const n = Math.round(toNum(x));
  if (!Number.isFinite(n)) return "—";
  const mod100 = n % 100;
  let suf = "th";
  if (!(mod100 >= 11 && mod100 <= 13)){
    const mod10 = n % 10;
    suf = mod10 === 1 ? "st" : (mod10 === 2 ? "nd" : (mod10 === 3 ? "rd" : "th"));
  }
  return `<span class="ord"><span class="ord__n">${n}</span><span class="ord__suf">${suf}</span></span>`;
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

function syncMiniPosToggle(pos){
  if (!els.miniPosToggle) return;
  const p = cleanStr(pos).toUpperCase();
  $$("button.heatPosBtn", els.miniPosToggle).forEach(b => {
    const on = b.dataset.pos === p;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function setMiniPos(pos){
  const p = cleanStr(pos).toUpperCase();
  if (!CONFIG.positions.includes(p)) return;
  STATE.miniPos = p;
  syncMiniPosToggle(p);
  buildMiniLists();
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
    }else{
      els.selTeamText.style.color = "rgba(255,255,255,0.86)";
    }
    els.selTeamText.style.textShadow = "none";
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
    }else{
      els.playerWeekTitleTeam.style.color = "rgba(255,255,255,0.86)";
    }
    els.playerWeekTitleTeam.style.textShadow = "none";
  }

  if (els.playerWeekTitleLogo){
    if (t){
      els.playerWeekTitleLogo.src = teamLogoSrc(t);
      els.playerWeekTitleLogo.alt = t;
      els.playerWeekTitleLogo.style.opacity = "1";
    }else{
      els.playerWeekTitleLogo.removeAttribute("src");
      els.playerWeekTitleLogo.alt = "";
      els.playerWeekTitleLogo.style.opacity = "0";
    }
  }
}

function applyHeatHighlights(){
  if (!els.heatTable) return;
  const cells = $$(".cell", els.heatTable);
  if (!cells.length) return;

  const mainTeam = STATE.selectedTeam;
  const mainPos = STATE.pos;

  for (const c of cells){
    const isMain = !!mainTeam && c.dataset.team === mainTeam && (c.dataset.pos === mainPos || c.dataset.pos === "TOTAL");
    c.classList.toggle("is-selected", isMain);
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
  if (!els.loadStatus) return;
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
  if (els.teamPickerPanel) els.teamPickerPanel.innerHTML = "";
  const teams = [...DATA.byTeamSeason.keys()].sort();
  for (const t of teams){
    const addOption = (panel) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "teamOption";
	      btn.setAttribute("role", "option");
	      btn.setAttribute("aria-selected", "false");
	      btn.dataset.team = t;
	      const src = teamLogoSrc(t);
	      btn.innerHTML = `
	        <img class="teamLogo teamLogo--opt glow" src="${src}" alt="${t}" />
	        <span class="teamOption__code">${t}</span>
	      `;
	      panel.appendChild(btn);
    };

    if (els.teamPickerPanel) addOption(els.teamPickerPanel);
  }
  STATE.selectedTeam = teams[0] ?? null;
  syncTeamPicker(STATE.selectedTeam);
  syncMiniPosToggle(STATE.miniPos);
}

function buildMiniLists(){
  const pos = STATE.miniPos;

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
    if (sc >= 0.78) return "Great";
    if (sc >= 0.60) return "Good ";
    if (sc >= 0.40) return "Neutral";
    if (sc >= 0.22) return "Tough ";
    return "Avoid";
  };

  const chipFor = (rk) => {
    const sc = rankScore(rk);
    const c = heatColor(sc);
    return `<span class="chip" title="Higher rank = easier matchup">
      <span class="swatch" style="background:${c}; box-shadow:0 0 0 3px rgba(255,255,255,0.08)"></span>
      <span class="chip__label">${easyLabel(rk)}</span>
    </span>`;
  };

  const card = (title, avg, rk, gm, extra) => {
    const accent = heatColor(rankScore(rk));
    const bg = `radial-gradient(260px 90px at 18% 10%, ${rgbaOf(accent,0.22)}, transparent 60%), rgba(255,255,255,0.045)`;
    const rkHtml = ordinalMarkup(rk);
    return `
    <div class="card" style="background:${bg}; border-color:${rgbaOf(accent,0.22)}">
      <div class="card__top">
        <div class="card__title">${title}</div>
      </div>
      <div class="card__big">${rkHtml} <span class="cardVs">vs. <span class="posText" data-pos="${pos}">${pos}</span></span></div>
      <div class="card__sub"><strong>${fmt(avg,2)}</strong> FPA • Games: <strong>${fmt(gm,0)}</strong> ${extra ?? ""}</div>
      <div class="card__chipRow">${chipFor(rk)}</div>
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
		    (() => {
        const bg = `radial-gradient(260px 90px at 18% 10%, ${rgbaOf(trendAccent,0.20)}, transparent 60%), rgba(255,255,255,0.045)`;
        const trendDir = hasTrend ? (s.dRank > 0 ? "up" : (s.dRank < 0 ? "down" : "flat")) : "flat";
        const trendIcon = !hasTrend
          ? ""
          : (trendDir === "up"
              ? `<i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i>`
              : (trendDir === "down"
                  ? `<i class="fa-solid fa-arrow-trend-down" aria-hidden="true"></i>`
                  : `<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>`));
	        const trendChip = `
	          <span class="chip">
	            <span class="swatch" style="background:linear-gradient(135deg, rgba(0,191,255,1), rgba(207,120,255,1));"></span>
	            <span class="chip__label">${hasTrend ? `TREND <span class="chip__icon chip__icon--${trendDir}">${trendIcon}</span>` : "—"}</span>
	          </span>
	        `;
	        const big = hasTrend
	          ? `${dRankTxt} <span class="trendRankSuffix">rank</span> <span class="cardVs">vs. <span class="posText" data-pos="${pos}">${pos}</span></span>`
	          : "—";
        const sub = hasTrend
          ? `ΔRank: <strong>${dRankTxt}</strong> • ΔAvg: <strong>${dAvgTxt}</strong>`
          : "Trend not available";
        return `
          <div class="card" style="background:${bg}; border-color:${rgbaOf(trendAccent,0.22)}">
            <div class="card__top">
              <div class="card__title">Season ↔ Recent</div>
            </div>
            <div class="card__big">${big}</div>
            <div class="card__sub">${sub}</div>
            <div class="card__chipRow">${trendChip}</div>
          </div>
        `;
      })()
	  ].join("");

}

function buildHeatTable(){
  const datasetName = STATE.activeDataset;
  const rows = datasetName === "season" ? DATA.season : DATA.recent;

  const colToMetric = (col) => {
    const c = cleanStr(col).toUpperCase();
    if (c === "QB") return "QB_Rk";
    if (c === "RB") return "RB_Rk";
    if (c === "WR") return "WR_Rk";
    if (c === "TE") return "TE_Rk";
    if (c === "TOTAL") return "Total_Rk";
    return "Total_Rk";
  };

  const defaultCol = "TOTAL";
  const sortCol = (STATE.heatSort?.cycle ?? 0) === 0 ? defaultCol : (STATE.heatSort?.col ?? defaultCol);
  const sortCycle = STATE.heatSort?.cycle ?? 0;
  const sortDir = sortCycle === 2 ? "asc" : "desc";
  const key = colToMetric(sortCol);

  const sorted = [...rows].sort((a,b) => {
    const av = toNum(a[key]);
    const bv = toNum(b[key]);
    if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
    if (!Number.isFinite(av)) return 1;
    if (!Number.isFinite(bv)) return -1;
    return sortDir === "desc" ? (bv - av) : (av - bv);
  });

  const hdr = (col, label) => {
    const c = cleanStr(col).toUpperCase();
    const active = sortCycle !== 0 && c === sortCol;
    const icon = active
      ? (sortDir === "desc"
          ? ` <i class="fa-solid fa-arrow-down-wide-short heatSortIcon" aria-hidden="true"></i>`
          : ` <i class="fa-solid fa-arrow-up-short-wide heatSortIcon" aria-hidden="true"></i>`)
      : "";
    return `<th class="heatTh is-sortable${active ? " is-active" : ""}" data-col="${c}">${label}${icon}</th>`;
  };

  els.heatTable.innerHTML = `
    <thead>
      <tr>
        <th class="heatTh heatTh--def" style="min-width:74px;">DEF</th>
        ${hdr("QB","QB")}
        ${hdr("RB","RB")}
        ${hdr("WR","WR")}
        ${hdr("TE","TE")}
        ${hdr("TOTAL","Total")}
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

  // header sort toggles (cycle: desc -> asc -> default)
  $$("thead th.heatTh.is-sortable", els.heatTable).forEach(th => {
    th.addEventListener("click", () => {
      const col = cleanStr(th.dataset.col).toUpperCase();
      const valid = ["QB","RB","WR","TE","TOTAL"].includes(col);
      if (!valid) return;

      const cur = STATE.heatSort ?? { col: defaultCol, cycle: 0 };
      const same = cleanStr(cur.col).toUpperCase() === col;

      if (!same){
        STATE.heatSort = { col, cycle: 1 };
      }else if (cur.cycle === 0){
        STATE.heatSort = { col, cycle: 1 };
      }else if (cur.cycle === 1){
        STATE.heatSort = { col, cycle: 2 };
      }else{
        STATE.heatSort = { col: defaultCol, cycle: 0 };
      }

      buildHeatTable();
    });
  });

  // bind clicks
  $$(".cell", els.heatTable).forEach(cell => {
    cell.addEventListener("click", () => {
      const team = cell.dataset.team;
      const rawPos = cell.dataset.pos;

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

const SCATTER_TOOLTIP_ID = "scatterTooltip";
function getOrCreateChartTooltip(id){
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement("div");
  el.id = id;
  el.className = "chartTooltip";
  document.body.appendChild(el);
  return el;
}

function scatterExternalTooltipHandler(context){
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateChartTooltip(SCATTER_TOOLTIP_ID);

  if (!tooltip || tooltip.opacity === 0){
    tooltipEl.style.opacity = "0";
    return;
  }

  const dp = tooltip.dataPoints?.[0];
  const t = cleanStr(dp?.raw?.t).toUpperCase();
  const pos = cleanStr(STATE.pos).toUpperCase();
  const tr = t && CONFIG.positions.includes(pos) ? calcTrend(t, pos) : null;

  const isAvg = STATE.scatterMode === "avg";
  const seasonVal = tr ? (isAvg ? fmt(tr.seasonAvg, 2) : ordinal(tr.seasonRank)) : "—";
  const recentVal = tr ? (isAvg ? fmt(tr.recentAvg, 2) : ordinal(tr.recentRank)) : "—";
  const dRank = tr && Number.isFinite(tr.dRank) ? `${tr.dRank > 0 ? "+" : ""}${fmt(tr.dRank, 0)}` : "—";
  const dAvg = tr && Number.isFinite(tr.dAvg) ? `${tr.dAvg > 0 ? "+" : ""}${fmt(tr.dAvg, 2)}` : "—";

  const teamHex = teamColorText(t);
  const teamStyle = teamHex
    ? `style="color:${teamHex};"`
    : "";

  const logo = t ? `<img class="chartTooltip__logo glow" src="${teamLogoSrc(t)}" alt="${t}" />` : "";
  tooltipEl.innerHTML = `
    <div class="chartTooltip__row">
      ${logo}
      <div>
        <div class="chartTooltip__title"><span class="teamText" ${teamStyle}>${t || "—"}</span></div>
        <div class="chartTooltip__meta">
          ${isAvg ? `Season: <strong>${seasonVal}</strong> • Weeks 9–15: <strong>${recentVal}</strong> • ΔAvg: <strong>${dAvg}</strong> • ΔRk: <strong>${dRank}</strong>`
            : `Season: <strong>${seasonVal}</strong> • Weeks 9–15: <strong>${recentVal}</strong> • ΔRk: <strong>${dRank}</strong> • ΔAvg: <strong>${dAvg}</strong>`}
        </div>
      </div>
    </div>
  `;

  const { left, top } = chart.canvas.getBoundingClientRect();
  const w = tooltipEl.offsetWidth || 0;
  const pad = 10;
  const minX = window.pageXOffset + pad + (w / 2);
  const maxX = window.pageXOffset + window.innerWidth - pad - (w / 2);

  const x = clamp(left + window.pageXOffset + tooltip.caretX, minX, maxX);
  const y = top + window.pageYOffset + tooltip.caretY;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
  tooltipEl.style.opacity = "1";
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

// Draw per-team glow behind logo points in the Season vs Weeks scatter.
const SCATTER_LOGO_GLOW_PLUGIN = {
  id: "scatterLogoGlow",
  beforeDatasetDraw(chart, args){
    if ((args?.index ?? args?.datasetIndex) !== 0) return;
    const area = chart.chartArea;
    if (!area) return;

    const meta = chart.getDatasetMeta(0);
    const elements = meta?.data ?? [];
    if (!elements.length) return;

    const ds = chart.data?.datasets?.[0] ?? {};
    const data = ds.data ?? [];

    const ctx = chart.ctx;
    const basePx = 17; // glow tuning reference from the CSS sample
    const scale = clamp(SCATTER_TEAM_LOGO_PX / basePx, 0.9, 3.0);
    const r = Math.max(5, SCATTER_TEAM_LOGO_PX * 0.28);

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    ctx.clip();

    for (let i = 0; i < elements.length; i++){
      const el = elements[i];
      if (!el) continue;
      const raw = data[i] ?? {};
      const t = cleanStr(raw.t).toUpperCase();
      const spec = getTeamLogoGlowSpec(t);
      if (!spec?.glow) continue;

      const blur = (Number(spec.blur) || 3.0) * scale;
      ctx.shadowColor = spec.glow;
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = rgbaOf(spec.glow, 0.18);
      ctx.beginPath();
      ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
};

function buildScatter(){
  if (!DATA.byTeamSeason || !DATA.byTeamRecent) return;

  const pos = STATE.pos;
  els.scatterTitle.textContent = pos;
  els.scatterTitle.dataset.pos = pos;
  const isMobile = SCATTER_MOBILE_MQ.matches;

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

  const tip = document.getElementById(SCATTER_TOOLTIP_ID);
  if (tip) tip.style.opacity = "0";
  if (charts.scatter) charts.scatter.destroy();

  const logoRadius = Math.max(6, Math.round(SCATTER_TEAM_LOGO_PX / 3));
  // Keep points from overlapping, but avoid pushing them too far from their true positions.
  const logoMinDist = logoRadius * 1 + 2;
  const logoPad = logoRadius + 0;

	  charts.scatter = new Chart(ctx, {
		    type: "scatter",
		    plugins: [NO_OVERLAP_SCATTER_PLUGIN, SCATTER_LOGO_GLOW_PLUGIN],
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
	            const rk = getMetric(team, "season", `${pos}_Rk`);
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
	        layout: { padding: isMobile ? { left: 6, right: 8, top: 6, bottom: 2 } : { left: 10, right: 10, top: 8, bottom: 6 } },
	      scales: {
	        x: {
	          title: {
	            display: true,
	            text: `Season (${STATE.scatterMode === "avg" ? "Avg FPA" : "Rank"})`,
	            padding: isMobile ? { top: 4, bottom: 0 } : { top: 8, bottom: 0 },
	          },
	          ticks: { padding: isMobile ? 2 : 6 },
	          min: xMin,
	          max: xMax,
	          grid: { color: "rgba(255,255,255,0.01)" },
	        },
	        y: {
	          title: {
	            display: true,
	            text: `Weeks 9–15 (${STATE.scatterMode === "avg" ? "Avg FPA" : "Rank"})`,
	            padding: isMobile ? { top: 0, bottom: 0 } : { top: 0, bottom: 0 },
	          },
	          ticks: { padding: isMobile ? 2 : 6 },
	          min: yMin,
	          max: yMax,
	          grid: { color: "rgba(255,255,255,0.01)" },
	        },
	      },
	      plugins: {
	        noOverlapScatter: { datasetIndex: 0, minDist: logoMinDist, padding: logoPad, iterations: 520, spring: 0.008 },
	        legend: { display: false },
	        tooltip: {
            enabled: false,
            external: scatterExternalTooltipHandler,
            filter: (item) => item.datasetIndex === 0,
          },
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

  const datasetName = "season";
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
  const isMobile = SCATTER_MOBILE_MQ.matches;

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
    const dsName = "season";
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
	      layout: { padding: isMobile ? { left: 8, right: 10, top: 7, bottom: 3 } : { left: 14, right: 14, top: 8, bottom: 6 } },
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
	          title: { display: true, text: "Week", padding: isMobile ? { top: 4, bottom: 0 } : { top: 8, bottom: 0 } },
	          ticks: { padding: isMobile ? 2 : 6, stepSize: 1, callback: (v) => `W${v}` },
	          grid: { color: "rgba(255,255,255,0.02)" },
	        },
	        y: {
	          min: 0,
	          suggestedMax: 40,
	          title: { display: true, text: "Points", padding: isMobile ? { top: 0, bottom: 0 } : { top: 0, bottom: 0 } },
	          ticks: { padding: isMobile ? 2 : 6 },
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
	        const tmCode = cleanStr(tm).toUpperCase();
	        const tmColor = teamColorText(tmCode);
	        const ptsColor = pointsColor(r.pos, r.pts);
	        const ptsStyle = `font-weight:850;${ptsColor ? `color:${ptsColor};` : ""}`;
	        const tmStyle = tmColor ? `style="color:${tmColor};"` : ``;
	        const tmCell = tmCode
	          ? `<span class="teamInline teamInline--tight"><img class="teamLogo teamLogo--opt glow" src="${teamLogoSrc(tmCode)}" alt="${tmCode}" /><span class="teamText" ${tmStyle}>${tmCode}</span></span>`
	          : `<span class="teamText">—</span>`;
        return `
          <tr>
            <td>W${r.week}</td>
            <td>${r.player}</td>
	            <td>${tmCell}</td>
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
	  const t = cleanStr(team).toUpperCase();
	  const c = teamColorText(t);
	  const style = c ? `style="color:${c};"` : "";
	  const teamTag = t
	    ? `<span class="teamInline teamInline--tight"><img class="teamLogo teamLogo--opt glow" src="${teamLogoSrc(t)}" alt="${t}" /><span class="teamText" ${style}>${t}</span></span>`
	    : "—";
  if (els.playersSub) els.playersSub.innerHTML = `${teamTag} vs <span class="posText" data-pos="${pos}">${pos}</span> • players by week`;
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
  applyHeatHighlights();
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

  buildQuickCards();
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

  // mini cards position toggle (controls only the mini cards list)
  if (els.miniPosToggle){
    $$("button.heatPosBtn", els.miniPosToggle).forEach(b => b.addEventListener("click", () => {
      const p = b.dataset.pos;
      if (!CONFIG.positions.includes(p)) return;
      setMiniPos(p);
    }));
  }

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
      const p = cleanStr(b.dataset.pos).toUpperCase();
      if (!CONFIG.positions.includes(p)) return;
      // Keep the chart toggle aligned with the main position toggle.
      selectTeam(STATE.selectedTeam, p);
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
