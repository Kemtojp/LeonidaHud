/* ==========================================================================
   views/train.js — Rutinas, Catálogo de Ejercicios y Registro de Series
   ========================================================================== */

import {
  state, uiState, BANDS, BAND_COLORS, dstr, tstr, parseDate, two, esc,
  bandOf, cleanNotes, formatLoad, formatSet, loadRank
} from '../store.js';
import { allExercises, matchRoutine, lastSession, detectPlateau } from '../domain.js';
import { backHeader, sparkline } from '../ui.js';

const daysAgo = (d) => {
  if (!d) return 'Nunca';
  const n = Math.round((parseDate(dstr()) - parseDate(d)) / 864e5);
  return n <= 0 ? 'Hoy' : n === 1 ? 'Ayer' : n < 14 ? `${n} días` : n < 60 ? `${Math.round(n / 7)} semanas` : n < 365 ? `${Math.round(n / 30)} meses` : `${Math.round(n / 365)} año(s)`;
};

const lastDateFor = (pred) => {
  const found = state.str.find(pred);
  return found ? found.d : null;
};

const rowHTML = (title, sub, action, val) =>
  `<div class="rw" data-a="${action}" data-v="${esc(val)}"><b>${esc(title)}</b><span class="sub">${sub}</span></div>`;

const plateauBadge = (ex) =>
  detectPlateau(ex) ? '<span style="color:var(--am);font-weight:600;margin-left:6px">⚡ Subir</span>' : '';

export function renderTrainView() {
  const openR = uiState.openRoutine;
  if (openR) {
    const exList = state.rts[openR] || [];
    const remaining = allExercises().filter((e) => !exList.includes(e));
    const subtitle = (e) => `Última vez: ${daysAgo(lastDateFor((s) => s.ex === e))}${plateauBadge(e)}`;

    let html = backHeader(openR) +
      `<div class="row" style="margin-bottom:10px">${[[0, 'RUTINA'], [1, 'EDITAR']]
        .map(([k, l]) => `<button class="${(uiState.editRoutine ? 1 : 0) === k ? 'on' : ''}" data-a="rtab" data-v="${k}">${l}</button>`)
        .join('')}</div>`;

    if (!uiState.editRoutine) {
      return html + exList.map((e) => rowHTML(e, subtitle(e), 'openex', e)).join('') +
        (exList.length
          ? `<button class="b-cy fab" data-a="openex" data-v="${esc(exList[0])}">▶ Empezar</button>`
          : '<div class="sub" style="padding:12px 0">Rutina vacía. Usa EDITAR para agregar ejercicios.</div>');
    }

    return html +
      exList.map((e, i) => `
        <div class="rr">
          <div class="rw"><b>${esc(e)}</b><span class="sub">${subtitle(e)}</span></div>
          <button data-a="mvex" data-i="${i}" data-d="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''} style="min-width:36px;padding:4px 8px;opacity:${i === 0 ? 0.35 : 1}">▴</button>
          <button data-a="mvex" data-i="${i}" data-d="1" aria-label="Bajar" ${i === exList.length - 1 ? 'disabled' : ''} style="min-width:36px;padding:4px 8px;opacity:${i === exList.length - 1 ? 0.35 : 1}">▾</button>
          <button data-a="rmex" data-i="${i}" aria-label="Quitar de la rutina">✕</button>
        </div>`).join('') +
      `<div class="card" style="--ac:var(--cy);margin-top:14px"><h3>Agregar ejercicio</h3><div class="row"><select id="ax" style="flex:1;min-width:0">${remaining.map((e) => `<option>${esc(e)}</option>`).join('')}</select><button data-a="adr">Agregar</button></div></div>
       <div class="card" style="--ac:var(--cy)"><h3>Renombrar rutina</h3><div class="row"><input id="rn" value="${esc(openR)}" style="flex:1;min-width:0"><button data-a="rnr">Guardar</button></div></div>
       <div class="card" style="--ac:var(--mg)"><button class="b-mg" data-a="delr">${uiState.confirmDel === 'r' ? 'Confirmar: eliminar rutina' : 'Eliminar rutina'}</button></div>`;
  }

  return `${backHeader('Rutinas')}<div class="sub" style="margin-bottom:6px">Rutina de hoy: ${esc(matchRoutine(dstr(), state.rt) || state.rt)}</div>` +
    Object.keys(state.rts).map((k) => rowHTML(k, `Última vez: ${daysAgo(lastDateFor((s) => (state.rts[k] || []).includes(s.ex)))}`, 'openr', k)).join('') +
    `<div class="row" style="margin-top:12px"><input id="nrn" placeholder="Nueva rutina" style="flex:1;min-width:0"><button class="b-cy" data-a="newr">Crear</button></div>`;
}

export function renderExercisesView() {
  const list = allExercises();
  return `
    <div class="top"><h1>EJERCICIOS</h1><span class="m">${list.length}</span></div>
    <input data-c="flt" placeholder="Filtrar" style="width:100%;margin-bottom:6px">
    ${uiState.newExOpen ? `<div class="card" style="--ac:var(--cy);margin-top:8px"><h3>Nuevo ejercicio</h3><div class="row"><input id="nex" placeholder="Nombre del ejercicio" autocomplete="off" style="flex:1;min-width:0"><button class="b-cy" data-a="addex">Agregar</button><button data-a="nx" aria-label="Cerrar">✕</button></div></div>` : ''}
    <div id="exl">${list.map((e) => `
      <div class="rr">
        ${rowHTML(e, `Última vez: ${daysAgo(lastDateFor((s) => s.ex === e))}`, 'openex', e)}
        ${uiState.confirmDel === `l:${e}`
          ? `<button class="b-mg" style="min-width:72px" data-a="dlx" data-v="${esc(e)}">Borrar</button>`
          : `<button data-a="dlx" data-v="${esc(e)}" aria-label="Borrar ${esc(e)}">✕</button>`}
      </div>`).join('')}
    </div>
    <button class="b-cy fab-c" data-a="nx" aria-label="Nuevo ejercicio"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>`;
}

export function renderExerciseDetailView() {
  const X = uiState.exercise;
  const ex = X.ex;
  const t = dstr();
  const allSets = state.str.filter((s) => s.ex === ex);

  let html = backHeader(ex) +
    `<div class="row" style="margin-bottom:10px">${[['new', 'NUEVO'], ['hist', 'HISTORIAL'], ['graph', 'GRÁFICO'], ['edit', 'EDITAR']]
      .map(([k, l]) => `<button class="${X.sub === k ? 'on' : ''}" data-a="sub" data-v="${k}">${l}</button>`)
      .join('')}</div>`;

  if (X.sub === 'new') {
    const prev = lastSession(ex);
    let hint = 'Sin historial previo', target = '', defaultW = '', defaultBand = '';
    if (prev) {
      const top = prev.sets.reduce((a, s) => (loadRank(s) > loadRank(a) || (loadRank(s) === loadRank(a) && s.r > a.r) ? s : a));
      const maxReps = Math.max(...prev.sets.filter((s) => loadRank(s) === loadRank(top)).map((s) => s.r));
      hint = `Última vez (${prev.d}): ${prev.sets.map(formatSet).join(', ')}`;
      target = `Meta: ${formatLoad(top)} × ${maxReps + 1}`;
      defaultW = top.w;
      defaultBand = bandOf(top.n);
    }

    const pl = detectPlateau(ex);
    const editSet = uiState.editing && uiState.editing.k === 'set' ? state.str[uiState.editing.i] : null;
    const band = X.b != null ? X.b : (editSet ? bandOf(editSet.n) : defaultBand);
    const kgVal = band ? '' : ((editSet ? editSet.w : (X.w != null ? X.w : defaultW)) || '');
    const todaySets = [];
    state.str.forEach((s, i) => { if (s.ex === ex && s.d === t) todaySets.push([s, i]); });

    html += `
      <div class="card" style="--ac:var(--cy)">
        <div class="sub m">${t} ${tstr()}</div>
        <div class="lt m">${esc(hint)}</div>
        <div class="tg m">${target}</div>
        ${pl ? `<div style="margin:6px 0 8px;padding:8px 10px;border:1px solid var(--am);border-radius:10px;color:var(--am);font-size:13px;font-weight:600">⚡ HORA DE PROGRESAR: Llevas ${pl.n} sesiones igual (${formatSet(pl.s)}). ${pl.s.w > 0 ? 'Sube peso (+1.25 kg)' : bandOf(pl.s.n) ? 'Sube de banda' : 'Saca +1 rep hoy.'}${pl.s.w > 0 || bandOf(pl.s.n) ? ' o saca +1 rep hoy.' : ''}</div>` : ''}
        <div class="stp"><span>REPS</span><input id="nr" type="number" inputmode="numeric" min="0" value="${editSet ? editSet.r : (X.r || '')}"><button data-a="step" data-f="nr" data-d="-1" aria-label="Menos">▾</button><button data-a="step" data-f="nr" data-d="1" aria-label="Más">▴</button></div>
        <div class="stp"><span>KG</span><input id="nw" type="number" inputmode="decimal" step=".25" min="0" value="${kgVal}"><button data-a="step" data-f="nw" data-d="-1" aria-label="Menos">▾</button><button data-a="step" data-f="nw" data-d="1" aria-label="Más">▴</button></div>
        <div class="chips"><button class="chip ${!band && !(kgVal > 0) ? 'on' : ''}" data-a="chip" data-v="">PC</button>${BANDS.map((b) => `<button class="chip ${band === b ? 'on' : ''}" style="--bc:${BAND_COLORS[b]}" data-a="chip" data-v="${b}">${b}</button>`).join('')}</div>
        <div class="row" style="gap:6px"><input id="nn" placeholder="Notas" value="${esc(editSet ? cleanNotes(editSet.n) : '')}" style="flex:1;min-width:0"><button class="b-cy" data-a="add">${editSet ? 'Guardar' : '+ Serie'}</button>${editSet ? '<button data-a="ecancel">✕</button>' : ''}</div>
      </div>
      <div class="row sub" style="margin-bottom:6px;gap:6px">Descanso:${[90, 120, 150, 180].map((n) => `<button class="${state.rest === n ? 'on' : ''}" style="--ac:var(--mg);min-height:30px;padding:3px 8px;font-size:13px" data-a="rs" data-v="${n}">${Math.floor(n / 60)}:${two(n % 60)}</button>`).join('')}</div>
      <h3>COMPLETADO</h3>
      ${todaySets.map(([s, i], k) => `<div class="row m" data-gk="s${i}" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>SET ${k + 1}: ${s.r} REPS @ ${formatLoad(s)}${cleanNotes(s.n) ? '<br><span class="sub">' + esc(cleanNotes(s.n)) + '</span>' : ''}</span><span><button data-a="eset" data-i="${i}" aria-label="Editar">✎</button> <button data-a="del" data-i="${i}" aria-label="Borrar">✕</button></span></div>`).join('') || '<div class="sub">Aún sin series hoy</div>'}
      <button class="b-cy fab-c" data-a="fin" aria-label="Terminar ejercicio"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></button>`;
  } else if (X.sub === 'hist') {
    const grouped = {};
    state.str.forEach((s, i) => { if (s.ex === ex) (grouped[s.d] = grouped[s.d] || []).push([s, i]); });
    html += Object.keys(grouped).map((d) => `
      <div class="card" style="--ac:var(--cy)">
        <h3 class="m">${d} <span class="sub">${grouped[d][0][0].t}</span></h3>
        ${grouped[d].map(([s, i], k) => `<div class="row m" style="justify-content:space-between"><span>SET ${k + 1}: ${s.r} REPS @ ${formatLoad(s)}${cleanNotes(s.n) ? ' <span class="sub">' + esc(cleanNotes(s.n)) + '</span>' : ''}</span><span><button data-a="eset" data-i="${i}" aria-label="Editar">✎</button> <button data-a="del" data-i="${i}" aria-label="Borrar">✕</button></span></div>`).join('')}
      </div>`).join('') || '<div class="sub">Sin historial</div>';
  } else if (X.sub === 'edit') {
    html += `
      <div class="card" style="--ac:var(--cy)"><h3>Renombrar</h3><div class="row"><input id="en" value="${esc(ex)}" style="flex:1;min-width:0"><button class="b-cy" data-a="rnx">Guardar</button></div></div>
      <div class="card" style="--ac:var(--mg)"><h3>Eliminar ejercicio</h3><div class="sub">Se quita de las rutinas y se borran sus ${allSets.length} series del historial.</div><button class="b-mg" style="margin-top:8px" data-a="delx">${uiState.confirmDel === 'x' ? 'Confirmar: borrar todo' : 'Eliminar'}</button></div>`;
  } else {
    const gm = X.gm || 'w', gr = X.gr || '90';
    const limit = gr === 'all' ? 0 : Date.now() - gr * 864e5;
    const byDay = {};
    allSets.forEach((s) => { if (parseDate(s.d) >= limit) (byDay[s.d] = byDay[s.d] || []).push(s); });
    const days = Object.keys(byDay).sort((a, b) => parseDate(a) - parseDate(b));
    const metricFn = {
      w: (a) => Math.max(...a.map((s) => s.w)),
      e: (a) => Math.max(...a.map((s) => (s.w > 0 ? s.w * (1 + s.r / 30) : s.r))),
      r: (a) => Math.max(...a.map((s) => s.r)),
      v: (a) => a.reduce((x, s) => x + s.r * s.w, 0)
    }[gm];
    const vals = days.map((d) => +metricFn(byDay[d]).toFixed(1));
    const opt = (val, cur, lbl) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${lbl}</option>`;
    html += `
      <div class="row" style="margin-bottom:8px">
        <select data-c="gm" style="flex:1">${opt('w', gm, 'Peso máx')}${opt('e', gm, '1RM estimado')}${opt('r', gm, 'Reps máx')}${opt('v', gm, 'Volumen (reps×kg)')}</select>
        <select data-c="gr">${opt('30', gr, '30 días')}${opt('90', gr, '90 días')}${opt('365', gr, '1 año')}${opt('all', gr, 'Todo')}</select>
      </div>
      <div class="card" style="--ac:var(--cy)">
        ${sparkline(vals, '#f2b8cc')}
        <div class="row m sub" style="justify-content:space-between"><span>${days[0] || ''}</span><span>${days[days.length - 1] || ''}</span></div>
        ${vals.length ? `<div class="m">Mejor: ${Math.max(...vals)}</div>` : ''}
      </div>`;
  }

  return html;
}
