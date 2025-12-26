/* 2025 FPA Matchup Explorer
   - Drop the 3 CSVs next to this file (or upload them via the file input if fetch is blocked).
   - This page expects ranks where 1 = toughest, 32 = easiest (most fantasy points allowed).
*/

const CONFIG = {
  paths: {
    players: "data/WKLY-DEF_vs_POS_by_Player.csv",
    season: "data/Season_FPA_Summary.csv",
    recent: "data/WK9-16_FPA_Summary.csv",
  },
  // Defaults are overridden at runtime after CSV load.
  maxWeek: 16,
  recentSpanWeeks: 8,
  recentWeeks: [9, 16],
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
  low: "#fc6caae8",
};

// Team colors (use provided/official hex values; do not auto-brighten).
// Team colors (use provided/official hex values; do not auto-brighten).
const TEAM_COLORS = {
  'ARI': '#97233F', 'ATL': '#A71930', 'BAL': '#491ca9ff', 'BUF': '#C60C30',
  'CAR': '#0085CA', 'CHI': '#b1c7efff', 'CIN': '#FB4F14', 'CLE': '#ff3c00',
  'DAL': '#869397', 'DEN': '#FB4F14', 'DET': '#0076B6', 'GB': '#ffb612',
  'HOU': '#a71930', 'IND': '#033f84ff', 'JAX': '#006778', 'KC': '#E31837',
  'LAC': '#0080C6', 'LAR': '#003aa5ff', 'LV': '#A5ACAF', 'MIA': '#008E97',
  'MIN': '#4F2683', 'NE': '#003b76ff', 'NO': '#D3BC8D', 'NYG': '#0c2780ff',
  'NYJ': '#125740', 'OAK': '#A5ACAF', 'PHI': '#2B8C4E', 'PIT': '#FFB612',
  'SD': '#0080C6', 'SEA': '#69BE28', 'SF': '#B3995D', 'STL': '#003594',
  'TB': '#ca3d00ff', 'TEN': '#4B92DB', 'WAS': '#821f1fff'
};

// Player-name tint colors (Players by week table only).
// Safe to tweak per-team without affecting other UI.
const TEAM_NAME_COLORS = {
  'ARI': '#fdd1dcff', 'ATL': '#f7d7dcff', 'BAL': '#cfc0f0ff',
  'BUF': '#ffddddff','CAR': '#d6ecf6ff', 'CHI': '#ecf3ffff', 
  'CIN': '#fbdacfff', 'CLE': '#f8d8ceff', 'DAL': '#b8d3dbff',
  'DEN': '#fee6deff', 'DET': '#bce2f5ff', 'GB': '#f3fdd9b3',
  'HOU': '#f8bcc6ff', 'IND': '#e2efffff', 'JAX': '#d8f7fdff', 
  'KC': '#ffcdd5ff', 'LAC': '#e3f5ffff', 'LAR': '#c2d5f8ff', 
  'LV': '#A5ACAF', 'MIA': '#cdf6f9ff', 'MIN': '#dcc6f8ff', 
  'NE': '#e9f4ffff', 'NO': '#eedfc0ff', 'NYG': '#d8e1fdff',
  'NYJ': '#ceffefff', 'OAK': '#A5ACAF', 'PHI': '#d9ffe7ff',
  'PIT': '#fae8bcff', 'SD': '#0080C6', 'SEA': '#d8fabbd2', 
  'SF': '#e6d4abff', 'STL': '#d4e3ffff', 'TB': '#f7d0d0ff', 
  'TEN': '#bedfffff', 'WAS': '#deababff'
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
  TB:  { glow: "rgba(247, 122, 97, 0.74)", blur: 0 },
  TEN: { glow: "rgba(75, 146, 219, 0.95)", blur: 3.2 },
  WAS: { glow: "rgba(180, 36, 36, 0.95)", blur: 3.2 },
};

// NFL shield (league-average marker) glow color.
// The official NFL blue is ~#013369 (dark blue).
const NFL_LOGO_GLOW = "rgba(1, 51, 105, 0.95)";

const TEAM_LOGO_ALIASES = {
  SD: "LAC",
  OAK: "LV",
  STL: "LAR",
  JAC: "JAX",
};

const TEAM_FULL_NAMES = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
  SD: "Los Angeles Chargers",
  OAK: "Las Vegas Raiders",
  STL: "Los Angeles Rams",
  JAC: "Jacksonville Jaguars",
};

const POS_FULL_NAMES = {
  QB: "Quarterback",
  RB: "Running Back",
  WR: "Wide Receiver",
  TE: "Tight End",
};

// Division groupings for the team picker UI (canonical team codes).
const NFL_DIVISIONS = [
  { conf: "AFC", name: "AFC East", teams: ["BUF","MIA","NE","NYJ"] },
  { conf: "AFC", name: "AFC North", teams: ["BAL","CIN","CLE","PIT"] },
  { conf: "AFC", name: "AFC South", teams: ["HOU","IND","JAX","TEN"] },
  { conf: "AFC", name: "AFC West", teams: ["DEN","KC","LV","LAC"] },
  { conf: "NFC", name: "NFC East", teams: ["DAL","NYG","PHI","WAS"] },
  { conf: "NFC", name: "NFC North", teams: ["CHI","DET","GB","MIN"] },
  { conf: "NFC", name: "NFC South", teams: ["ATL","CAR","NO","TB"] },
  { conf: "NFC", name: "NFC West", teams: ["ARI","LAR","SF","SEA"] },
];

const SCATTER_TEAM_LOGO_PX_DESKTOP = 34;
const SCATTER_TEAM_LOGO_PX_MOBILE = 28;
const SCATTER_MOBILE_MQ = window.matchMedia("(max-width: 760px)");
const PAGE_HEADER_DESKTOP_MQ = window.matchMedia("(min-width: 981px)");
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

function teamLogoStackMarkup(team, { sizeClass = "teamLogo--opt", wrapClass = "" } = {}){
  const code = canonicalTeamCode(team);
  if (!code) return "";
  const src = teamLogoSrc(code);
  const wrap = ["teamLogoStack", wrapClass].filter(Boolean).join(" ");
  const base = ["teamLogo", sizeClass].filter(Boolean).join(" ");
  return `
    <span class="${wrap}" aria-hidden="true">
      <img class="${base} glow teamLogoStack__glow" src="${src}" alt="${code}" />
      <img class="${base} teamLogoStack__img" src="${src}" alt="${code}" />
    </span>
  `;
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
  teamPickerLogoGlow: document.getElementById("teamPickerLogoGlow"),
  teamPickerCode: document.getElementById("teamPickerCode"),
  selTeamLogo: document.getElementById("selTeamLogo"),
  selTeamLogoGlow: document.getElementById("selTeamLogoGlow"),
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
  playerWeekTitleLogoGlow: document.getElementById("playerWeekTitleLogoGlow"),
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

  playersExpandBtn: document.getElementById("playersExpandBtn"),
  playersModal: document.getElementById("playersModal"),
  playersModalClose: document.getElementById("playersModalClose"),
  playersModalSub: document.getElementById("playersModalSub"),
  modalRankCard: document.getElementById("modalRankCard"),

  modalTeamPicker: document.getElementById("modalTeamPicker"),
  modalTeamPickerBtn: document.getElementById("modalTeamPickerBtn"),
  modalTeamPickerPanel: document.getElementById("modalTeamPickerPanel"),
  modalTeamPickerLogo: document.getElementById("modalTeamPickerLogo"),
  modalTeamPickerLogoGlow: document.getElementById("modalTeamPickerLogoGlow"),
  modalTeamPickerCode: document.getElementById("modalTeamPickerCode"),
  modalWeekRange: document.getElementById("modalWeekRange"),
  modalPlayerSearch: document.getElementById("modalPlayerSearch"),
  modalPlayerTable: document.getElementById("modalPlayerTable"),
  modalLowPtsToggle: document.getElementById("modalLowPtsToggle"),
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
  modalShowAllPlayers: false, // players modal: show <4pt rows (still excludes 0)
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

// Keep page header chip labels in sync with desktop/mobile layout changes.
{
  const onChange = () => syncSelectionChips(STATE.selectedTeam, STATE.pos);
  if (typeof PAGE_HEADER_DESKTOP_MQ?.addEventListener === "function"){
    PAGE_HEADER_DESKTOP_MQ.addEventListener("change", onChange);
  }else if (typeof PAGE_HEADER_DESKTOP_MQ?.addListener === "function"){
    PAGE_HEADER_DESKTOP_MQ.addListener(onChange);
  }
}

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

// Heatmap gradient: 8 colors from hardest (rank 1) to easiest (rank 32)
const HEAT_GRADIENT = [
  [255, 12, 163],    // #3A0CA3 - hardest (rank 1)
  [99, 0, 255],     // #6300FF
  [94, 96, 206],    // #5E60CE
  [81, 179, 255],   // #51B3FF
  [111, 222, 255],  // #6FDEFF
  [64, 255, 227],    // #00FF99 - easiest (rank 32)
];

// tough -> easy gradient using 8-color stops
function heatColor(score){
  const t = clamp(score, 0, 1);
  const numStops = HEAT_GRADIENT.length;
  const scaledT = t * (numStops - 1);
  const idx = Math.floor(scaledT);
  const localT = scaledT - idx;
  
  if (idx >= numStops - 1) return lerpRGB(HEAT_GRADIENT[numStops - 1], HEAT_GRADIENT[numStops - 1], 0);
  return lerpRGB(HEAT_GRADIENT[idx], HEAT_GRADIENT[idx + 1], localT);
}

// (Heatmap uses `heatColor()` directly for the cell gradients.)

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

function isModalTeamPickerOpen(){
  return !!els.modalTeamPicker?.classList?.contains("is-open");
}

function setModalTeamPickerOpen(open){
  if (!els.modalTeamPicker) return;
  els.modalTeamPicker.classList.toggle("is-open", !!open);
  if (els.modalTeamPickerBtn) els.modalTeamPickerBtn.setAttribute("aria-expanded", String(!!open));
}

function isPlayersModalOpen(){
  return !!els.playersModal?.classList?.contains("is-open");
}

function setPlayersModalOpen(open){
  if (!els.playersModal) return;
  const next = !!open;
  els.playersModal.classList.toggle("is-open", next);
  els.playersModal.setAttribute("aria-hidden", String(!next));
  document.documentElement.style.overflow = next ? "hidden" : "";
  document.body.style.overflow = next ? "hidden" : "";
  if (!next) setModalTeamPickerOpen(false);
}

function setLogoEl(imgEl, team){
  if (!imgEl) return;
  const t = cleanStr(team).toUpperCase();
  if (t){
    imgEl.src = teamLogoSrc(t);
    imgEl.alt = t;
    imgEl.style.opacity = "1";
  }else{
    imgEl.removeAttribute("src");
    imgEl.alt = "";
    imgEl.style.opacity = "0";
  }
}

function setLogoPair(imgEl, glowEl, team){
  setLogoEl(imgEl, team);
  setLogoEl(glowEl, team);
}

function syncTeamPicker(team){
  const t = cleanStr(team).toUpperCase();

  if (els.teamPickerCode) els.teamPickerCode.textContent = t || "—";
  setLogoPair(els.teamPickerLogo, els.teamPickerLogoGlow, t);

  if (els.teamPickerPanel){
    $$("button.teamOption", els.teamPickerPanel).forEach(btn => {
      const on = btn.dataset.team === t;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-selected", String(on));
    });
  }

  if (els.modalTeamPickerCode) els.modalTeamPickerCode.textContent = t || "—";
  setLogoPair(els.modalTeamPickerLogo, els.modalTeamPickerLogoGlow, t);
  if (els.modalTeamPickerPanel){
    $$("button.teamOption", els.modalTeamPickerPanel).forEach(btn => {
      const on = btn.dataset.team === t;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-selected", String(on));
    });
  }
}

function syncSelectionChips(team, pos){
  const t = cleanStr(team).toUpperCase();
  const p = cleanStr(pos).toUpperCase();
  const isDesktop = !!PAGE_HEADER_DESKTOP_MQ?.matches;

  setLogoPair(els.selTeamLogo, els.selTeamLogoGlow, t);

  if (els.selTeamText){
    const canon = t ? canonicalTeamCode(t) : "";
    const fullTeam = canon ? (TEAM_FULL_NAMES[canon] ?? TEAM_FULL_NAMES[t] ?? canon) : "—";
    els.selTeamText.textContent = isDesktop ? fullTeam : (t || "—");
    const c = teamColorText(t);
    if (c){
      els.selTeamText.style.color = c;
    }else{
      els.selTeamText.style.color = "rgba(255,255,255,0.86)";
    }
    els.selTeamText.style.textShadow = "none";
  }

  if (els.selPosText){
    const fullPos = p ? (POS_FULL_NAMES[p] ?? p) : "—";
    els.selPosText.textContent = isDesktop ? fullPos : (p || "—");
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

  setLogoPair(els.playerWeekTitleLogo, els.playerWeekTitleLogoGlow, t);
}

function getWeekRangeSpan(mode){
  const m = cleanStr(mode);
  if (m === "1-8") return { from: 1, to: 8 };
  if (m === "9-12") return { from: 9, to: 12 };
  if (m === "13-15") return { from: 13, to: 15 };
  if (m === "recent") return { from: 9, to: 15 };
  return { from: 1, to: CONFIG.maxWeek };
}

function calcRankFromPlayersTotals(team, pos, { from, to }){
  const t = cleanStr(team).toUpperCase();
  const p = cleanStr(pos).toUpperCase();
  if (!t || !CONFIG.positions.includes(p)) return { rk: NaN, avg: NaN };

  const teams = [...(DATA.byTeamSeason?.keys?.() ?? [])];
  if (!teams.length || !DATA.playersWeeklyTotals) return { rk: NaN, avg: NaN };

  const rows = [];
  for (const tm of teams){
    const key = `${tm}|${p}`;
    const arr = DATA.playersWeeklyTotals.get(key) ?? [];
    let sum = 0;
    let n = 0;
    for (const w of arr){
      const wk = Number(w.week);
      const val = Number(w.total);
      if (!Number.isFinite(wk) || !Number.isFinite(val)) continue;
      if (wk < from || wk > to) continue;
      sum += val;
      n += 1;
    }
    if (n > 0){
      rows.push({ team: tm, avg: sum / n });
    }
  }

  rows.sort((a, b) => a.avg - b.avg); // low avg = toughest
  const idx = rows.findIndex(r => r.team === t);
  if (idx < 0) return { rk: NaN, avg: NaN };
  return { rk: idx + 1, avg: rows[idx].avg };
}

function syncModalLowPtsToggle(){
  if (!els.modalLowPtsToggle) return;
  const on = !!STATE.modalShowAllPlayers;
  els.modalLowPtsToggle.classList.toggle("is-on", on);
  els.modalLowPtsToggle.setAttribute("aria-pressed", String(on));
}

function renderModalRankCard(team, pos){
  if (!els.modalRankCard) return;
  if (!team || !pos){
    els.modalRankCard.innerHTML = "";
    return;
  }

  const t = cleanStr(team).toUpperCase();
  const p = cleanStr(pos).toUpperCase();
  const mode = cleanStr(els.modalWeekRange?.value || els.weekRange?.value || "all");
  const label = cleanStr(els.modalWeekRange?.selectedOptions?.[0]?.textContent) || "Rank";

  let rk = NaN;
  if (mode === "all" || mode === "recent"){
    const ds = mode === "recent" ? "recent" : "season";
    rk = getMetric(t, ds, `${p}_Rk`);
  }else{
    const span = getWeekRangeSpan(mode);
    const out = calcRankFromPlayersTotals(t, p, span);
    rk = out.rk;
  }

  const rkHtml = Number.isFinite(rk) ? ordinalMarkup(rk) : "—";

  // Keep it compact (mobile-first). Label indicates the selected time range.
  els.modalRankCard.innerHTML = `
    <div class="modalRankCard__label">${label}</div>
    <div class="modalRankCard__value">${rkHtml} <span class="cardVs">vs. <span class="posText" data-pos="${p}">${p}</span></span></div>
  `;
}

function applyHeatHighlights(){
  // Heatmap is intentionally non-interactive (cells are not selectable/focusable).
  return;
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

function detectMaxWeekFromPlayersWide(rows){
  const sample = rows?.[0];
  if (!sample || typeof sample !== "object") return NaN;
  let mx = 0;
  for (const k of Object.keys(sample)){
    const m = String(k).match(/^(\d+)_(?:NM|TM|P)$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n)) mx = Math.max(mx, n);
  }
  return mx > 0 ? mx : NaN;
}

function syncWeekConfigFromData(){
  const detected = detectMaxWeekFromPlayersWide(DATA.playersWide);
  if (Number.isFinite(detected) && detected >= 1){
    CONFIG.maxWeek = detected;
  }

  const span = Number.isFinite(CONFIG.recentSpanWeeks) ? CONFIG.recentSpanWeeks : 7;
  const to = Number.isFinite(CONFIG.maxWeek) ? CONFIG.maxWeek : 15;
  const from = Math.max(1, to - span + 1);
  CONFIG.recentWeeks = [from, to];
}

function formatWeekSpan(from, to){
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "Recent";
  return `Weeks ${a}\u2013${b}`;
}

function syncWeekUI(){
  const [recentFrom, recentTo] = CONFIG.recentWeeks ?? [];
  const recentLabel = formatWeekSpan(recentFrom, recentTo);

  if (els.btnRecent) els.btnRecent.textContent = recentLabel;

  const scatterRest = document.querySelector(".scatterTitleRest");
  if (scatterRest) scatterRest.textContent = `\u2014 Season vs ${recentLabel}`;

  const syncSelect = (sel) => {
    if (!sel) return;

    const optRecent = [...sel.options].find(o => o.value === "recent");
    if (optRecent) optRecent.textContent = recentLabel;

    // Keep the late-season bucket automatically extended as new weeks are added.
    const lateFrom = 13;
    const lateTo = CONFIG.maxWeek;
    const lateOpt = [...sel.options].find(o => o.value === "13-15" || String(o.value).startsWith("13-"));
    if (lateOpt){
      lateOpt.value = `${lateFrom}-${lateTo}`;
      lateOpt.textContent = formatWeekSpan(lateFrom, lateTo);
      lateOpt.hidden = !Number.isFinite(lateTo) || lateTo < lateFrom;
    }
  };

  syncSelect(els.weekRange);
  syncSelect(els.modalWeekRange);
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

  // Extract just the filename from paths for matching
  const pathToFilename = (p) => p.split("/").pop();
  const playersFile = pathToFilename(CONFIG.paths.players);
  const seasonFile = pathToFilename(CONFIG.paths.season);
  const recentFile = pathToFilename(CONFIG.paths.recent);

  const needed = [playersFile, seasonFile, recentFile];
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
      readText(byName.get(playersFile)),
      readText(byName.get(seasonFile)),
      readText(byName.get(recentFile)),
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
  if (els.modalTeamPickerPanel) els.modalTeamPickerPanel.innerHTML = "";
  const teams = [...DATA.byTeamSeason.keys()].sort(); // actual codes (as in CSV)

  const actualByCanon = new Map(); // canon -> [actual]
  for (const t of teams){
    const canon = canonicalTeamCode(t);
    if (!canon) continue;
    if (!actualByCanon.has(canon)) actualByCanon.set(canon, []);
    actualByCanon.get(canon).push(t);
  }

  const pickActual = (canon) => {
    const arr = actualByCanon.get(canon) ?? [];
    return arr.find(x => x === canon) ?? arr[0] ?? null;
  };

  const addTeamBtn = (panel, team) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "teamOption";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");
    btn.dataset.team = team;
    btn.innerHTML = `
      ${teamLogoStackMarkup(team, { sizeClass: "teamLogo--opt" })}
      <span class="teamOption__code">${team}</span>
    `;
    panel.appendChild(btn);
  };

  const buildPanel = (panel) => {
    panel.innerHTML = "";

    const used = new Set();
    for (const div of NFL_DIVISIONS){
      const col = document.createElement("div");
      col.className = "teamPickerDiv";
      col.dataset.division = div.name;

      const title = document.createElement("div");
      title.className = "teamPickerDiv__title";
      title.setAttribute("aria-hidden", "true");

      const logo = document.createElement("img");
      logo.className = "teamPickerDiv__confLogo";
      logo.src = div.conf === "AFC" ? "assets/NFL-Tags_webp/afc.webp" : "assets/NFL-Tags_webp/nfc.webp";
      logo.alt = "";
      logo.loading = "eager";
      logo.decoding = "async";

      const divLabel = document.createElement("span");
      divLabel.className = "teamPickerDiv__titleText";
      divLabel.textContent = div.name.replace(/^AFC\s+/i, "").replace(/^NFC\s+/i, "");

      title.appendChild(logo);
      title.appendChild(divLabel);
      col.appendChild(title);

      for (const canon of div.teams){
        const actual = pickActual(canon);
        if (!actual || used.has(actual)) continue;
        used.add(actual);
        addTeamBtn(col, actual);
      }

      panel.appendChild(col);
    }

    // If any teams weren't matched (unexpected codes), append them at the end so they're still selectable.
    const leftovers = teams.filter(t => !used.has(t));
    for (const t of leftovers){
      addTeamBtn(panel, t);
    }
  };

  if (els.teamPickerPanel) buildPanel(els.teamPickerPanel);
  if (els.modalTeamPickerPanel) buildPanel(els.modalTeamPickerPanel);

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
          ? `ΔRk ${fmt(r.dRank,0)} • ΔAvg ${fmt(r.dAvg,1)}`
          : `Rk ${fmt(r.rk,0)} • Avg ${fmt(r.avg,1)}`;

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
      <div class="card__sub"><strong>${fmt(avg,1)}</strong> FPA • Games: <strong>${fmt(gm,0)}</strong> ${extra ?? ""}</div>
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
    card(formatWeekSpan(...CONFIG.recentWeeks), s.recentAvg, s.recentRank, gmR, ""),
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
          ? `ΔAvg: <strong>${dAvgTxt}</strong>`
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
    const active = (sortCycle === 0 && c === "TOTAL") || (sortCycle !== 0 && c === sortCol);
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
        const tmColor = teamColorText(t);
        const tmStyle = tmColor ? `style="color:${tmColor};"` : ``;
        const tmCell = t
          ? `<span class="teamInline teamInline--tight">${teamLogoStackMarkup(t, { sizeClass: "teamLogo--opt" })}<span class="teamText" ${tmStyle}>${t}</span></span>`
          : `<span class="teamText">—</span>`;
        const makeCell = (pos) => {
          const avg = toNum(r[`${pos}_Avg`]);
          const rk  = toNum(r[`${pos}_Rk`]);
          const sc = rankScore(rk);
          const c = heatColor(sc);
          const bg = `linear-gradient(135deg, ${rgbaOf(c,0.5)}, rgba(100,100,100,0.18), ${rgbaOf(c,0.5)})`;
          const textShadow = `1px 1px 1px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.6)`;

          const has = Number.isFinite(avg) && Number.isFinite(rk);
          const label = has
            ? `<span class="cell__rk" style="color:${c}; text-shadow:${textShadow};">${ordinalMarkup(rk)}</span><span class="cell__avg" style="color:${c}; text-shadow:${textShadow};">(${fmt(avg,1)})</span>`
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
        const totBg = `linear-gradient(135deg, ${rgbaOf(totC,0.35)}, rgba(100,100,100,0.018), ${rgbaOf(totC,0.35)})`;
        const totTextShadow = `1px 1px 1px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.6)`;

        const totHas = Number.isFinite(totAvg) && Number.isFinite(totRk);
        const totLabel = totHas
          ? `<span class="cell__rk" style="color:${totC}; text-shadow:${totTextShadow};">${ordinalMarkup(totRk)}</span><span class="cell__avg" style="color:${totC}; text-shadow:${totTextShadow};">(${fmt(totAvg,1)})</span>`
          : `<span class="cell__rk">—</span>`;

        return `
          <tr>
            <td class="tmCell">${tmCell}</td>
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

  const logo = t ? `
    <span class="teamLogoStack" aria-hidden="true">
      <img class="chartTooltip__logo glow teamLogoStack__glow" src="${teamLogoSrc(t)}" alt="${t}" />
      <img class="chartTooltip__logo teamLogoStack__img" src="${teamLogoSrc(t)}" alt="${t}" />
    </span>
  ` : "";
  tooltipEl.innerHTML = `
    <div class="chartTooltip__row">
      ${logo}
      <div>
        <div class="chartTooltip__title"><span class="teamText" ${teamStyle}>${t || "—"}</span></div>
        <div class="chartTooltip__meta">
          ${isAvg ? `Season: <strong>${seasonVal}</strong> • ${formatWeekSpan(...CONFIG.recentWeeks)}: <strong>${recentVal}</strong> • ΔAvg: <strong>${dAvg}</strong> • ΔRk: <strong>${dRank}</strong>`
            : `Season: <strong>${seasonVal}</strong> • ${formatWeekSpan(...CONFIG.recentWeeks)}: <strong>${recentVal}</strong> • ΔRk: <strong>${dRank}</strong> • ΔAvg: <strong>${dAvg}</strong>`}
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
    // Deprecated: replaced by in-chart avg pills.
    return;
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

// Render compact "avg pills" inside the Player Week Scatter plot area.
const PLAYER_WEEK_AVG_PILLS_PLUGIN = {
  id: "playerWeekAvgPills",
  afterDraw(chart, _, opts){
    const area = chart.chartArea;
    const yScale = chart.scales?.y;
    const xScale = chart.scales?.x;
    if (!area || !yScale || !xScale) return;

    const teamAvg = opts?.teamAvg;
    const leagueAvg = opts?.leagueAvg;
    const teamColor = opts?.teamColor ?? "rgba(0,191,255,0.90)";
    const leagueColor = opts?.leagueColor ?? "rgba(255,255,255,0.75)";

    const teamCode = cleanStr(opts?.team).toUpperCase();

    const entries = [
      { key: "tm", label: "AVG", value: teamAvg, color: teamColor, logo: teamCode },
      { key: "lg", label: "AVG", value: leagueAvg, color: leagueColor, glow: NFL_LOGO_GLOW, logo: "NFL" },
    ].filter(e => Number.isFinite(e.value));

    // Higher value should always appear higher on the chart.
    entries.sort((a, b) => b.value - a.value);
    if (!entries.length) return;

    const ctx = chart.ctx;
    const isMobile = SCATTER_MOBILE_MQ.matches;
    const fontFamily = Chart.defaults?.font?.family || getComputedStyle(document.body).fontFamily || "sans-serif";
    const fontSize = isMobile ? 9 : 10;
    const pillH = isMobile ? 14 : 16;
    const padX = isMobile ? 4 : 5;
    const gapX = 0;
    const textGap = isMobile ? 3 : 4;
    const logoS = isMobile ? 20 : 24;
    const groupH = Math.max(logoS, pillH);
    const r = 999;
    const valueDigits = 1;
    const ySep = isMobile ? 4 : 5;

    const roundRect = (x, y, w, h, rad) => {
      const rr = Math.min(rad, h / 2, w / 2);
      if (typeof ctx.roundRect === "function"){
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, rr);
        return;
      }
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    const withinY = (y) => Number.isFinite(y) && y >= area.top - 1 && y <= area.bottom + 1;

    ctx.save();
    ctx.translate(0.5, 0.5);
    const avgFont = `${fontSize}px ${fontFamily}`;
    const valueFont = `950 ${fontSize}px ${fontFamily}`;
    ctx.font = valueFont;
    ctx.textBaseline = "middle";

    const anchorX = clamp(xScale.getPixelForValue(1), area.left, area.right);
    const logoX = anchorX; // logo touches the Week 1 line
    // Keep the label "attached" to the logo like a datapoint callout.
    // A tiny overlap looks more intentional than a visible gap.
    const pillX = logoX + logoS + gapX - 1;
    const maxPillW = Math.max(40, area.right - pillX - 2);

    const measurePillTextW = (valueText) => {
      ctx.font = avgFont;
      const wA = ctx.measureText("AVG").width;
      ctx.font = valueFont;
      const wV = ctx.measureText(valueText).width;
      return wA + textGap + wV;
    };

    const mk = (e) => {
      const yDot = yScale.getPixelForValue(e.value);
      if (!withinY(yDot)) return null;

      const valueText = fmt(e.value, valueDigits);
      const textW = measurePillTextW(valueText);
      const pillW = Math.min(textW + padX * 2, maxPillW);

      const y = clamp(yDot, area.top + groupH / 2, area.bottom - groupH / 2);
      return { ...e, valueText, pillW, yDot, y };
    };

    // entries are sorted high->low; enforce "higher always higher" while avoiding overlap
    let hi = mk(entries[0]);
    let lo = mk(entries[1]);

    if (hi && lo){
      const topMin = area.top + groupH / 2;
      const botMax = area.bottom - groupH / 2;

      const overlap = (hi.y + groupH / 2 + ySep) - (lo.y - groupH / 2);
      if (overlap > 0){
        lo.y = Math.min(botMax, lo.y + overlap);
        const overlap2 = (hi.y + groupH / 2 + ySep) - (lo.y - groupH / 2);
        if (overlap2 > 0){
          hi.y = Math.max(topMin, hi.y - overlap2);
          // re-check: if still overlapping due to bounds, keep lo pinned below hi as best we can
          lo.y = Math.min(botMax, Math.max(lo.y, hi.y + groupH + ySep));
        }
      }

      // Guarantee correct ordering even after clamps.
      if (hi.y > lo.y){
        const mid = (hi.y + lo.y) / 2;
        hi.y = clamp(mid - (groupH / 2 + ySep / 2), topMin, botMax);
        lo.y = clamp(mid + (groupH / 2 + ySep / 2), topMin, botMax);
      }
    }

    const drawOne = (e) => {
      if (!e) return;
      const yC = e.y;

      const logo = e.logo ? getTeamLogo(e.logo) : null;
      if (logo){
        const isNFL = canonicalTeamCode(e.logo) === "NFL";

        // Only the NFL shield needs the extra-strong glow.
        if (isNFL){
          const glowBase = e.glow ?? NFL_LOGO_GLOW;

          ctx.shadowColor = rgbaOf(glowBase, isMobile ? 0.88 : 0.78);
          ctx.shadowBlur = isMobile ? 28 : 22;
          ctx.drawImage(logo, logoX, yC - logoS / 2, logoS, logoS);

          ctx.shadowColor = rgbaOf(glowBase, isMobile ? 0.99 : 0.93);
          ctx.shadowBlur = isMobile ? 16 : 12;
          ctx.drawImage(logo, logoX, yC - logoS / 2, logoS, logoS);
        }else{
          const spec = getTeamLogoGlowSpec(e.logo);
          const glowBase = spec?.glow ?? rgbaOf(e.color, 0.55);
          const baseBlur = Number(spec?.blur) || 3.2;
          const blurScale = (logoS / 17) * (isMobile ? 2.8 : 2.4);

          ctx.shadowColor = glowBase;
          ctx.shadowBlur = baseBlur * blurScale;
          ctx.drawImage(logo, logoX, yC - logoS / 2, logoS, logoS);
        }
        ctx.shadowBlur = 0;
      }

      const fill = rgbaOf(e.color, 0.14);
      const stroke = rgbaOf(e.color, 0.28);
      const pillY = yC - pillH / 2;

      ctx.shadowColor = rgbaOf(e.color, 0.35);
      ctx.shadowBlur = 10;
      ctx.fillStyle = fill;
      roundRect(pillX, pillY, e.pillW, pillH, r);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      roundRect(pillX, pillY, e.pillW, pillH, r);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.86)";
      let x = pillX + padX;
      ctx.font = avgFont;
      ctx.fillText("AVG", x, yC);
      x += ctx.measureText("AVG").width + textGap;
      ctx.font = valueFont;
      ctx.fillText(e.valueText ?? "—", x, yC);
    };

    // Draw the lower one first so the higher-value (upper) indicator stays visually on top if close.
    drawOne(lo);
    drawOne(hi);

    ctx.restore();
  }
};

// Draw per-team glow behind logo points in the Season vs Weeks scatter.
// We mimic CSS drop-shadow by drawing the same logo *behind* the chart point with a canvas shadow.
// Using destination-over avoids double-rendering the logo while keeping the glow visible outside the logo bounds.
const SCATTER_LOGO_GLOW_PLUGIN = {
  id: "scatterLogoGlow",
  afterDatasetDraw(chart, args){
    const datasetIndex = args?.index ?? args?.datasetIndex;
    if (datasetIndex !== 0) return;
    const area = chart.chartArea;
    if (!area) return;

    const meta = chart.getDatasetMeta(0);
    const elements = meta?.data ?? [];
    if (!elements.length) return;

    const ds = chart.data?.datasets?.[0] ?? {};
    const data = ds.data ?? [];

    const ctx = chart.ctx;
    const isMobile = SCATTER_MOBILE_MQ.matches;
    const basePx = 17; // glow tuning reference from the CSS sample
    const scale = clamp(SCATTER_TEAM_LOGO_PX / basePx, 0.9, 3.0);
    const boost = isMobile ? 2.05 : 1.35; // mobile needs a stronger glow to read at smaller sizes

    ctx.save();
    ctx.beginPath();
    // Let mobile glows bleed into the axis padding area so they remain visible.
    if (isMobile){
      ctx.rect(0, 0, chart.width, chart.height);
    }else{
      ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    }
    ctx.clip();
    ctx.globalCompositeOperation = "destination-over";

    for (let i = 0; i < elements.length; i++){
      const el = elements[i];
      if (!el) continue;
      const raw = data[i] ?? {};
      const t = cleanStr(raw.t).toUpperCase();
      const img = getTeamLogo(t);
      if (!img) continue;
      const spec = getTeamLogoGlowSpec(t);
      if (!spec?.glow) continue;

      const s = Number(img.width) || SCATTER_TEAM_LOGO_PX;
      const blur = (Number(spec.blur) || 3.0) * scale * boost;
      ctx.shadowColor = isMobile ? rgbaOf(spec.glow, 0.92) : spec.glow;
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.drawImage(img, el.x - (s / 2), el.y - (s / 2), s, s);
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
		          ticks: {
		            padding: isMobile ? 2 : 6,
		            maxTicksLimit: isMobile ? 6 : 10,
		            count: (isMobile && isAvg) ? 6 : undefined,
		            callback: (v) => {
		              const n = Number(v);
		              if (!Number.isFinite(n)) return v;
		              return isAvg ? fmt(n, 1) : fmt(n, 0);
		            },
		          },
		          min: xMin,
		          max: xMax,
		          grid: { color: "rgba(255,255,255,0.01)" },
		        },
		        y: {
		          title: {
		            display: true,
		            text: `${formatWeekSpan(...CONFIG.recentWeeks)} (${STATE.scatterMode === "avg" ? "Avg FPA" : "Rank"})`,
		            padding: isMobile ? { top: 0, bottom: 0 } : { top: 0, bottom: 0 },
		          },
		          ticks: {
		            padding: isMobile ? 2 : 6,
		            maxTicksLimit: isMobile ? 6 : 10,
		            count: (isMobile && isAvg) ? 6 : undefined,
		            callback: (v) => {
		              const n = Number(v);
		              if (!Number.isFinite(n)) return v;
		              return isAvg ? fmt(n, 1) : fmt(n, 0);
		            },
		          },
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
  const dotR = isMobile ? 7.5 : 9.0; // desktop-only: make dots bigger (mobile unchanged)
  const dotHoverR = isMobile ? 6.5 : 8.0;
  const trendLineColor = (() => {
    const p = cleanStr(STATE.playerWeekScatterPos).toUpperCase();
    const hex = CONFIG.positions.includes(p) ? (PLAYER_SCATTER_COLORS[p] ?? "#ffffff") : "#ffffff";
    const [r,g,b] = hexToRgbaArr(hex);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  })();

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
      order: 1,
      pointRadius: dotR,
      pointHoverRadius: dotHoverR,
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

  // Trend line across all visible points (all active positions for this team).
	  const trendDataset = (() => {
	    const pts = datasets
	      .flatMap(d => (Array.isArray(d.data) ? d.data : []))
	      .filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
	    if (pts.length < 2) return null;

    const n = pts.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (const p of pts){
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    }

    const denom = (n * sumXX) - (sumX * sumX);
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) return null;

    const slope = ((n * sumXY) - (sumX * sumY)) / denom;
    const intercept = (sumY - slope * sumX) / n;
    if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;

    const x1 = 1;
    const x2 = CONFIG.maxWeek;
    const y1 = slope * x1 + intercept;
    const y2 = slope * x2 + intercept;
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;

	    return {
	      type: "line",
	      label: "Trend",
	      data: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
	      borderColor: trendLineColor,
	      borderWidth: 2,
	      borderDash: [6, 5],
	      pointRadius: 0,
	      pointHitRadius: 0,
	      tension: 0,
      clip: false,
      order: 0,
    };
  })();

  const datasetsWithTrend = trendDataset ? [trendDataset, ...datasets] : datasets;

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
	    plugins: [PLAYER_WEEK_AVG_PILLS_PLUGIN],
	    data: { datasets: datasetsWithTrend },
			    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      parsing: false,
	      interaction: { mode: "nearest", intersect: true },
	      layout: { padding: isMobile ? { left: 8, right: 10, top: 7, bottom: 3 } : { left: 14, right: 14, top: 8, bottom: 6 } },
			      plugins: {
			        playerWeekAvgPills: { teamAvg, leagueAvg, teamColor: teamAvgColor, leagueColor: "rgba(255,255,255,0.75)", team },
			        legend: { display: false },
			        tooltip: {
	          filter: (item) => {
	            const r = item?.raw;
	            return !!(r && typeof r === "object" && "player" in r);
	          },
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
		          ticks: {
		            padding: isMobile ? 2 : 6,
		            stepSize: 1,
		            autoSkip: false,
		            maxRotation: 0,
		            minRotation: 0,
		            font: isMobile ? { size: 10 } : undefined,
		            callback: (v) => {
		              const n = Number(v);
		              if (!Number.isFinite(n)) return `W${v}`;
		              if (isMobile && (n % 2 === 0) && n !== 1 && n !== CONFIG.maxWeek) return "";
		              return `W${n}`;
		            }
		          },
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

function buildPlayerTable(team, pos, { weekRangeEl = els.weekRange, playerSearchEl = els.playerSearch, tableEl = els.playerTable, lowPointsMode = "none" } = {}){
  if (!weekRangeEl || !playerSearchEl || !tableEl) return;

  const search = cleanStr(playerSearchEl.value).toLowerCase();
  const mode = weekRangeEl.value;

  let rows = filterWeeks(getPlayerRows(team, pos), mode);

  // Modal-only: optionally hide low-point rows (still always hides 0-point games).
  const lp = cleanStr(lowPointsMode);
  if (lp === "exclude_lt4"){
    rows = rows.filter(r => Number.isFinite(r.pts) && r.pts >= 4);
  }else if (lp === "exclude_zero"){
    rows = rows.filter(r => Number.isFinite(r.pts) && r.pts > 0);
  }

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

	  tableEl.innerHTML = `
	    <thead>
	      <tr>
	        ${headers.map(h => `<th data-k="${h.k}">${h.label}${STATE.playerSort.key === h.k ? (STATE.playerSort.dir === "asc" ? " ▲" : " ▼") : ""}</th>`).join("")}
	      </tr>
	    </thead>
	    <tbody>
			      ${rows.map(r => {
			        const tm = r.playerTeam || "—";
			        const tmCode = cleanStr(tm).toUpperCase();
			        const tmCanon = canonicalTeamCode(tmCode);
			        const tmColor = teamColorText(tmCode);
			        const nameColor = TEAM_NAME_COLORS[tmCanon] ?? TEAM_NAME_COLORS[tmCode] ?? null;
			        const ptsColor = pointsColor(r.pos, r.pts);
			        const ptsStyle = `font-weight:850;${ptsColor ? `color:${ptsColor};` : ""}`;
			        const tmStyle = tmColor ? `style="color:${tmColor};"` : ``;
			        const tmCell = tmCode
			          ? `<span class="teamInline teamInline--tight">${teamLogoStackMarkup(tmCode, { sizeClass: "teamLogo--opt" })}<span class="teamText" ${tmStyle}>${tmCode}</span></span>`
			          : `<span class="teamText">—</span>`;
			        const playerCell = `<span class="playerName"${nameColor ? ` style="color:${nameColor};"` : ""}>${r.player}</span>`;
	        return `
	          <tr>
	            <td>W${r.week}</td>
	            <td>${playerCell}</td>
			            <td>${tmCell}</td>
			            <td style="${ptsStyle}">${fmt(r.pts,2)}</td>
	          </tr>
			        `;
		      }).join("")}
	    </tbody>
	  `;

  // bind sort headers
  $$("thead th", tableEl).forEach(th => {
    th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (STATE.playerSort.key === k){
        STATE.playerSort.dir = STATE.playerSort.dir === "asc" ? "desc" : "asc";
      }else{
        STATE.playerSort.key = k;
        STATE.playerSort.dir = (k === "pts" || k === "week") ? "desc" : "asc";
      }
      buildPlayersEverywhere(team, pos);
    });
  });
}

function buildPlayersSection(team, pos, { subEl = els.playersSub, weekRangeEl = els.weekRange, playerSearchEl = els.playerSearch, tableEl = els.playerTable, lowPointsMode = "none", showSuffix = true } = {}){
  if (!team || !pos){
    if (subEl) subEl.textContent = "Select a defense + position to populate.";
    if (tableEl) tableEl.innerHTML = "";
    return;
  }
	  const t = cleanStr(team).toUpperCase();
	  const c = teamColorText(t);
	  const style = c ? `style="color:${c};"` : "";
	  const teamTag = t
	    ? `<span class="teamInline teamInline--tight">${teamLogoStackMarkup(t, { sizeClass: "teamLogo--opt" })}<span class="teamText" ${style}>${t}</span></span>`
	    : "—";
  const parts = [
    teamTag,
    `<span class="playersSubSep playersSubVs">vs.</span>`,
    `<span class="posText" data-pos="${pos}">${pos}</span>`,
    showSuffix ? `<span class="playersSubSuffix"><span class="playersSubBullet">•</span><span class="playersSubSuffixText">FPA players by week</span></span>` : null,
  ].filter(Boolean);
  if (subEl) subEl.innerHTML = parts.join("");
  buildPlayerTable(team, pos, { weekRangeEl, playerSearchEl, tableEl, lowPointsMode });
}

function buildPlayersEverywhere(team, pos){
  buildPlayersSection(team, pos, { subEl: els.playersSub, weekRangeEl: els.weekRange, playerSearchEl: els.playerSearch, tableEl: els.playerTable });

  if (isPlayersModalOpen()){
    if (els.modalWeekRange && els.weekRange) els.modalWeekRange.value = els.weekRange.value;
    if (els.modalPlayerSearch && els.playerSearch) els.modalPlayerSearch.value = els.playerSearch.value;
    const lowPointsMode = STATE.modalShowAllPlayers ? "exclude_zero" : "exclude_lt4";
    buildPlayersSection(team, pos, { subEl: els.playersModalSub, weekRangeEl: els.modalWeekRange, playerSearchEl: els.modalPlayerSearch, tableEl: els.modalPlayerTable, lowPointsMode, showSuffix: false });
    syncModalLowPtsToggle();
    renderModalRankCard(team, pos);
  }
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
  buildPlayersEverywhere(team, STATE.pos);

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
  els.weekRange.addEventListener("change", () => buildPlayersEverywhere(STATE.selectedTeam, STATE.pos));
  els.playerSearch.addEventListener("input", () => buildPlayersEverywhere(STATE.selectedTeam, STATE.pos));

  // players modal (expand)
  if (els.playersExpandBtn && els.playersModal){
    const open = () => {
      STATE.modalShowAllPlayers = false;
      syncModalLowPtsToggle();
      if (els.modalWeekRange && els.weekRange) els.modalWeekRange.value = els.weekRange.value;
      if (els.modalPlayerSearch && els.playerSearch) els.modalPlayerSearch.value = els.playerSearch.value;
      setPlayersModalOpen(true);
      buildPlayersEverywhere(STATE.selectedTeam, STATE.pos);
    };
    const close = () => setPlayersModalOpen(false);

    els.playersExpandBtn.addEventListener("click", open);
    if (els.playersModalClose) els.playersModalClose.addEventListener("click", close);
    els.playersModal.addEventListener("click", (e) => {
      const target = e.target;
      if (target?.closest?.("[data-close]")) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!isPlayersModalOpen()) return;
      if (isModalTeamPickerOpen()){
        setModalTeamPickerOpen(false);
        return;
      }
      close();
    });
  }

  if (els.modalWeekRange){
    els.modalWeekRange.addEventListener("change", () => {
      if (els.weekRange) els.weekRange.value = els.modalWeekRange.value;
      buildPlayersEverywhere(STATE.selectedTeam, STATE.pos);
    });
  }
  if (els.modalPlayerSearch){
    els.modalPlayerSearch.addEventListener("input", () => {
      if (els.playerSearch) els.playerSearch.value = els.modalPlayerSearch.value;
      buildPlayersEverywhere(STATE.selectedTeam, STATE.pos);
    });
  }

  if (els.modalLowPtsToggle){
    els.modalLowPtsToggle.addEventListener("click", () => {
      STATE.modalShowAllPlayers = !STATE.modalShowAllPlayers;
      syncModalLowPtsToggle();
      buildPlayersEverywhere(STATE.selectedTeam, STATE.pos);
    });
  }

  // modal opponent defense picker (custom dropdown)
  if (els.modalTeamPickerBtn && els.modalTeamPickerPanel){
    const close = () => setModalTeamPickerOpen(false);

    els.modalTeamPickerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setModalTeamPickerOpen(!isModalTeamPickerOpen());
    });

    els.modalTeamPickerPanel.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button.teamOption");
      const team = btn?.dataset?.team;
      if (!team) return;
      close();
      selectTeam(team, STATE.pos);
    });

    document.addEventListener("click", (e) => {
      if (!isModalTeamPickerOpen()) return;
      const inside = els.modalTeamPicker?.contains(e.target);
      if (!inside) close();
    });
  }

  // file upload
  els.fileInput.addEventListener("change", (e) => {
    const files = [...(e.target.files ?? [])];
    if (!files.length) return;
    handleFileUpload(files);
  });
}

async function bootstrap(){
  chartCommon();
  syncWeekConfigFromData();
  syncWeekUI();
  buildMaps();
  buildPlayersLong();
  await loadTeamLogos([...DATA.byTeamSeason.keys(), "NFL"]);
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
