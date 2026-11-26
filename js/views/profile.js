/* ==========================================================================
   views/profile.js — Cuerpo (Eufy Life), Balance Calórico, Perfil y Más
   ========================================================================== */

import { state, uiState, cloud, isPasswordRecovery, dstr, parseDate, esc, bandOf, formatSet, parseBio } from '../store.js';
import {
  allExercises, matchRoutine, detectPlateau, sortedWeights,
  weightTrendInfo, bioTrend, weeklySummary, proteinStreak,
  lastSessionDate, sessionSummary, summaryDateLabel
} from '../domain.js';
import { backHeader, barHTML, sparkline } from '../ui.js';
import { avatarHTML } from './hud.js';

const RO = '#f2b8cc', MN = '#8de8c6', LV = '#b896f5';
const ICONS = {
  h: 'M12 21s-7-4.4-9.3-8.6C1 9 3 5.5 6.4 5.5c2 0 3.6 1.1 4.4 2.6.8-1.5 2.4-2.6 4.4-2.6 3.4 0 5.4 3.5 3.7 6.9C19 16.6 12 21 12 21z',
  b: 'M13 2L5 14h6l-1 8 8-12h-6z',
  e: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 3a4 4 0 110 8 4 4 0 010-8z'
};
const STAR_SVG = '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="#ffd86b" d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/></svg>';

const signed = (v) => (v > 0 ? '+' : '') + v.toFixed(1);
const bioLabel = (w) => {
  const b = parseBio(w.n);
  return (b.bf != null ? ` · ${b.bf}%` : '') + (b.mm != null ? ` · ${b.mm} kg músc.` : '');
};

export function renderBodyView() {
  const h = state.prof.h;
  const g = state.prof.goal;
  const latest = sortedWeights().pop();
  const editWt = uiState.editing && uiState.editing.k === 'wt' ? state.wt[uiState.editing.i] : null;
  const editBio = editWt ? parseBio(editWt.n) : {};
  const imc = latest && h ? (latest.w / ((h / 100) ** 2)).toFixed(1) : '-';
  const rate = weightTrendInfo().rate;
  const balText = rate == null ? 'Registra tu peso para calcular' : rate < -0.15 ? 'Perderás peso' : rate > 0.15 ? 'Ganarás peso' : 'Mantendrás el peso actual';

  const metrics = {
    w: ['Peso (kg)', '#f2b8cc', (x) => x.w],
    bf: ['Grasa (%)', '#8de8c6', (x) => parseBio(x.n).bf],
    mm: ['Músculo (kg)', '#b896f5', (x) => parseBio(x.n).mm]
  };
  const curMetric = metrics[uiState.bioMetric];
  const chartVals = sortedWeights().map(curMetric[2]).filter((v) => v != null).slice(-30);

  return backHeader('Cuerpo') + `
    <div class="card" style="--ac:var(--cy)">
      <h3>${editWt ? 'Editar registro' : 'Registro en ayunas'}</h3>
      <div class="row"><input id="qw" type="number" inputmode="decimal" step=".1" min="0" value="${editWt ? editWt.w : ''}" placeholder="Peso (kg)" aria-label="Peso en kg" style="flex:1;min-width:0"></div>
      <div class="row" style="margin-top:8px">
        <input id="qb" type="number" inputmode="decimal" step=".1" min="0" value="${editBio.bf ?? ''}" placeholder="Grasa (%)" aria-label="Grasa corporal en porcentaje" style="flex:1;min-width:0">
        <input id="qm" type="number" inputmode="decimal" step=".1" min="0" value="${editBio.mm ?? ''}" placeholder="Músculo (kg)" aria-label="Masa muscular en kg" style="flex:1;min-width:0">
      </div>
      <div class="row" style="margin-top:8px">
        <button class="b-cy" style="flex:1" data-a="wtsave">${editWt ? 'Actualizar' : 'Guardar'}</button>
        ${editWt ? '<button data-a="ecancel">Cancelar</button>' : ''}
      </div>
      <div class="sub" style="margin-top:6px">Grasa y músculo son opcionales (por ejemplo, de Eufy Life). ${balText}</div>
    </div>
    <div class="card" style="--ac:var(--cy)">
      <div class="row">
        <label class="f">Altura (cm)<input type="number" data-c="h" value="${h || ''}"></label>
        <label class="f">Meta (kg)<input type="number" step=".1" data-c="goal" value="${g || ''}"></label>
        <label class="f">IMC<b class="m" style="padding-top:9px">${imc}</b></label>
      </div>
      <div class="chips" style="margin:10px 0 4px">
        ${Object.keys(metrics).map((k) => `<button class="chip ${uiState.bioMetric === k ? 'on' : ''}" style="--bc:${metrics[k][1]}" data-a="bm" data-v="${k}">${metrics[k][0]}</button>`).join('')}
      </div>
      <div>${sparkline(chartVals, curMetric[1])}</div>
    </div>
    <h3 style="margin:14px 0 4px">Registros</h3>
    ${state.wt.slice(0, 15).map((w, i) => `<div class="row m" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${w.d} ${w.w} kg${bioLabel(w)}</span><span><button data-a="ewt" data-i="${i}" aria-label="Editar">✎</button> <button data-a="dwt" data-i="${i}" aria-label="Borrar">✕</button></span></div>`).join('') || '<div class="sub">Sin registros</div>'}`;
}

export function renderNutriView() {
  const t = dstr();
  const N = state.nut;
  const g = N.prot[t] || 0;
  const ti = weightTrendInfo();
  const rate = ti.rate;
  const curW = sortedWeights().pop();
  const goalW = state.prof.goal;
  const w = weeklySummary();
  const st = proteinStreak();
  const autoClosed = g >= 0.85 * N.goal;
  const manClosed = !!N.closed[t];

  let diagHTML = '';
  if (rate == null) {
    const pct = (ti.n >= 1 ? 50 : 0) + Math.min(ti.span / 3, 1) * 50;
    const msg = ti.n === 0
      ? 'Registra tu peso en ayunas dos veces, con al menos 3 días de diferencia.'
      : `Falta 1 pesaje más en ayunas, al menos ${Math.max(1, Math.ceil(3 - ti.span))} día(s) después del primero.`;
    diagHTML = `<div class="big m" style="font-size:20px">CALIBRANDO</div><div style="margin-top:4px">${msg}</div>${barHTML('cal', pct)}<div class="sub" style="margin-top:6px">Calibración ${Math.round(pct)}%</div>`;
  } else {
    const verdict = rate < -0.15
      ? ['DÉFICIT DETECTADO', 'Perderás peso', 'var(--mg)']
      : rate > 0.15
      ? ['SUPERÁVIT DETECTADO', 'Ganarás peso', 'var(--am)']
      : ['MANTENIMIENTO DETECTADO', 'Mantendrás el peso actual', 'var(--tx)'];
    let rec = 'Define tu peso meta en Cuerpo para recibir una recomendación.';
    if (goalW && curW) {
      const diff = curW.w - goalW;
      rec = diff > 0.5
        ? (rate < -0.15 ? `A este ritmo llegas a tu meta (${goalW} kg) en ~${Math.ceil(diff / -rate)} semanas.` : `Tu meta es bajar ${diff.toFixed(1)} kg: necesitas más déficit.${w.cm < 150 ? ` Tu cardio semanal es bajo (${w.cm} min).` : ''}`)
        : diff < -0.5
        ? (rate > 0.15 ? `Vas hacia tu meta de ${goalW} kg: ~${Math.ceil(-diff / rate)} semanas.` : `Tu meta es subir ${(-diff).toFixed(1)} kg: sube calorías con proteína y entrena fuerza.`)
        : 'Estás a menos de 0.5 kg de tu meta: mantén el ritmo.';
    }
    diagHTML = `<div class="big m" style="color:${verdict[2]};font-size:20px">${verdict[0]}</div><div style="font-weight:600;margin-top:4px">${verdict[1]}</div><div class="m" style="margin-top:4px">${rate > 0 ? '+' : ''}${rate.toFixed(2)} kg/sem</div><div class="sub" style="margin-top:6px">${rec}</div>`;
  }

  const bt = bioTrend();
  let bioHTML = '';
  if (bt) {
    if (bt.dm == null) {
      bioHTML = `<div class="sub" style="margin-top:10px">Composición: grasa ${bt.bf.toFixed(1)}%, músculo ${bt.mm.toFixed(1)} kg. Registra otra medición, 3 días o más después, para ver tu tendencia.</div>`;
    } else {
      const dmw = (bt.dm / bt.sp) * 7;
      const dfw = (bt.df / bt.sp) * 7;
      const compVerdict = dfw < -0.1 && dmw >= -0.1
        ? ['RECOMPOSICIÓN ÓPTIMA', 'Bajas grasa y retienes o ganas músculo.', 'var(--mg)']
        : dmw < -0.3
        ? ['PÉRDIDA DE MASA MAGRA', `Estás perdiendo músculo: el déficit puede ser muy agresivo. Asegura tu proteína (${N.goal} g) y considera comer un poco más.`, 'var(--cy)']
        : dfw > 0.1
        ? ['GRASA SUBIENDO', 'Tu grasa sube: revisa porciones y cardio.', 'var(--am)']
        : ['COMPOSICIÓN ESTABLE', 'Sin cambios claros en grasa y músculo.', 'var(--tx)'];
      bioHTML = `<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px"><div class="sub">Composición (bioimpedancia)</div><div class="big m" style="font-size:18px;color:${compVerdict[2]}">${compVerdict[0]}</div><div style="margin-top:4px">${compVerdict[1]}</div><div class="m" style="margin-top:4px;font-size:13px">Grasa ${bt.bf.toFixed(1)}% (${signed(bt.df)} pp), músculo ${bt.mm.toFixed(1)} kg (${signed(bt.dm)} kg)</div><div class="sub" style="margin-top:4px">La bioimpedancia varía con la hidratación: mide en ayunas y a la misma hora.</div></div>`;
    }
  }

  return backHeader('Balance calórico') + `
    <div class="card" style="--ac:var(--tx)"><h3>Diagnóstico automático</h3>${diagHTML}${bioHTML}<div class="sub m" style="margin-top:8px">Últimos 7 días: cardio ${w.cm} min, fuerza ${w.sd} días</div></div>
    <div class="card" style="--ac:var(--cy)">
      <h3>Proteína</h3>
      <div class="big m" data-gk="prot">${g} / ${N.goal} g</div>
      ${barHTML('prot', Math.min(1, g / N.goal) * 100)}
      <div class="row" style="margin-top:8px">${[30, 20, 15].map((n) => `<button class="b-cy" data-a="prot" data-v="${n}">+${n}g</button>`).join('')}<button data-a="prot" data-v="-15">-15</button></div>
      <div class="stp"><span>HOY</span><input data-c="ptot" type="number" inputmode="numeric" min="0" value="${g}" aria-label="Proteína de hoy"><span>g</span></div>
      <div class="stp"><span>META</span><input data-c="pgoal" type="number" inputmode="numeric" min="0" value="${N.goal}" aria-label="Meta de proteína"><span>g</span></div>
    </div>
    <div class="card" style="--ac:var(--am)">
      <h3>Cierre del día</h3>
      <div class="sub">${autoClosed ? `✓ Cerrado automáticamente: proteína al ${Math.round((g / N.goal) * 100)}%` : `Se cierra solo al llegar al 85% de tu proteína (faltan ${Math.max(0, Math.ceil(0.85 * N.goal - g))} g).`}</div>
      <button class="${manClosed ? 'on' : ''}" style="--ac:var(--am);width:100%;margin-top:8px" data-a="nclose" data-gk="close">${manClosed ? '✓ ' : ''}Comidas del día completadas</button>
      <div class="m" style="margin-top:8px">Racha: ${st} ${st === 1 ? 'día' : 'días'}</div>
    </div>`;
}

function calcStreakRuns(timestamps, step, anchor) {
  let best = 0, run = 0, prev = null;
  timestamps.forEach((x) => {
    run = prev != null && Math.round((x - prev) / step) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = x;
  });
  return { cur: timestamps.length && anchor - timestamps[timestamps.length - 1] <= step * 1.5 ? run : 0, best };
}

function renderAccountCard() {
  const body = isPasswordRecovery
    ? `<div class="sub">Elige una nueva contraseña para tu cuenta.</div>
      <div class="row" style="margin-top:8px"><input id="cnewpass" type="password" autocomplete="new-password" placeholder="Nueva contraseña (mín. 6)" aria-label="Nueva contraseña" style="flex:1;min-width:0"></div>
      <div class="row" style="margin-top:8px"><button class="b-cy" style="width:100%" data-a="cloudnewpass">Guardar nueva contraseña</button></div>`
    : cloud.user
    ? `<div class="sub">Conectado como <b>${esc(cloud.user.email)}</b></div>
      <div class="row" style="margin-top:8px"><button style="width:100%" data-a="cloudout">Cerrar sesión</button></div>
      <button class="b-mg" style="width:100%;margin-top:6px" data-a="clouddel">${uiState.confirmDel === 'cloud' ? 'Confirmar: eliminar cuenta y nube' : 'Eliminar cuenta'}</button>`
    : `<div class="sub">Crea una cuenta para guardar tu respaldo y recuperarlo en otro dispositivo.</div>
      <div class="row" style="margin-top:8px"><input id="cemail" type="email" autocomplete="email" inputmode="email" placeholder="Correo" aria-label="Correo" style="flex:1;min-width:0"></div>
      <div class="row" style="margin-top:8px"><input id="cpass" type="password" autocomplete="current-password" placeholder="Contraseña (mín. 6)" aria-label="Contraseña" style="flex:1;min-width:0"></div>
      <div class="row" style="margin-top:8px"><button class="b-cy" data-a="cloudin">Entrar</button><button class="b-mg" data-a="cloudreg">Crear cuenta</button></div>
      <button style="width:100%;margin-top:6px;background:none;border-color:transparent;color:var(--mu)" data-a="cloudreset">Olvidé mi contraseña</button>`;
  return `<div class="card" style="--ac:var(--mg)"><h3>Cuenta en la Nube</h3>${body}</div>`;
}

export function renderProfileView() {
  const mondayOf = (ts) => {
    const d = new Date(ts);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const strDays = [...new Set(state.str.map((s) => s.d))].map(parseDate).sort((a, b) => a - b);
  const actDays = [...new Set([...state.str.map((s) => s.d), ...state.car.map((c) => c.d)])].map(parseDate).sort((a, b) => a - b);
  const todayTs = parseDate(dstr());

  const weekCounts = {};
  strDays.forEach((x) => { const m = mondayOf(x); weekCounts[m] = (weekCounts[m] || 0) + 1; });
  const activeWeeks = Object.keys(weekCounts).filter((m) => weekCounts[m] >= 3).map(Number).sort((a, b) => a - b);

  const dayRuns = calcStreakRuns(actDays, 864e5, todayTs);
  const weekRuns = calcStreakRuns(activeWeeks, 7 * 864e5, mondayOf(todayTs));

  let maxLoad = { w: 0 }, maxBw = { r: 0 };
  const dailyVol = {};
  state.str.forEach((s) => {
    if (s.w > maxLoad.w) maxLoad = s;
    if (!s.w && !bandOf(s.n) && s.r > maxBw.r) maxBw = s;
    dailyVol[s.d] = (dailyVol[s.d] || 0) + s.r * s.w;
  });

  const bestVolDay = Object.keys(dailyVol).sort((a, b) => dailyVol[b] - dailyVol[a])[0];
  const totalCardioMin = Math.round(state.car.reduce((x, c) => x + c.dur, 0) / 60);
  const stalledList = allExercises().map((e) => [e, detectPlateau(e)]).filter((x) => x[1]);

  const statRow = (label, val) =>
    `<div class="row m" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="sub">${label}</span><span>${val}</span></div>`;

  return backHeader('Perfil') + `
    <div class="card" style="--ac:var(--cy)">
      <h3>Nombre y foto</h3>
      <div class="row"><div class="av" style="width:56px;height:56px">${avatarHTML()}</div><input data-c="name" value="${esc(state.prof.name || 'Juan')}" maxlength="20" placeholder="Tu nombre o apodo" style="flex:1;min-width:0" aria-label="Nombre"></div>
      <div class="row" style="margin-top:8px"><input type="file" accept="image/*" data-c="avatar" style="flex:1;min-width:0" aria-label="Foto de perfil">${state.prof.avatar ? '<button data-a="noav">Quitar foto</button>' : ''}</div>
    </div>
    ${renderAccountCard()}
    <div class="card" style="--ac:var(--am)">
      <h3>Estadísticas</h3>
      ${statRow('Días con fuerza', strDays.length)}
      ${statRow('Días activos (fuerza o cardio)', actDays.length)}
      ${statRow('Series registradas', state.str.length)}
      ${statRow('Cardio total', `${totalCardioMin} min`)}
      ${statRow('Racha de días activos', `${dayRuns.cur} (mejor ${dayRuns.best})`)}
      ${statRow('Semanas seguidas con 3+ días de fuerza', `${weekRuns.cur} (mejor ${weekRuns.best})`)}
      ${statRow('Racha de proteína', `${proteinStreak()} ${proteinStreak() === 1 ? 'día' : 'días'}`)}
    </div>
    <div class="card" style="--ac:var(--mg)">
      <h3>Récords</h3>
      ${statRow('Mayor carga', maxLoad.w ? `${maxLoad.w} kg en ${esc(maxLoad.ex)}` : '-')}
      ${statRow('Más reps con peso corporal', maxBw.r ? `${maxBw.r} en ${esc(maxBw.ex)}` : '-')}
      ${statRow('Mayor volumen en un día', bestVolDay && dailyVol[bestVolDay] > 0 ? `${Math.round(dailyVol[bestVolDay])} kg (${bestVolDay})` : '-')}
    </div>
    <div class="card" style="--ac:var(--cy)">
      <h3>Radar de sobrecarga</h3>
      ${stalledList.length
        ? stalledList.map(([e, q]) => `<div class="row m" data-a="openex" data-v="${esc(e)}" role="button" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);cursor:pointer"><span>${esc(e)}</span><span class="sub">${q.n} sesiones · ${formatSet(q.s)}</span></div>`).join('')
        : '<div class="sub">Ningún ejercicio estancado por ahora</div>'}
    </div>`;
}

function daySummary(k) {
  const sets = state.str.filter((s) => s.d === k);
  const cm = state.car.filter((c) => c.d === k).reduce((x, c) => x + c.dur, 0) / 60;
  const w = state.water[k] || 0;
  const sl = state.sleep[k] || 0;
  const ck = state.chk[k] || {};
  let ps = 0;
  if (sets.length) {
    const exSet = new Set(sets.map((s) => s.ex));
    const best = matchRoutine(k);
    ps = best ? state.rts[best].filter((e) => exSet.has(e)).length / state.rts[best].length : Math.min(1, exSet.size / 5);
  }
  const pf = (w || sl || ck.anab || ck.mov)
    ? Math.min(1, Math.min(1, w / state.goals.wat) * 0.35 + Math.min(1, sl / (state.goals.sleep || 8)) * 0.35 + (ck.anab ? 0.15 : 0) + (ck.mov ? 0.15 : 0))
    : 0;
  return { ps, pc: Math.min(1, cm / state.goals.car), pf, sets: sets.length, cm: Math.round(cm), w, sl };
}

function renderCalendar() {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + uiState.calOffset, 1);
  const y = base.getFullYear(), m = base.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = (base.getDay() + 6) % 7;
  const today = dstr();
  const tier = (p) => (p >= 1 ? 2 : p > 0 ? 1 : 0);
  const miniIcon = (k, c, st) => (st ? `<svg width="12" height="12" viewBox="0 0 24 24" style="opacity:${st === 2 ? 1 : 0.35}"><path fill="${c}" fill-rule="evenodd" d="${ICONS[k]}"/></svg>` : '');

  let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<div class="sub" style="font-size:11px">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) cells += '<i></i>';

  let perfectDays = 0, activeDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${m + 1}/${d}/${String(y).slice(2)}`;
    const info = daySummary(k);
    const s1 = tier(info.ps), s2 = tier(info.pc), s3 = tier(info.pf);
    const isPerfect = s1 + s2 + s3 === 6;
    if (s1 || s2 || s3) activeDays++;
    if (isPerfect) perfectDays++;
    cells += `<div class="cd${k === today ? ' td' : ''}${k === uiState.selectedDay ? ' sel' : ''}${isPerfect ? ' pf' : ''}" data-a="day" data-v="${k}" role="button"><span>${d}</span><div class="ic">${isPerfect ? STAR_SVG : miniIcon('h', RO, s1) + miniIcon('b', MN, s2) + miniIcon('e', LV, s3)}</div></div>`;
  }

  let dayDetail = '';
  if (uiState.selectedDay) {
    const f = daySummary(uiState.selectedDay);
    dayDetail = `<div class="m" style="margin-top:10px;font-size:13px"><b>${uiState.selectedDay}</b><br>Fuerza: ${f.sets} series (${Math.round(f.ps * 100)}%)<br>Cardio: ${f.cm} min (${Math.round(f.pc * 100)}%)<br>Agua: ${(f.w / 1000).toFixed(2)} L, sueño: ${f.sl || '-'} h (${Math.round(f.pf * 100)}%)</div>${f.sets ? `<div class="row" style="margin-top:8px"><button class="b-cy" data-a="sum" data-v="${uiState.selectedDay}">Ver resumen</button></div>` : ''}`;
  }

  const legendIcon = (k, c) => `<svg width="13" height="13" viewBox="0 0 24 24"><path fill="${c}" fill-rule="evenodd" d="${ICONS[k]}"/></svg>`;

  return `
    <div class="card" style="--ac:var(--am)">
      <div class="row" style="justify-content:space-between">
        <button data-a="mon" data-d="-1" aria-label="Mes anterior">‹</button>
        <h3 style="text-transform:capitalize;margin:0">${base.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</h3>
        <button data-a="mon" data-d="1" aria-label="Mes siguiente">›</button>
      </div>
      <div class="sub" style="margin-top:6px">${activeDays} días activos, ${perfectDays} perfectos</div>
      <div class="cal">${cells}</div>
      ${dayDetail}
      <div class="lg"><span>${legendIcon('h', RO)}Fuerza</span><span>${legendIcon('b', MN)}Cardio</span><span>${legendIcon('e', LV)}Concentración</span><span>${STAR_SVG}Día perfecto</span></div>
      <div class="sub" style="margin-top:6px;font-size:11.5px">Ícono apagado: parcial. Ícono encendido: meta del día cumplida.</div>
    </div>`;
}

function renderSummaryEntry() {
  const k = lastSessionDate();
  const sub = k ? `Última sesión: ${k} · ${sessionSummary(k).stats.exercises} ejercicios` : 'Aún sin sesiones de fuerza';
  return `<div class="hc" style="--ac:var(--cy)" data-a="sum" data-v="" role="button"><div class="hrow"><div><b>Resumen de sesión</b><div class="sub">${sub}</div></div></div></div>`;
}

export function renderSummaryView() {
  const k = uiState.sumDay || lastSessionDate();
  const sum = k ? sessionSummary(k) : null;
  if (!sum || !sum.stats.sets) {
    return backHeader('Resumen') + '<div class="card" style="--ac:var(--cy)"><div class="sub">Aún no hay series de fuerza registradas en esta fecha.</div></div>';
  }
  const diff = Math.round((parseDate(dstr()) - sum.ts) / 864e5);
  const rel = diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : diff > 1 ? `Hace ${diff} días` : 'Próximamente';
  const title = uiState.sumDay ? rel : `Última sesión · ${rel.toLowerCase()}`;
  const st = sum.stats;
  const row = (label, val) =>
    `<div class="row m" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="sub">${label}</span><span>${val}</span></div>`;
  const vol = Math.round(st.volume * 10) / 10;
  return backHeader('Resumen') + `
    <div class="card" style="--ac:var(--cy)">
      <div class="hrow"><div><b style="font-size:18px">${esc(title)}</b><div class="sub">${esc(summaryDateLabel(sum.ts))}</div></div></div>
      <div class="row" style="margin-top:10px"><button class="b-cy" style="width:100%" data-a="copysum">📋 Copiar resumen</button></div>
    </div>
    <div class="card" style="--ac:var(--am)">
      <h3>Stats</h3>
      ${row('Ejercicios completados', st.exercises)}
      ${row('Series completadas', st.sets)}
      ${row('Repeticiones totales', st.reps)}
      ${st.volume > 0 ? row('Peso total levantado', `${Number.isInteger(vol) ? vol : vol.toFixed(1)} kg`) : ''}
    </div>
    <div class="card" style="--ac:var(--mg)">
      <h3>Detalle</h3>
      ${sum.exercises.map((e, n) => `<div style="margin-top:${n ? 12 : 0}px"><b>${n + 1}. ${esc(e.ex)}</b>
        ${e.sets.map((s, i) => `<div class="row m" style="justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)"><span class="sub">Serie ${i + 1}</span><span>${s.r} reps @ ${esc(s.load)}</span></div>`).join('')}
        ${e.notes.length ? `<div class="sub" style="margin-top:4px">Notas: ${esc(e.notes.join(' · '))}</div>` : ''}</div>`).join('')}
    </div>`;
}

export function renderMoreView() {
  return `
    <div class="top"><h1>MÁS</h1><span class="m">${state.str.length} series, ${state.car.length} cardio, ${state.wt.length} pesos</span></div>
    <div class="hc" style="--ac:var(--tx)" data-a="view" data-v="prof" role="button"><div class="hrow"><div><b>Perfil</b><div class="sub">${esc(state.prof.name || 'Juan')}, estadísticas y récords</div></div><div class="av">${avatarHTML()}</div></div></div>
    ${renderCalendar()}
    ${renderSummaryEntry()}
    <div class="hc" style="--ac:var(--mg)" data-a="view" data-v="backup" role="button"><div class="hrow"><div><b>Importar / Exportar</b><div class="sub">Nube, Simple Workout Log (CSV) y Respaldo JSON</div></div></div></div>`;
}

export function renderBackupView() {
  const cloudBody = cloud.user
    ? `<div class="sub">Conectado como <b>${esc(cloud.user.email)}</b>. Subir reemplaza tu respaldo en la nube; descargar lo fusiona con tus datos locales.</div>
      <div class="row" style="margin-top:8px"><button class="b-cy" data-a="cloudpush">☁️ Subir a la nube</button><button class="b-am" data-a="cloudpull">📥 Descargar respaldo</button></div>`
    : `<div class="sub">Inicia sesión para subir o descargar tu respaldo en la nube.</div>
      <div class="row" style="margin-top:8px"><button class="b-cy" data-a="view" data-v="prof">Iniciar sesión en Perfil</button></div>`;
  return backHeader('Importar / Exportar') + `
    <div class="card" style="--ac:var(--mg)">
      <h3>Respaldo en la Nube</h3>
      ${cloudBody}
    </div>
    <div class="card" style="--ac:var(--cy)">
      <h3>Simple Workout Log (CSV)</h3>
      <div class="sub">Importar y exportar en el formato original de 3 bloques: fuerza, cardio y peso.</div>
      <div class="row" style="margin-top:8px"><button class="b-cy" data-a="exp">Exportar CSV</button></div>
      <input type="file" accept=".csv,.txt,text/csv" data-c="file" style="margin-top:8px;width:100%" aria-label="Importar CSV">
    </div>
    <div class="card" style="--ac:var(--am)">
      <h3>Respaldo Leonida (JSON)</h3>
      <div class="sub">Todo lo de la app: ejercicios, cardio, peso, agua, sueño, checks, rutinas, metas y perfil.</div>
      <div class="row" style="margin-top:8px"><button class="b-am" data-a="expfull">Exportar respaldo</button></div>
      <input type="file" accept=".json,application/json" data-c="backup" style="margin-top:8px;width:100%" aria-label="Restaurar respaldo">
    </div>`;
}
