/* ==========================================================================
   views/wellness.js — Vistas de Cardio y Concentración (Agua, Sueño, Checks)
   ========================================================================== */

import { state, uiState, dstr, esc } from '../store.js';
import { getDailyProgress, sleepSummary } from '../domain.js';
import { backHeader, barHTML } from '../ui.js';

function cardioButtonsEditor() {
  const idx = uiState.carPanel.i;
  const item = idx >= 0 ? state.carBtns[idx] : { l: '', x: '', m: '', n: '' };
  return `
    <div class="card" style="--ac:var(--mg);margin-top:10px">
      <h3>Atajos de cardio</h3>
      ${state.carBtns.map((c, k) => `<div class="row m" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(c.l)}<br><span class="sub">${esc(c.x)} · ${c.m} min${c.n ? ' · ' + esc(c.n) : ''}</span></span><span><button data-a="cbe" data-i="${k}" aria-label="Modificar">✎</button> <button data-a="cbd" data-i="${k}" aria-label="Eliminar">✕</button></span></div>`).join('')}
      <div class="sub" style="margin:10px 0 6px">${idx >= 0 ? 'Modificar atajo' : 'Nuevo atajo'}</div>
      <input id="cbl" placeholder="Etiqueta (ej. +30 Correr)" value="${esc(item.l)}" style="width:100%;margin-bottom:6px">
      <input id="cbx" placeholder="Actividad" value="${esc(item.x)}" style="width:100%;margin-bottom:6px">
      <div class="stp"><span>MIN</span><input id="cbm" type="number" inputmode="numeric" min="1" value="${item.m}"></div>
      <input id="cbn" placeholder="Nota (opcional)" value="${esc(item.n)}" style="width:100%;margin-bottom:8px">
      <div class="row"><button class="b-mg" style="flex:1" data-a="cbs">${idx >= 0 ? 'Actualizar' : '+ Agregar'}</button>${idx >= 0 ? '<button data-a="cbk">Cancelar</button>' : ''}<button data-a="cbc">Cerrar</button></div>
    </div>`;
}

export function renderCardioView() {
  const P = getDailyProgress();
  const editCar = uiState.editing && uiState.editing.k === 'car' ? state.car[uiState.editing.i] : null;
  const rpeMatch = editCar && /RPE (\d+)/.exec(editCar.n);
  const activities = [...new Set(['Bicicleta', 'Boxeo', 'Caminata', 'Correr', ...state.car.map((c) => c.ex)])];
  const curAct = editCar ? editCar.ex : 'Bicicleta';

  return backHeader('Cardio') + `
    <div class="card" style="--ac:var(--mg)">
      <div class="row" style="justify-content:space-between">
        <span class="m">Hoy: <b>${Math.round(P.cm)}</b> / <input data-c="gcar" type="number" value="${state.goals.car}" style="width:62px;min-height:30px;padding:2px 6px;text-align:center" aria-label="Meta de minutos"> min</span>
        <span class="sub m">${Math.min(100, Math.round(P.car * 100))}%</span>
      </div>
    </div>
    <div class="card" style="--ac:var(--mg)">
      <h3>${editCar ? 'Editar registro' : 'Nuevo registro'}</h3>
      <input id="cx" list="cl" placeholder="Actividad" value="${esc(curAct)}" style="width:100%">
      <datalist id="cl">${activities.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="chips">${activities.map((n) => `<button class="chip ${n === curAct ? 'on' : ''}" style="--bc:var(--mg)" data-a="cact" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="row" style="gap:6px;margin:5px 0">
        <div class="stp" style="flex:2;margin:0"><span style="width:30px">MIN</span><input id="cm" type="number" inputmode="numeric" value="${editCar ? Math.round(editCar.dur / 60) : ''}"><button data-a="step" data-f="cm" data-d="-5" aria-label="Menos" style="width:36px">▾</button><button data-a="step" data-f="cm" data-d="5" aria-label="Más" style="width:36px">▴</button></div>
        <div class="stp" style="flex:1;margin:0"><span style="width:28px">RPE</span><select id="cr" style="flex:1;min-width:0;padding:4px"><option value="">-</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option ${rpeMatch && rpeMatch[1] == n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <div class="row" style="gap:6px;margin-top:6px">
        <input id="cn" placeholder="Notas" value="${esc(editCar ? editCar.n.replace(/(\s*·\s*)?RPE \d+/, '') : '')}" style="flex:1;min-width:0">
        <button class="b-mg" data-a="carsave">${editCar ? 'Guardar' : '+ Registrar'}</button>
        ${editCar ? '<button data-a="ecancel">✕</button>' : ''}
      </div>
    </div>
    <div class="row" style="gap:6px">
      ${state.carBtns.map((c) => `<button data-a="car" data-m="${c.m}" data-x="${esc(c.x)}" data-n="${esc(c.n)}" style="padding:6px 10px;font-size:13.5px">${esc(c.l)}</button>`).join('')}
      <button class="${uiState.carPanel ? 'on' : ''}" style="--ac:var(--mg);padding:6px 10px" data-a="cbt" aria-label="Editar atajos">✎</button>
    </div>
    ${uiState.carPanel ? cardioButtonsEditor() : ''}
    <h3 style="margin:10px 0 4px">Registros</h3>
    ${state.car.slice(0, 15).map((c, i) => `<div class="row m" data-gk="c${i}" style="justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line);font-size:13.5px"><span>${c.d} ${esc(c.ex)} ${Math.round(c.dur / 60)} min${c.n ? ' <span class="sub">· ' + esc(c.n) + '</span>' : ''}</span><span><button data-a="ecar" data-i="${i}" aria-label="Editar" style="padding:4px 8px">✎</button> <button data-a="dcar" data-i="${i}" aria-label="Borrar" style="padding:4px 8px">✕</button></span></div>`).join('') || '<div class="sub">Sin registros</div>'}`;
}

function waterButtonsEditor() {
  const idx = uiState.watPanel.i;
  return `
    <div class="card" style="--ac:var(--am);margin-top:10px">
      <h3>Atajos de agua</h3>
      ${state.watBtns.map((v, k) => `<div class="row m" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${v > 0 ? '+' : ''}${v} ml</span><span><button data-a="wbe" data-i="${k}" aria-label="Modificar">✎</button> <button data-a="wbd" data-i="${k}" aria-label="Eliminar">✕</button></span></div>`).join('')}
      <div class="sub" style="margin:10px 0 6px">${idx >= 0 ? 'Modificar cantidad' : 'Nueva cantidad'}</div>
      <div class="stp"><span>ML</span><input id="wbv" type="number" inputmode="numeric" min="1" value="${uiState.watPanel.v}"><button class="${uiState.watPanel.s > 0 ? 'on' : ''}" style="--ac:var(--am)" data-a="wbs" data-v="1" aria-label="Sumar">+</button><button class="${uiState.watPanel.s < 0 ? 'on' : ''}" style="--ac:var(--am)" data-a="wbs" data-v="-1" aria-label="Restar">−</button></div>
      <div class="row"><button class="b-am" style="flex:1" data-a="wbsv">${idx >= 0 ? 'Actualizar' : '+ Agregar'}</button>${idx >= 0 ? '<button data-a="wbk">Cancelar</button>' : ''}<button data-a="wbc">Cerrar</button></div>
    </div>`;
}

export function renderFocusView() {
  const P = getDailyProgress();
  const ck = P.ck;
  const h = state.sleep[dstr()] || 0;
  const sl = !h ? null : h < 5.5 ? ['Agotado', 'te falta dormir bastante'] : h < 7 ? ['Cansado', 'te falta dormir'] : h <= 9 ? ['Descansado', 'buen sueño'] : ['Dormiste de más', 'más de 9 h puede dejarte lento'];
  const sd = sleepSummary();

  return backHeader('Concentración') + `
    <div class="card" style="--ac:var(--am)">
      <h3>Agua</h3>
      <div class="big m" data-gk="water">${(P.w / 1000).toFixed(2)} L</div>
      ${barHTML('wat', Math.min(1, P.w / state.goals.wat) * 100)}
      <div class="row" style="margin-top:8px">
        ${state.watBtns.map((v) => `<button class="${v > 0 ? 'b-am' : ''}" data-a="water" data-v="${v}">${v > 0 ? '+' : ''}${v}</button>`).join('')}
        <button class="${uiState.watPanel ? 'on' : ''}" style="--ac:var(--am)" data-a="wbt" aria-label="Editar atajos">✎</button>
      </div>
      ${uiState.watPanel ? waterButtonsEditor() : ''}
      <div class="stp"><span>OTRA</span><input id="wc" type="number" inputmode="numeric" placeholder="ml"><button style="width:80px" data-a="wadd">Sumar</button></div>
      <div class="stp"><span>HOY</span><input data-c="wtot" type="number" value="${P.w}" aria-label="Total de hoy en ml"><span>ml</span></div>
      <div class="stp"><span>META</span><input data-c="gwat" type="number" step=".1" value="${state.goals.wat / 1000}" aria-label="Meta en litros"><span>litros</span></div>
    </div>
    <div class="card" style="--ac:var(--am)">
      <h3>Recuperación</h3>
      <div class="sub" style="margin-bottom:8px">Márcalos cuando los cumplas: cada uno suma 15% al anillo y se reinician cada día.</div>
      <div class="row">
        <button class="${ck.anab ? 'on' : ''}" style="--ac:var(--am)" data-a="chk" data-k="anab">Ventana anabólica</button>
        <button class="${ck.mov ? 'on' : ''}" style="--ac:var(--am)" data-a="chk" data-k="mov">Movilidad</button>
      </div>
    </div>
    <div class="card" style="--ac:var(--am)">
      <h3>Sueño</h3>
      <div class="big m">${h ? h + ' h' : '--'}</div>
      <div style="color:${sl && (h < 7 || h > 9) ? 'var(--cy)' : 'var(--mg)'}">${sl ? `${sl[0]}: ${sl[1]}` : 'Registra cuánto dormiste anoche'}</div>
      <div class="row" style="margin-top:8px">${[5, 6, 7, 8, 9].map((n) => `<button class="${h === n ? 'on' : ''}" style="--ac:var(--am)" data-a="sl" data-v="${n}">${n} h</button>`).join('')}</div>
      <div class="stp"><span>HORAS</span><input data-c="sleep" type="number" inputmode="decimal" step=".25" value="${h || ''}" aria-label="Horas dormidas"><span>exacto</span></div>
      <div class="stp"><span>META</span><input data-c="gsleep" type="number" step=".5" value="${state.goals.sleep || 8}" aria-label="Meta de sueño"><span>horas</span></div>
      <div class="sub" style="margin-top:6px">Últimos 7 días</div>
      <div style="display:flex;gap:4px">${sd.b}</div>
      <div class="sub m" style="margin-top:6px">${sd.n ? `Promedio ${sd.avg} h. ${sd.debt >= 1 ? `Deuda de sueño: ${sd.debt} h esta semana.` : sd.debt <= -1 ? `Vas con ${-sd.debt} h de ventaja.` : 'Vas al día.'}` : 'Aún sin datos de la semana'}</div>
    </div>`;
}
