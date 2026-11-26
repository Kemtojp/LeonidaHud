/* ==========================================================================
   store.js — Estado Global, IndexedDB + localStorage, CSV y Respaldo JSON
   ========================================================================== */

export const STORAGE_KEY = 'leonida_v1';
const DB_NAME = 'LeonidaHUD_DB';
const DB_STORE = 'state';

export const DEFAULT_ROUTINES = {
  PUSH: ['Fondos', 'Press Hombro', 'Flexiones', 'Lateral Raises', 'Extender Tricep'],
  PULL: ['Dominadas', 'Anillo Row Estrecho', 'Jalon A La Cara', 'Curl Bicep', 'Ab Roller'],
  LEGS: ['Squat', 'Peso muerto Rumano', 'Zancadas', 'Elevación De Talones', 'Ab Crunch'],
  UPPER: ['Dominadas', 'Fondos', 'Anillo Row Estrecho', 'Incline Press', 'Lateral Raises']
};

export const BANDS = ['Verde', 'Morado', 'Negro', 'Rojo', 'Amarillo'];
export const BAND_COLORS = {
  Verde: '#5fd38a',
  Morado: '#a77bf0',
  Negro: '#aab3c2',
  Rojo: '#ff6b6b',
  Amarillo: '#ffd86b'
};

export const state = {
  str: [],
  car: [],
  wt: [],
  water: {},
  sleep: {},
  chk: {},
  prof: { h: 0, goal: 0 },
  rest: 90,
  rt: 'PUSH',
  pex: '',
  nut: { mode: 'def', goal: 170, prot: {}, closed: {} },
  goals: { car: 50, wat: 3200, sleep: 8 },
  carBtns: [
    { m: 15, x: 'Bicicleta', n: 'Bici N1', l: '+15 Bici' },
    { m: 20, x: 'Bicicleta', n: 'Bici post-comida', l: '+20 Bici' },
    { m: 20, x: 'Boxeo', n: '', l: '+20 Boxeo' }
  ],
  watBtns: [250, 500, -250],
  rts: { ...DEFAULT_ROUTINES },
  custom: []
};

// Carga síncrona inicial desde localStorage para primer render sin parpadeo
try {
  const cached = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (cached) Object.assign(state, cached);
} catch (e) {}

if (!state.rts || typeof state.rts !== 'object') state.rts = { ...DEFAULT_ROUTINES };
state.nut = { mode: 'def', goal: 170, prot: {}, closed: {}, ...state.nut };
state.goals = { car: 50, wat: 3200, sleep: 8, ...state.goals };

// Estado efímero de navegación y UI (no persistido)
export const uiState = {
  tab: 'hud',
  view: null,      // 'car' | 'foc' | 'body' | 'nutri' | 'prof'
  openRoutine: null,
  editRoutine: false,
  exercise: null,  // { ex, sub, b, w, r, gm, gr }
  editing: null,   // { k: 'set'|'car'|'wt', i }
  confirmDel: null,
  newExOpen: false,
  bioMetric: 'w',
  calOffset: 0,
  selectedDay: null,
  carPanel: null,
  watPanel: null,
  sumDay: null     // fecha (m/d/yy) del Resumen abierto; null = última sesión
};

/* ---------- Utilidades de fecha, texto y formato ---------- */
export const two = (n) => String(n).padStart(2, '0');
export const dstr = (d = new Date()) => `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
export const tstr = (d = new Date()) => `${two(d.getHours())}:${two(d.getMinutes())}`;
export const parseDate = (s) => {
  const [m, d, y] = s.split('/').map(Number);
  return new Date(2000 + y, m - 1, d).getTime();
};
export const hmsToSec = (s) => String(s || '0').split(':').reduce((a, v) => a * 60 + (+v || 0), 0);
export const secToHms = (s) => `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nn0 = (v, fn = parseFloat) => Math.max(0, fn(v) || 0);

/* ---------- Helpers de bandas y bioimpedancia ---------- */
export const bandOf = (n) => {
  const m = /\[Banda: (\w+)\]/.exec(n || '');
  return m && BANDS.includes(m[1]) ? m[1] : '';
};
export const cleanNotes = (n) => (n || '').replace(/\s*\[Banda: \w+\]/g, '').trim();
export const withBand = (n, b) => [cleanNotes(n), b ? `[Banda: ${b}]` : ''].filter(Boolean).join(' ');
export const formatLoad = (s) => {
  const b = bandOf(s.n);
  return b ? `Banda ${b}` : s.w > 0 ? `${s.w} kg` : 'PC';
};
export const formatSet = (s) => `${formatLoad(s)} × ${s.r}`;
export const loadRank = (s) => (s.w > 0 ? 1e3 + s.w : bandOf(s.n) ? 5 - BANDS.indexOf(bandOf(s.n)) : 0);

export const parseBio = (n) => {
  const m = /\[([^\]]*(?:BF|MM)[^\]]*)\]/.exec(n || '');
  if (!m) return {};
  const b = /BF: ?([\d.]+)/.exec(m[1]);
  const u = /MM: ?([\d.]+)/.exec(m[1]);
  return { bf: b ? +b[1] : null, mm: u ? +u[1] : null };
};
export const cleanWeightNotes = (n) => (n || '').replace(/\s*\[[^\]]*(?:BF|MM)[^\]]*\]/g, '').trim();
export const withBio = (n, bf, mm) => {
  const tags = [bf > 0 ? `BF: ${(+bf).toFixed(1)}%` : '', mm > 0 ? `MM: ${(+mm).toFixed(1)}kg` : '']
    .filter(Boolean)
    .join(' | ');
  return [cleanWeightNotes(n), tags ? `[${tags}]` : ''].filter(Boolean).join(' ');
};

/* ---------- IndexedDB + localStorage ---------- */
let idb = null;

function openIDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) {
        req.result.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function saveIDB() {
  if (!idb) return;
  try {
    const tx = idb.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(JSON.parse(JSON.stringify(state)), STORAGE_KEY);
  } catch (e) {}
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
  saveIDB();
}

export async function initDB(onReady) {
  idb = await openIDB();
  if (!idb) return;
  try {
    const tx = idb.transaction(DB_STORE, 'readonly');
    const getReq = tx.objectStore(DB_STORE).get(STORAGE_KEY);
    getReq.onsuccess = () => {
      const saved = getReq.result;
      if (saved && typeof saved === 'object') {
        Object.assign(state, saved);
        if (!state.rts) state.rts = { ...DEFAULT_ROUTINES };
        state.nut = { mode: 'def', goal: 170, prot: {}, closed: {}, ...state.nut };
        if (typeof onReady === 'function') onReady();
      } else {
        saveIDB();
      }
    };
  } catch (e) {}
}

/* ---------- Importación y Exportación CSV / JSON ---------- */
export function parseCSV(txt) {
  const rows = [];
  let r = [], f = '', q = false;
  txt = txt.replace(/^\uFEFF/, '');
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') {
        if (txt[i + 1] === '"') { f += '"'; i++; }
        else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && txt[i + 1] === '\n') i++;
      r.push(f); rows.push(r); r = []; f = '';
    } else f += c;
  }
  if (f !== '' || r.length) { r.push(f); rows.push(r); }

  const out = { str: [], car: [], wt: [] };
  let sec = '';
  const nz = (v) => (v == null || v === 'null' ? '' : v);

  for (const row of rows) {
    const h = row.length === 1 && /^-----(.+)-----$/.exec(row[0].trim());
    if (h) { sec = h[1].toLowerCase(); continue; }
    if (row[0] === 'Date' || row.length < 3) continue;
    if (sec === 'strength') out.str.push({ d: row[0], t: row[1], ex: row[2], r: +row[3] || 0, w: +row[4] || 0, n: row[5] || '' });
    else if (sec === 'cardio') out.car.push({ d: row[0], t: row[1], ex: row[2], dur: hmsToSec(row[3]), dist: nz(row[4]), hr: nz(row[5]), cal: nz(row[6]), n: row[7] || '' });
    else if (sec === 'weight') out.wt.push({ d: row[0], t: row[1], w: +row[2] || 0, n: row[3] || '' });
  }
  return out;
}

const qt = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function toCSV() {
  const sPart = '-----Strength-----\nDate,Time,Exercise,# of Reps,Weight,Notes\n' +
    state.str.map((s) => [s.d, s.t, s.ex, s.r, s.w, s.n].map(qt).join(',')).join('\n');
  const cPart = '\n\n-----Cardio-----\nDate,Time,Exercise,Duration,Distance,Heart Rate,Calories,Notes\n' +
    state.car.map((c) => [c.d, c.t, c.ex, secToHms(c.dur), c.dist || 'null', c.hr || 'null', c.cal || 'null', c.n].map(qt).join(',')).join('\n');
  const wPart = '\n\n-----Weight-----\nDate,Time,Weight,Notes\n' +
    state.wt.map((w) => [w.d, w.t, w.w, w.n].map(qt).join(',')).join('\n') + '\n';
  return sPart + cPart + wPart;
}

const sortKey = (x) => parseDate(x.d) + hmsToSec(x.t + ':0') * 1000;

export function mergeRecords(existing, incoming, keyFn) {
  const countA = {}, countB = {}, merged = [...existing];
  existing.forEach((x) => { const k = keyFn(x); countA[k] = (countA[k] || 0) + 1; });
  incoming.forEach((x) => {
    const k = keyFn(x);
    countB[k] = (countB[k] || 0) + 1;
    if (countB[k] > (countA[k] || 0)) merged.push(x);
  });
  return merged.sort((x, y) => sortKey(y) - sortKey(x));
}

// Correlativo de orden real de ejecución (`o`): se guarda en cada serie y viaja en JSON/nube
let lastOrder = 0;
export function nextOrder() {
  lastOrder = Math.max(Date.now(), lastOrder + 1);
  return lastOrder;
}

export function exportFullJSON() {
  return JSON.stringify({
    app: 'leonida-hud',
    v: 2,
    exported: new Date().toISOString(),
    str: state.str,
    car: state.car,
    wt: state.wt,
    water: state.water,
    sleep: state.sleep,
    chk: state.chk,
    rts: state.rts,
    rt: state.rt,
    custom: state.custom || [],
    prof: state.prof,
    goals: state.goals,
    carBtns: state.carBtns,
    watBtns: state.watBtns,
    nut: state.nut,
    rest: state.rest
  }, null, 2);
}

export function downloadFile(data = toCSV(), filename = 'workoutlog.csv', type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = filename;
  a.click();
}

/* ==========================================================================
   Nube (Supabase) — respaldo manual, sin auto-sync
   ========================================================================== */

// ⚠️ Reemplaza con los datos de tu proyecto (Supabase → Project Settings → API)
const SUPABASE_URL = 'https://zfewjvctfvqjpmfcxorl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bSZI5SKOUSH0sU3-Klde5g_ZOAkiMTv';

export const cloud = { user: null, busy: false };
export let isPasswordRecovery = false; // true al abrir el enlace de recuperación del correo
let sbClient = null;

// Import dinámico: si no hay red o esm.sh falla, la app local sigue funcionando
async function getClient() {
  if (sbClient) return sbClient;
  if (SUPABASE_URL.includes('TU-PROYECTO') || SUPABASE_ANON_KEY.includes('TU_SUPABASE')) {
    throw new Error('Configura SUPABASE_URL y SUPABASE_ANON_KEY en store.js');
  }
  // Respaldo: el evento PASSWORD_RECOVERY puede dispararse antes de suscribirnos; el hash del enlace lo delata
  if (/type=recovery/.test(window.location.hash)) isPasswordRecovery = true;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return sbClient;
}

export async function initCloudAuth(onChange) {
  try {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    cloud.user = data.session ? data.session.user : null;
    sb.auth.onAuthStateChange((evt, session) => {
      if (evt === 'PASSWORD_RECOVERY') isPasswordRecovery = true;
      cloud.user = session ? session.user : null;
      if (typeof onChange === 'function') onChange();
    });
    if (typeof onChange === 'function') onChange();
  } catch (e) {}
}

// Devuelve { needsConfirm } — true si Supabase exige confirmar el correo antes de entrar
export async function cloudSignUp(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) throw error;
  cloud.user = data.session ? data.session.user : null;
  return { needsConfirm: !data.session };
}

export async function cloudSignIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  cloud.user = data.user;
  return data.user;
}

export async function cloudSignOut() {
  const sb = await getClient();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
  cloud.user = null;
}

export async function cloudResetPassword(email) {
  const sb = await getClient();
  const { data, error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) throw error;
  return data;
}

export async function cloudUpdatePassword(newPassword) {
  const sb = await getClient();
  const { data, error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
  isPasswordRecovery = false;
  return data;
}

// Requiere la función SQL delete_own_account() (security definer). Los datos locales no se tocan.
export async function cloudDeleteAccount() {
  const sb = await getClient();
  if (!cloud.user) throw new Error('Inicia sesión primero');
  const { error } = await sb.rpc('delete_own_account');
  if (error) throw error;
  try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
  cloud.user = null;
}

export async function pushToCloud() {
  const sb = await getClient();
  if (!cloud.user) throw new Error('Inicia sesión primero');
  const { error } = await sb.from('user_backups').upsert(
    { user_id: cloud.user.id, payload: JSON.parse(exportFullJSON()), updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
  return { str: state.str.length, car: state.car.length, wt: state.wt.length };
}

// Misma fusión que la restauración JSON local (CHANGES.backup en main.js)
export async function pullFromCloud() {
  const sb = await getClient();
  if (!cloud.user) throw new Error('Inicia sesión primero');
  const { data, error } = await sb.from('user_backups').select('payload').eq('user_id', cloud.user.id).maybeSingle();
  if (error) throw error;
  const b = data && data.payload;
  if (!b) throw new Error('Aún no hay respaldo en la nube');
  if (b.app !== 'leonida-hud') throw new Error('El respaldo en la nube no es de Leonida');

  state.str = mergeRecords(state.str, b.str || [], (s) => [s.d, s.t, s.ex, s.r, s.w, bandOf(s.n)].join('|'));
  state.car = mergeRecords(state.car, b.car || [], (c) => [c.d, c.t, c.ex, c.dur].join('|'));
  state.wt = mergeRecords(state.wt, b.wt || [], (w) => [w.d, w.t, w.w].join('|'));
  ['water', 'sleep', 'chk'].forEach((k) => { state[k] = { ...state[k], ...(b[k] || {}) }; });
  if (b.rts) state.rts = b.rts;
  if (b.prof) state.prof = b.prof;
  if (b.goals) state.goals = { ...state.goals, ...b.goals };
  if (b.custom) state.custom = [...new Set([...(state.custom || []), ...b.custom])];
  if (b.rest) state.rest = b.rest;
  if (Array.isArray(b.carBtns)) state.carBtns = b.carBtns.filter((c) => c && c.m > 0 && c.x).map((c) => ({ m: +c.m, x: String(c.x), n: String(c.n || ''), l: String(c.l || `+${c.m} ${c.x}`) }));
  if (Array.isArray(b.watBtns)) state.watBtns = b.watBtns.map(Number).filter((v) => v && isFinite(v));
  if (b.rt && state.rts[b.rt]) state.rt = b.rt;
  if (b.nut) state.nut = { ...state.nut, ...b.nut, prot: { ...state.nut.prot, ...(b.nut.prot || {}) }, closed: { ...state.nut.closed, ...(b.nut.closed || {}) } };
  save();
  return { str: (b.str || []).length, car: (b.car || []).length, wt: (b.wt || []).length };
}
