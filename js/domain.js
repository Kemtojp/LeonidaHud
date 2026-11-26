/* ==========================================================================
   domain.js — Lógica de Negocio Pura (Cálculos, Diagnósticos y Estadísticas)
   ========================================================================== */

import { state, dstr, parseDate, hmsToSec, loadRank, parseBio, bandOf, cleanNotes } from './store.js';

export const levelOf = (p) => Math.floor(p * 4 + 1e-9);

export function allExercises() {
  return [...new Set([
    ...state.str.map((s) => s.ex),
    ...Object.values(state.rts).flat(),
    ...(state.custom || [])
  ])].sort((a, b) => a.localeCompare(b));
}

export function matchRoutine(dateKey, preferred) {
  let best = null, bestOverlap = 0;
  const doneToday = new Set(state.str.filter((s) => s.d === dateKey).map((s) => s.ex));
  const candidates = [preferred, ...Object.keys(state.rts).filter((n) => n !== preferred)];
  for (const name of candidates) {
    if (!state.rts[name]) continue;
    const overlap = state.rts[name].filter((e) => doneToday.has(e)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = name;
    }
  }
  return best;
}

export function getDailyProgress() {
  const t = dstr();
  const rt = matchRoutine(t, state.rt) || state.rt;
  const exList = state.rts[rt] || [];
  const plan = exList.length;
  const done = exList.filter((e) => state.str.some((s) => s.d === t && s.ex === e)).length;
  const cm = state.car.filter((c) => c.d === t).reduce((a, c) => a + c.dur, 0) / 60;
  const w = state.water[t] || 0;
  const ck = state.chk[t] || {};

  const str = Math.min(1, done / (plan || 1));
  const car = Math.min(1, cm / state.goals.car);
  const foc = Math.min(
    1,
    Math.min(1, w / state.goals.wat) * 0.35 +
    Math.min(1, (state.sleep[t] || 0) / (state.goals.sleep || 8)) * 0.35 +
    (ck.anab ? 0.15 : 0) +
    (ck.mov ? 0.15 : 0)
  );

  return { str, car, foc, done, plan, cm, w, ck, rt };
}

export function lastSession(ex) {
  const arr = state.str.filter((s) => s.ex === ex && s.d !== dstr());
  if (!arr.length) return null;
  return { d: arr[0].d, sets: arr.filter((s) => s.d === arr[0].d) };
}

export function detectPlateau(ex) {
  const t = dstr();
  const grouped = {};
  state.str.forEach((s) => {
    if (s.ex === ex) (grouped[s.d] = grouped[s.d] || []).push(s);
  });

  const topSet = (arr) => arr.reduce((p, s) => (loadRank(s) > loadRank(p) || (loadRank(s) === loadRank(p) && s.r > p.r) ? s : p));
  const pastDays = Object.keys(grouped)
    .filter((d) => d !== t)
    .sort((a, b) => parseDate(b) - parseDate(a))
    .map((d) => topSet(grouped[d]));

  if (pastDays.length < 2) return null;

  let streakCount = 1;
  while (
    streakCount < pastDays.length &&
    loadRank(pastDays[streakCount]) === loadRank(pastDays[0]) &&
    pastDays[streakCount].r === pastDays[0].r
  ) {
    streakCount++;
  }

  if (streakCount < 2) return null;

  if (grouped[t]) {
    const todayTop = topSet(grouped[t]);
    if (loadRank(todayTop) > loadRank(pastDays[0]) || (loadRank(todayTop) === loadRank(pastDays[0]) && todayTop.r > pastDays[0].r)) {
      return null;
    }
  }

  return { n: streakCount, s: pastDays[0] };
}

export const sortedWeights = () =>
  [...state.wt].sort((a, b) => (parseDate(a.d) + hmsToSec(a.t + ':0') * 1000) - (parseDate(b.d) + hmsToSec(b.t + ':0') * 1000));

export function weightTrendInfo() {
  const now = Date.now();
  const recent = sortedWeights().filter((x) => now - parseDate(x.d) < 28 * 864e5);
  const span = recent.length > 1 ? (parseDate(recent[recent.length - 1].d) - parseDate(recent[0].d)) / 864e5 : 0;
  return {
    n: recent.length,
    span,
    rate: recent.length > 1 && span >= 3 ? ((recent[recent.length - 1].w - recent[0].w) / span) * 7 : null
  };
}

export function bioTrend() {
  const arr = sortedWeights().filter((x) => {
    const b = parseBio(x.n);
    return b.bf != null && b.mm != null;
  });
  if (!arr.length) return null;
  const latest = arr[arr.length - 1];
  const bLatest = parseBio(latest.n);
  const windowArr = arr.filter((x) => {
    const diff = parseDate(latest.d) - parseDate(x.d);
    return diff >= 3 * 864e5 && diff <= 28 * 864e5;
  });
  if (!windowArr.length) return { bf: bLatest.bf, mm: bLatest.mm, dm: null, df: null, sp: 0 };
  const first = parseBio(windowArr[0].n);
  return {
    bf: bLatest.bf,
    mm: bLatest.mm,
    dm: bLatest.mm - first.mm,
    df: bLatest.bf - first.bf,
    sp: (parseDate(latest.d) - parseDate(windowArr[0].d)) / 864e5
  };
}

export function weeklySummary() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dstr(d));
  }
  return {
    sd: days.filter((k) => state.str.some((s) => s.d === k)).length,
    cm: Math.round(state.car.filter((c) => days.includes(c.d)).reduce((x, c) => x + c.dur, 0) / 60)
  };
}

export function recompSummary() {
  const w = weeklySummary();
  const k = weightTrendInfo().rate;
  return {
    m: w.sd >= 3 ? 'En progreso' : w.sd >= 1 ? 'Manteniendo' : 'En pausa',
    g: k == null
      ? (w.cm >= state.goals.car * 4 ? 'En camino' : 'Sin datos')
      : k < -0.15 ? 'Bajando' : k > 0.15 ? 'Subiendo' : 'Estable'
  };
}

export function sleepSummary() {
  const g = state.goals.sleep || 8;
  let bars = '', n = 0, sum = 0, debt = 0;
  for (let i = 6; i >= 0; i--) {
    const k = dstr(new Date(Date.now() - i * 864e5));
    const v = state.sleep[k] || 0;
    if (v) { n++; sum += v; debt += g - v; }
    const hh = Math.round((Math.min(v, 10) / 10) * 46);
    bars += `<div style="flex:1;text-align:center"><div style="height:46px;display:flex;align-items:flex-end"><div style="width:100%;height:${hh}px;background:var(--am);border-radius:3px"></div></div><div class="sub m" style="font-size:10px">${v || '-'}</div></div>`;
  }
  return { b: bars, avg: n ? +(sum / n).toFixed(1) : 0, debt: +debt.toFixed(1), n };
}

export const isProteinDayOk = (k) => (state.nut.prot[k] || 0) >= 0.85 * state.nut.goal || !!state.nut.closed[k];

export function proteinStreak() {
  let n = 0;
  const d = new Date();
  if (!isProteinDayOk(dstr(d))) d.setDate(d.getDate() - 1);
  while (isProteinDayOk(dstr(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ---------- Tabla Declarativa de Estados Dinámicos (Sin cadena de ifs) ---------- */
const RO = '#f2b8cc', MN = '#8de8c6', GOLD = '#ffd86b';

export function evaluateCharacterStatus() {
  const t = dstr();
  const P = getDailyProgress();
  const h = state.sleep[t] || 0;
  const sw = sleepSummary();
  const protRatio = (state.nut.prot[t] || 0) / (state.nut.goal || 170);
  const watRatio = (state.water[t] || 0) / state.goals.wat;
  const ck = state.chk[t] || {};
  const hour = new Date().getHours();
  const trainedToday = state.str.some((s) => s.d === t);
  const goodSleep = h >= 7 && h <= 9;
  const activeToday = P.str >= 1 || P.car >= 1;

  const rules = [
    { when: () => h && h < 5.5, e: 'Agotado', c: RO, why: () => `Dormiste ${h} h: te falta dormir bastante` },
    { when: () => sw.n >= 2 && sw.debt >= 7, e: 'Agotado', c: RO, why: () => `Deuda de sueño: ${sw.debt} h esta semana` },
    { when: () => h && h < 7, e: 'Cansado', c: RO, why: () => `Dormiste ${h} h: te falta dormir` },
    { when: () => trainedToday && protRatio < 0.4 && !ck.anab, e: 'Sin combustible', c: RO, why: () => `Entrenaste y llevas ${Math.round(protRatio * 100)}% de tu proteína` },
    { when: () => hour >= 15 && watRatio < 0.35, e: 'Falta hidratación', c: RO, why: () => `Llevas ${((state.water[t] || 0) / 1000).toFixed(1)} L de agua: toma más` },
    { when: () => h > 9, e: 'Dormiste de más', c: RO, why: () => `Dormiste ${h} h: más de 9 h puede dejarte lento` },
    { when: () => P.str >= 1 && P.car >= 1 && P.foc >= 1, e: 'Imparable', c: GOLD, why: () => 'Cerraste los 3 anillos hoy' },
    { when: () => goodSleep && activeToday && protRatio >= 0.8, e: 'En estado óptimo', c: MN, why: () => 'Buen sueño, entrenamiento y proteína' },
    { when: () => goodSleep && protRatio >= 0.8, e: 'Bien nutrido', c: MN, why: () => `Buen sueño y proteína al ${Math.round(protRatio * 100)}%` },
    { when: () => goodSleep && !trainedToday && (ck.mov || watRatio >= 0.7), e: 'En recuperación', c: MN, why: () => 'Buen sueño en un día sin pesas' }
  ];

  const matched = rules.find((r) => r.when());
  if (matched) return { e: matched.e, c: matched.c, why: matched.why() };
  return { e: 'Saludable', c: MN, why: h ? `Dormiste ${h} h` : 'Registra tu sueño para afinar tu estado' };
}

/* ---------- Resumen de sesión / día (Summary) ---------- */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fmtNum = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function lastSessionDate() {
  let best = null, bestTs = -Infinity;
  state.str.forEach((s) => {
    const ts = parseDate(s.d);
    if (ts > bestTs) { bestTs = ts; best = s.d; }
  });
  return best;
}

const loadText = (s) => {
  const b = bandOf(s.n);
  return b ? `Banda ${b}` : s.w > 0 ? `${s.w} kg` : 'peso corporal';
};

// Ejercicios en el orden real de ejecución. Cada serie nueva guarda `o` (timestamp de creación);
// los datos anteriores usan fecha + hora `t` y, a igualdad, el orden del arreglo (más nuevo primero).
export function sessionSummary(k) {
  const dayStart = parseDate(k);
  const legacyTs = (s) => dayStart + hmsToSec(`${s.t}:0`) * 1000;
  const groups = new Map();
  state.str.forEach((s, i) => {
    if (s.d !== k) return;
    if (!groups.has(s.ex)) groups.set(s.ex, []);
    groups.get(s.ex).push({ s, i });
  });

  const exercises = [...groups.entries()].map(([ex, items]) => {
    items.sort((a, b) => {
      const ha = a.s.o != null, hb = b.s.o != null;
      if (ha && hb) return a.s.o - b.s.o || a.i - b.i;
      if (ha !== hb) return ha ? 1 : -1; // sin `o` = anterior a esta mejora
      return a.i - b.i;
    });
    return {
      ex,
      start: Math.min(...items.map((x) => (x.s.o != null ? x.s.o : legacyTs(x.s)))),
      minIdx: Math.min(...items.map((x) => x.i)),
      sets: items.map((x) => ({ r: x.s.r, w: x.s.w, load: loadText(x.s) })),
      notes: [...new Set(items.map((x) => cleanNotes(x.s.n)).filter(Boolean))]
    };
  }).sort((a, b) => a.start - b.start || b.minIdx - a.minIdx);

  const all = exercises.flatMap((e) => e.sets);
  return {
    date: k,
    ts: dayStart,
    exercises,
    stats: {
      exercises: exercises.length,
      sets: all.length,
      reps: all.reduce((x, s) => x + (s.r || 0), 0),
      volume: all.reduce((x, s) => x + (s.r || 0) * (s.w || 0), 0)
    }
  };
}

export function summaryDateLabel(ts) {
  const t = new Date(ts).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function summaryText(sum) {
  const st = sum.stats;
  const L = ['RESUMEN DE ENTRENAMIENTO', summaryDateLabel(sum.ts), '', 'STATS'];
  L.push(plural(st.exercises, 'ejercicio completado', 'ejercicios completados'));
  L.push(plural(st.sets, 'serie completada', 'series completadas'));
  L.push(plural(st.reps, 'repetición total', 'repeticiones totales'));
  if (st.volume > 0) L.push(`${fmtNum(Math.round(st.volume * 10) / 10)} kg levantados en total`);
  L.push('', 'DETALLE');
  sum.exercises.forEach((e, n) => {
    L.push(`${n + 1}. ${e.ex}`);
    e.sets.forEach((s, i) => L.push(`   Serie ${i + 1}: ${s.r} reps @ ${s.load}`));
    if (e.notes.length) L.push(`   Notas: ${e.notes.join(' · ')}`);
  });
  return L.join('\n');
}
