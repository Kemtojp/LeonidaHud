/* ==========================================================================
   main.js — Router, Historial Android y Dispatch Tables (Sin cadenas de ifs)
   ========================================================================== */

import {
  state, uiState, dstr, tstr, nn0, bandOf, withBand, withBio, nextOrder,
  save, initDB, parseCSV, toCSV, mergeRecords, exportFullJSON, downloadFile,
  cloud, initCloudAuth, cloudSignUp, cloudSignIn, cloudSignOut, cloudDeleteAccount, pushToCloud, pullFromCloud,
  cloudResetPassword, cloudUpdatePassword, isPasswordRecovery
} from './store.js';
import { getDailyProgress, levelOf, lastSessionDate, sessionSummary, summaryText } from './domain.js';
import {
  $, PR, setGlow, consumeGlow, vib, beep, toast,
  startRest, adjustRest, stopRest, patch, copyText
} from './ui.js';
import { renderHudView } from './views/hud.js';
import { renderTrainView, renderExercisesView, renderExerciseDetailView } from './views/train.js';
import { renderCardioView, renderFocusView } from './views/wellness.js';
import { renderBodyView, renderNutriView, renderProfileView, renderMoreView, renderBackupView, renderSummaryView } from './views/profile.js';

let prevProgress = null;
let lastViewKey = '';
let delTimer = null;
let exitTimestamp = 0;

/* ---------- Navegación y Botón Atrás de Android ---------- */
function pushNav() {
  try { history.pushState({ leonida: 1 }, ''); } catch (e) {}
}

window.addEventListener('popstate', () => {
  if (uiState.newExOpen || uiState.carPanel || uiState.watPanel) {
    uiState.newExOpen = false;
    uiState.carPanel = null;
    uiState.watPanel = null;
    pushNav();
    render();
    return;
  }
  if (uiState.exercise) { uiState.exercise = null; pushNav(); render(); window.scrollTo(0, 0); return; }
  if (uiState.view) { uiState.view = null; pushNav(); render(); window.scrollTo(0, 0); return; }
  if (uiState.openRoutine) { uiState.openRoutine = null; uiState.editRoutine = false; pushNav(); render(); window.scrollTo(0, 0); return; }
  if (uiState.tab !== 'hud') { uiState.tab = 'hud'; pushNav(); render(); window.scrollTo(0, 0); return; }

  const now = Date.now();
  if (now - exitTimestamp < 2000) {
    history.back();
    return;
  }
  exitTimestamp = now;
  pushNav();
  toast('PRESIONA ATRÁS OTRA VEZ', 'Para salir de Leonida HUD', 'var(--am)');
});

try {
  history.replaceState({ leonida: 0 }, '');
  history.pushState({ leonida: 1 }, '');
} catch (e) {}

/* ---------- Render Principal ---------- */
const TABS = [['hud', 'Inicio'], ['exer', 'Ejercicios'], ['data', 'Más']];
const VIEW_RENDERERS = {
  car: renderCardioView,
  foc: renderFocusView,
  body: renderBodyView,
  nutri: renderNutriView,
  prof: renderProfileView,
  backup: renderBackupView,
  summary: renderSummaryView
};
const TAB_RENDERERS = {
  hud: renderHudView,
  train: renderTrainView,
  exer: renderExercisesView,
  data: renderMoreView
};

export function render() {
  const hideNav = !!(uiState.exercise || uiState.view || uiState.tab === 'train');
  const isCompact = !!(uiState.exercise || uiState.view === 'car');
  const nav = $('#nav');
  const app = $('#app');

  nav.style.display = hideNav ? 'none' : 'flex';
  app.style.paddingBottom = hideNav ? (uiState.exercise ? '84px' : '24px') : '';
  app.classList.toggle('compact', isCompact);

  patch(
    nav,
    TABS.map(([k, l]) => `<button class="${uiState.tab === k || (uiState.tab === 'train' && k === 'hud') ? 'cur' : ''}" data-a="tab" data-v="${k}">${l}</button>`).join('')
  );

  const html = uiState.exercise
    ? renderExerciseDetailView()
    : uiState.view
    ? VIEW_RENDERERS[uiState.view]()
    : TAB_RENDERERS[uiState.tab]();

  const viewKey = uiState.exercise
    ? `x${uiState.exercise.ex}${uiState.exercise.sub}`
    : uiState.view || `${uiState.tab}${uiState.openRoutine || ''}${uiState.editRoutine}`;

  if (viewKey !== lastViewKey) {
    lastViewKey = viewKey;
    app.innerHTML = html;
    app.classList.remove('enter');
    void app.offsetWidth;
    app.classList.add('enter');
  } else {
    patch(app, html);
  }

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.querySelectorAll('.arc').forEach((a) => {
        a.style.strokeDashoffset = a.dataset.o;
        PR[a.dataset.k] = +a.dataset.p;
      });
      document.querySelectorAll('.bar i[data-w]').forEach((i) => {
        i.style.width = i.dataset.w + '%';
        PR[i.dataset.k] = +i.dataset.w;
      });
    })
  );

  const gk = consumeGlow();
  if (gk) {
    const gEl = document.querySelector(`[data-gk="${gk}"]`);
    if (gEl) {
      gEl.classList.remove('glow');
      void gEl.offsetWidth;
      gEl.classList.add('glow');
    }
  }

  const P = getDailyProgress();
  if (prevProgress) {
    [['str', 'Fuerza', 'var(--cy)'], ['car', 'Cardio', 'var(--mg)'], ['foc', 'Recuperación', 'var(--am)']].forEach(([k, name, color]) => {
      if (prevProgress[k] < 1 && P[k] >= 1) {
        beep([523, 659, 784, 1047]);
        toast('MISIÓN COMPLETADA', `Anillo ${name} al 100%`, color);
      } else if (levelOf(prevProgress[k]) < levelOf(P[k]) && P[k] < 1) {
        beep([660, 880], 0.08);
      }
    });
  }
  prevProgress = { str: P.str, car: P.car, foc: P.foc };
}

/* ---------- Helpers de Formulario ---------- */
function readSetForm() {
  const b = uiState.exercise.b || '';
  const r = nn0($('#nr').value, parseInt);
  return { r, w: b ? 0 : nn0($('#nw').value), n: withBand($('#nn').value, b) };
}

function syncBandChips() {
  const kg = nn0($('#nw').value);
  document.querySelectorAll('[data-a="chip"]').forEach((c) => {
    const v = c.dataset.v;
    c.classList.toggle('on', v ? uiState.exercise.b === v : !uiState.exercise.b && !(kg > 0));
  });
}

function syncCardioChips() {
  const val = (($('#cx') || {}).value || '').trim();
  document.querySelectorAll('[data-a="cact"]').forEach((c) => c.classList.toggle('on', c.dataset.v === val));
}

function deleteExerciseEverywhere(name) {
  state.str = state.str.filter((s) => s.ex !== name);
  Object.keys(state.rts).forEach((k) => { state.rts[k] = state.rts[k].filter((e) => e !== name); });
  state.custom = (state.custom || []).filter((e) => e !== name);
  save();
}

function avatarFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}

/* ---------- Nube: ejecutor común (bloqueo anti doble toque + toasts de error) ---------- */
const cloudCreds = () => ({
  email: (document.getElementById('cemail')?.value || '').trim(),
  password: document.getElementById('cpass')?.value || ''
});

async function cloudRun(fn) {
  if (cloud.busy) return;
  cloud.busy = true;
  try {
    await fn();
  } catch (e) {
    toast('NUBE', (e && e.message) || 'No se pudo completar la acción', 'var(--am)');
  } finally {
    cloud.busy = false;
  }
}

/* ---------- Command Dispatch Table: ACTIONS (Click) ---------- */
const RESET_SUBSTATE = new Set(['tab', 'goto', 'view', 'sum', 'openr', 'openex', 'back', 'sub', 'rtab']);
const RESET_EDIT_MODE = new Set(['tab', 'goto', 'view', 'openr', 'back']);

const ACTIONS = {
  tab: (b) => {
    if (b.dataset.v !== 'hud') pushNav();
    uiState.tab = b.dataset.v;
    uiState.exercise = uiState.view = uiState.openRoutine = null;
    render();
    window.scrollTo(0, 0);
  },
  goto: (b) => ACTIONS.tab(b),
  view: (b) => { pushNav(); uiState.view = b.dataset.v; render(); window.scrollTo(0, 0); },
  sum: (b) => { pushNav(); uiState.sumDay = b.dataset.v || null; uiState.view = 'summary'; render(); window.scrollTo(0, 0); },
  copysum: () => {
    const k = uiState.sumDay || lastSessionDate();
    const sum = k && sessionSummary(k);
    if (!sum || !sum.stats.sets) return;
    copyText(summaryText(sum)).then((ok) => (ok
      ? toast('RESUMEN COPIADO', 'Listo para pegar donde quieras', 'var(--cy)')
      : toast('NO SE PUDO COPIAR', 'El portapapeles está bloqueado', 'var(--am)')));
  },
  openr: (b) => { pushNav(); state.rt = b.dataset.v; uiState.openRoutine = state.rt; prevProgress = null; save(); render(); },
  openex: (b) => { pushNav(); uiState.exercise = { ex: b.dataset.v, sub: 'new' }; render(); window.scrollTo(0, 0); },
  back: () => {
    if (uiState.exercise) uiState.exercise = null;
    else if (uiState.view) uiState.view = null;
    else if (uiState.openRoutine) uiState.openRoutine = null;
    else uiState.tab = 'hud';
    render();
    window.scrollTo(0, 0);
  },
  rtab: (b) => { uiState.editRoutine = b.dataset.v === '1'; render(); },
  sub: (b) => { uiState.exercise.sub = b.dataset.v; render(); },
  rt: (b) => { state.rt = b.dataset.v; prevProgress = null; save(); render(); },
  rs: (b) => { state.rest = +b.dataset.v; save(); render(); },
  skip: () => stopRest(),
  rm: () => adjustRest(-15),
  rp: () => adjustRest(15),

  step: (b) => {
    const inp = $('#' + b.dataset.f);
    const delta = (b.dataset.f === 'nw' ? 1.25 : 1) * b.dataset.d;
    inp.value = Math.max(0, +((parseFloat(inp.value) || 0) + delta).toFixed(2));
    if (b.dataset.f === 'nw') {
      if (+inp.value > 0) uiState.exercise.b = '';
      syncBandChips();
    }
  },

  add: () => {
    const t = dstr();
    const f = readSetForm();
    if (!f.r) { $('#nr').focus(); return; }
    if (uiState.editing && uiState.editing.k === 'set') {
      Object.assign(state.str[uiState.editing.i], f);
      setGlow('s' + uiState.editing.i);
      uiState.editing = null;
      save(); vib(); render();
      return;
    }
    let idx = -1, time = tstr();
    state.str.forEach((s, i) => { if (s.ex === uiState.exercise.ex && s.d === t) { idx = i; time = s.t; } });
    const newSet = { d: t, t: time, ex: uiState.exercise.ex, ...f, o: nextOrder() };
    if (idx < 0) state.str.unshift(newSet);
    else state.str.splice(idx + 1, 0, newSet);
    uiState.exercise.w = f.w;
    uiState.exercise.r = '';
    const nr = $('#nr');
    if (nr) nr.value = '';
    setGlow('s' + (idx < 0 ? 0 : idx + 1));
    save(); vib(); render(); startRest();
  },

  fin: () => {
    const t = dstr();
    const nr = $('#nr');
    const f = nr ? readSetForm() : { r: 0 };
    const exName = uiState.exercise.ex;
    if (f.r) {
      if (uiState.editing && uiState.editing.k === 'set') Object.assign(state.str[uiState.editing.i], f);
      else {
        let idx = -1, time = tstr();
        state.str.forEach((s, i) => { if (s.ex === exName && s.d === t) { idx = i; time = s.t; } });
        const newSet = { d: t, t: time, ex: exName, ...f, o: nextOrder() };
        if (idx < 0) state.str.unshift(newSet);
        else state.str.splice(idx + 1, 0, newSet);
      }
    }
    const count = state.str.filter((s) => s.ex === exName && s.d === t).length;
    uiState.editing = null;
    uiState.exercise = null;
    save(); vib(); render(); window.scrollTo(0, 0);
    toast('EJERCICIO LISTO', `${exName}: ${count} ${count === 1 ? 'serie' : 'series'} hoy`, 'var(--cy)');
  },

  del: (b) => { state.str.splice(+b.dataset.i, 1); save(); render(); },
  chip: (b) => {
    uiState.exercise.b = b.dataset.v && uiState.exercise.b !== b.dataset.v ? b.dataset.v : '';
    if (uiState.exercise.b || !b.dataset.v) $('#nw').value = '';
    syncBandChips();
  },
  eset: (b) => {
    uiState.editing = { k: 'set', i: +b.dataset.i };
    uiState.exercise.b = bandOf(state.str[uiState.editing.i].n);
    uiState.exercise.sub = 'new';
    render(); window.scrollTo(0, 0);
  },
  ecancel: () => { uiState.editing = null; render(); },

  nx: () => {
    uiState.newExOpen = !uiState.newExOpen;
    if (uiState.newExOpen) pushNav();
    render();
    if (uiState.newExOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const inp = $('#nex');
      if (inp) inp.focus({ preventScroll: true });
    }
  },
  addex: () => {
    const val = $('#nex').value.trim();
    if (!val) return;
    if (!(state.custom || []).includes(val)) state.custom = [...(state.custom || []), val];
    uiState.newExOpen = false;
    save(); pushNav();
    uiState.exercise = { ex: val, sub: 'new' };
    render();
  },
  dlx: (b) => {
    const name = b.dataset.v;
    if (uiState.confirmDel !== `l:${name}`) {
      uiState.confirmDel = `l:${name}`;
      vib(10);
      clearTimeout(delTimer);
      delTimer = setTimeout(() => { if (uiState.confirmDel === `l:${name}`) { uiState.confirmDel = null; render(); } }, 3000);
      render();
      return;
    }
    clearTimeout(delTimer);
    uiState.confirmDel = null;
    deleteExerciseEverywhere(name);
    vib([20, 40, 20]);
    render();
    toast('EJERCICIO BORRADO', name, 'var(--mg)');
  },

  newr: () => {
    const n = $('#nrn').value.trim();
    if (n && !state.rts[n]) {
      pushNav();
      state.rts[n] = [];
      state.rt = n;
      uiState.openRoutine = n;
      uiState.editRoutine = true;
      save(); render();
    }
  },
  rnr: () => {
    const n = $('#rn').value.trim();
    const old = uiState.openRoutine;
    if (n && (n === old || !state.rts[n])) {
      const updated = {};
      Object.keys(state.rts).forEach((k) => { updated[k === old ? n : k] = state.rts[k]; });
      state.rts = updated;
      if (state.rt === old) state.rt = n;
      uiState.openRoutine = n;
      save(); render();
    }
  },
  adr: () => { const v = $('#ax').value; if (v) { state.rts[uiState.openRoutine].push(v); save(); render(); } },
  mvex: (b) => {
    const i = +b.dataset.i, j = i + +b.dataset.d, arr = state.rts[uiState.openRoutine];
    if (arr && j >= 0 && j < arr.length) { [arr[i], arr[j]] = [arr[j], arr[i]]; save(); render(); }
  },
  rmex: (b) => { state.rts[uiState.openRoutine].splice(+b.dataset.i, 1); save(); render(); },
  delr: () => {
    if (uiState.confirmDel !== 'r') { uiState.confirmDel = 'r'; render(); return; }
    delete state.rts[uiState.openRoutine];
    state.rt = Object.keys(state.rts)[0] || '';
    uiState.openRoutine = null;
    uiState.confirmDel = null;
    save(); render();
  },
  rnx: () => {
    const n = $('#en').value.trim(), old = uiState.exercise.ex;
    if (n && n !== old) {
      state.str.forEach((s) => { if (s.ex === old) s.ex = n; });
      Object.keys(state.rts).forEach((k) => { state.rts[k] = state.rts[k].map((e) => (e === old ? n : e)); });
      state.custom = (state.custom || []).map((e) => (e === old ? n : e));
      uiState.exercise.ex = n;
      save(); render();
    }
  },
  delx: () => {
    if (uiState.confirmDel !== 'x') { uiState.confirmDel = 'x'; render(); return; }
    deleteExerciseEverywhere(uiState.exercise.ex);
    uiState.exercise = null;
    uiState.confirmDel = null;
    save(); render();
  },

  car: (b) => {
    const rpe = ($('#cr') || {}).value;
    const notes = [b.dataset.n, rpe ? `RPE ${rpe}` : ''].filter(Boolean).join(' · ');
    state.car.unshift({ d: dstr(), t: tstr(), ex: b.dataset.x, dur: b.dataset.m * 60, dist: '', hr: '', cal: '', n: notes });
    setGlow('c0'); save(); vib(); render();
  },
  carsave: () => {
    const m = nn0($('#cm').value);
    if (!(m > 0)) { $('#cm').focus(); return; }
    const rpe = $('#cr').value;
    const n = [$('#cn').value.trim(), rpe ? `RPE ${rpe}` : ''].filter(Boolean).join(' · ');
    const ex = $('#cx').value.trim() || 'Bicicleta';
    const dur = Math.round(m * 60);
    if (uiState.editing && uiState.editing.k === 'car') {
      Object.assign(state.car[uiState.editing.i], { ex, dur, n });
      setGlow('c' + uiState.editing.i);
      uiState.editing = null;
    } else {
      state.car.unshift({ d: dstr(), t: tstr(), ex, dur, dist: '', hr: '', cal: '', n });
      setGlow('c0');
    }
    save(); vib(); render();
  },
  ecar: (b) => { uiState.editing = { k: 'car', i: +b.dataset.i }; render(); window.scrollTo(0, 0); },
  dcar: (b) => { state.car.splice(+b.dataset.i, 1); uiState.editing = null; save(); render(); },
  cact: (b) => { const inp = $('#cx'); if (inp) { inp.value = b.dataset.v; syncCardioChips(); } },
  cbt: () => { uiState.carPanel = uiState.carPanel ? null : { i: -1 }; if (uiState.carPanel) pushNav(); render(); },
  cbe: (b) => { uiState.carPanel = { i: +b.dataset.i }; render(); },
  cbd: (b) => {
    const i = +b.dataset.i;
    state.carBtns.splice(i, 1);
    if (uiState.carPanel) {
      if (uiState.carPanel.i === i) uiState.carPanel = { i: -1 };
      else if (uiState.carPanel.i > i) uiState.carPanel.i--;
    }
    save(); render();
  },
  cbk: () => { uiState.carPanel = { i: -1 }; render(); },
  cbc: () => { uiState.carPanel = null; render(); },
  cbs: () => {
    const m = nn0($('#cbm').value, parseInt);
    const x = $('#cbx').value.trim();
    if (!x) { $('#cbx').focus(); return; }
    if (!(m > 0)) { $('#cbm').focus(); return; }
    const obj = { m, x, n: $('#cbn').value.trim(), l: $('#cbl').value.trim() || `+${m} ${x}` };
    if (uiState.carPanel && uiState.carPanel.i >= 0) state.carBtns[uiState.carPanel.i] = obj;
    else state.carBtns.push(obj);
    uiState.carPanel = { i: -1 };
    save(); vib(); render();
  },

  water: (b) => {
    const t = dstr();
    state.water[t] = Math.max(0, (state.water[t] || 0) + +b.dataset.v);
    setGlow('water'); save(); vib(); render();
  },
  wadd: () => {
    const v = nn0($('#wc').value, parseInt);
    if (v > 0) {
      const t = dstr();
      state.water[t] = (state.water[t] || 0) + v;
      setGlow('water'); save(); vib(); render();
    }
  },
  wbt: () => { uiState.watPanel = uiState.watPanel ? null : { i: -1, s: 1, v: '' }; if (uiState.watPanel) pushNav(); render(); },
  wbe: (b) => { const v = state.watBtns[+b.dataset.i]; uiState.watPanel = { i: +b.dataset.i, s: v < 0 ? -1 : 1, v: Math.abs(v) }; render(); },
  wbd: (b) => {
    const i = +b.dataset.i;
    state.watBtns.splice(i, 1);
    if (uiState.watPanel) {
      if (uiState.watPanel.i === i) uiState.watPanel = { i: -1, s: 1, v: '' };
      else if (uiState.watPanel.i > i) uiState.watPanel.i--;
    }
    save(); render();
  },
  wbs: (b) => { uiState.watPanel.s = +b.dataset.v; uiState.watPanel.v = $('#wbv').value; render(); },
  wbk: () => { uiState.watPanel = { i: -1, s: 1, v: '' }; render(); },
  wbc: () => { uiState.watPanel = null; render(); },
  wbsv: () => {
    const v = nn0($('#wbv').value, parseInt);
    if (!(v > 0)) { $('#wbv').focus(); return; }
    const val = uiState.watPanel.s * v;
    const existingIdx = state.watBtns.indexOf(val);
    if (existingIdx >= 0 && existingIdx !== uiState.watPanel.i) {
      toast('YA EXISTE', 'Esa cantidad ya es un atajo', 'var(--am)');
      return;
    }
    if (uiState.watPanel.i >= 0) state.watBtns[uiState.watPanel.i] = val;
    else state.watBtns.push(val);
    uiState.watPanel = { i: -1, s: 1, v: '' };
    save(); vib(); render();
  },

  chk: (b) => {
    const t = dstr();
    state.chk[t] = state.chk[t] || {};
    state.chk[t][b.dataset.k] = !state.chk[t][b.dataset.k];
    save(); render();
  },
  sl: (b) => { state.sleep[dstr()] = +b.dataset.v; save(); render(); },

  wtsave: () => {
    const v = nn0($('#qw').value);
    if (!(v > 0)) { $('#qw').focus(); return; }
    const bf = nn0($('#qb').value);
    const mm = nn0($('#qm').value);
    if (bf >= 100 || (mm && mm >= v)) {
      toast('DATO NO VÁLIDO', bf >= 100 ? 'La grasa debe ser menor a 100%' : 'El músculo debe ser menor al peso', 'var(--cy)');
      return;
    }
    if (uiState.editing && uiState.editing.k === 'wt') {
      state.wt[uiState.editing.i].w = v;
      state.wt[uiState.editing.i].n = withBio(state.wt[uiState.editing.i].n, bf, mm);
      uiState.editing = null;
    } else {
      state.wt.unshift({ d: dstr(), t: tstr(), w: v, n: withBio('En ayunas', bf, mm) });
    }
    save(); vib(); render();
  },
  ewt: (b) => { uiState.editing = { k: 'wt', i: +b.dataset.i }; render(); window.scrollTo(0, 0); },
  dwt: (b) => { state.wt.splice(+b.dataset.i, 1); uiState.editing = null; save(); render(); },
  bm: (b) => { uiState.bioMetric = b.dataset.v; render(); },

  prot: (b) => {
    const t = dstr();
    state.nut.prot[t] = Math.max(0, (state.nut.prot[t] || 0) + +b.dataset.v);
    setGlow('prot'); save(); vib(); render();
  },
  nclose: () => {
    const t = dstr();
    if (state.nut.closed[t]) delete state.nut.closed[t];
    else state.nut.closed[t] = true;
    setGlow('close'); save(); vib(); render();
  },

  noav: () => { delete state.prof.avatar; save(); render(); },
  mon: (b) => { uiState.calOffset += +b.dataset.d; uiState.selectedDay = null; render(); },
  day: (b) => { uiState.selectedDay = uiState.selectedDay === b.dataset.v ? null : b.dataset.v; render(); },
  exp: () => downloadFile(),
  expfull: () => downloadFile(exportFullJSON(), `leonida-respaldo-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'),

  cloudreg: () => cloudRun(async () => {
    const { email, password } = cloudCreds();
    if (!email || password.length < 6) return toast('DATOS INCOMPLETOS', 'Correo y contraseña de 6+ caracteres', 'var(--am)');
    const { needsConfirm } = await cloudSignUp(email, password);
    render();
    if (needsConfirm) toast('REVISA TU CORREO', 'Confirma tu cuenta y luego pulsa Entrar', 'var(--cy)');
    else toast('CUENTA CREADA', email, 'var(--cy)');
  }),
  cloudin: () => cloudRun(async () => {
    const { email, password } = cloudCreds();
    if (!email || !password) return toast('DATOS INCOMPLETOS', 'Escribe correo y contraseña', 'var(--am)');
    const user = await cloudSignIn(email, password);
    render();
    toast('SESIÓN INICIADA', user.email, 'var(--cy)');
  }),
  cloudout: () => cloudRun(async () => {
    await cloudSignOut();
    render();
    toast('SESIÓN CERRADA', 'Tus datos locales siguen aquí', 'var(--cy)');
  }),
  cloudreset: () => cloudRun(async () => {
    const { email } = cloudCreds();
    if (!email) return toast('FALTA EL CORREO', 'Escríbelo arriba y pulsa de nuevo', 'var(--am)');
    await cloudResetPassword(email);
    toast('ENLACE ENVIADO', `Revisa ${email} para restablecer tu contraseña`, 'var(--cy)');
  }),
  cloudnewpass: () => cloudRun(async () => {
    const pass = document.getElementById('cnewpass')?.value || '';
    if (pass.length < 6) return toast('CONTRASEÑA CORTA', 'Usa al menos 6 caracteres', 'var(--am)');
    await cloudUpdatePassword(pass);
    render();
    toast('CONTRASEÑA ACTUALIZADA', 'Ya puedes usar tu nueva contraseña', 'var(--cy)');
  }),
  clouddel: () => {
    if (uiState.confirmDel !== 'cloud') {
      uiState.confirmDel = 'cloud';
      vib(10);
      clearTimeout(delTimer);
      delTimer = setTimeout(() => { if (uiState.confirmDel === 'cloud') { uiState.confirmDel = null; render(); } }, 4000);
      render();
      return;
    }
    clearTimeout(delTimer);
    uiState.confirmDel = null;
    cloudRun(async () => {
      await cloudDeleteAccount();
      render();
      toast('CUENTA ELIMINADA', 'Tus datos locales siguen en este dispositivo', 'var(--mg)');
    });
  },
  cloudpush: () => cloudRun(async () => {
    const n = await pushToCloud();
    toast('RESPALDO SUBIDO', `${n.str} series · ${n.car} cardio · ${n.wt} pesos`, 'var(--cy)');
  }),
  cloudpull: () => cloudRun(async () => {
    const n = await pullFromCloud();
    prevProgress = null;
    render();
    toast('RESPALDO DESCARGADO', `${n.str} series · ${n.car} cardio · ${n.wt} pesos`, 'var(--cy)');
  })
};

/* ---------- Command Dispatch Table: CHANGES (Inputs / Selects / Files) ---------- */
const CHANGES = {
  name: (v) => { state.prof.name = v.trim().slice(0, 20) || 'Juan'; },
  h: (v) => { state.prof.h = nn0(v); },
  goal: (v) => { state.prof.goal = nn0(v); },
  sleep: (v) => { state.sleep[dstr()] = Math.min(24, nn0(v)); },
  gsleep: (v) => { state.goals.sleep = Math.min(24, Math.max(1, nn0(v) || 8)); },
  gcar: (v) => { state.goals.car = Math.max(1, nn0(v) || 50); },
  gwat: (v) => { state.goals.wat = Math.max(250, Math.round((nn0(v) || 3.2) * 1000)); },
  wtot: (v) => { state.water[dstr()] = nn0(v); },
  ptot: (v) => { state.nut.prot[dstr()] = nn0(v); },
  pgoal: (v) => { state.nut.goal = Math.max(1, nn0(v) || 170); },
  gm: (v) => { uiState.exercise.gm = v; },
  gr: (v) => { uiState.exercise.gr = v; },

  avatar: async (_, target) => {
    const file = target.files[0];
    if (!file) return false;
    try {
      state.prof.avatar = await avatarFromFile(file);
      save(); render();
    } catch (e) {
      toast('IMAGEN NO VÁLIDA', 'Prueba con otra foto', 'var(--cy)');
    }
    return false;
  },

  file: async (_, target) => {
    const file = target.files[0];
    if (!file) return false;
    const d = parseCSV(await file.text());
    state.str = mergeRecords(state.str, d.str, (s) => [s.d, s.t, s.ex, s.r, s.w, bandOf(s.n)].join('|'));
    state.car = mergeRecords(state.car, d.car, (c) => [c.d, c.t, c.ex, c.dur].join('|'));
    state.wt = mergeRecords(state.wt, d.wt, (w) => [w.d, w.t, w.w].join('|'));
    prevProgress = null;
    save(); render();
    toast('IMPORTADO', `${d.str.length} series · ${d.car.length} cardio · ${d.wt.length} pesos`);
    return false;
  },

  backup: async (_, target) => {
    const file = target.files[0];
    if (!file) return false;
    try {
      const b = JSON.parse(await file.text());
      if (!b || b.app !== 'leonida-hud') throw new Error('Invalid');
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
      prevProgress = null;
      save(); render();
      toast('RESPALDO RESTAURADO', `${(b.str || []).length} series`);
    } catch (e) {
      toast('ARCHIVO NO VÁLIDO', 'No es un respaldo de Leonida', 'var(--cy)');
    }
    return false;
  }
};

/* ---------- Delegación Global de Eventos ---------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-a]');
  if (!btn) {
    if (uiState.confirmDel && uiState.confirmDel.startsWith('l:')) {
      uiState.confirmDel = null;
      render();
    }
    return;
  }
  const action = btn.dataset.a;
  if (RESET_SUBSTATE.has(action)) {
    uiState.editing = null;
    uiState.confirmDel = null;
    uiState.newExOpen = false;
    uiState.carPanel = null;
    uiState.watPanel = null;
  }
  if (RESET_EDIT_MODE.has(action)) uiState.editRoutine = false;
  if (ACTIONS[action]) ACTIONS[action](btn, e);
});

document.addEventListener('change', async (e) => {
  const key = e.target.dataset.c;
  if (!key || key === 'flt' || !CHANGES[key]) return;
  const shouldSaveAndRender = await CHANGES[key](e.target.value, e.target);
  if (shouldSaveAndRender !== false) {
    save();
    render();
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.type === 'number' && parseFloat(t.value) < 0) t.value = 0;
  if (t.id === 'cx') syncCardioChips();
  if (t.id === 'nw' && uiState.exercise) {
    if (nn0(t.value) > 0) uiState.exercise.b = '';
    syncBandChips();
  }
  if (t.dataset.c === 'flt') {
    const q = t.value.toLowerCase();
    document.querySelectorAll('#exl .rr').forEach((r) => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'nex') {
    const b = document.querySelector('[data-a="addex"]');
    if (b) b.click();
  }
});

/* ---------- Arranque ---------- */
render();
initDB(() => {
  prevProgress = null;
  render();
});
initCloudAuth(() => {
  // Al volver del enlace de recuperación, llevar al usuario directo al formulario de Perfil
  if (isPasswordRecovery && uiState.view !== 'prof') {
    uiState.tab = 'data';
    uiState.view = 'prof';
    pushNav();
    toast('RECUPERACIÓN', 'Escribe tu nueva contraseña', 'var(--cy)');
  }
  render();
});
