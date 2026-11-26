/* ==========================================================================
   views/hud.js — Pantalla Principal (Inicio / Character HUD)
   ========================================================================== */

import { state, dstr, esc } from '../store.js';
import {
  levelOf, getDailyProgress, weightTrendInfo, recompSummary,
  bioTrend, evaluateCharacterStatus
} from '../domain.js';
import { PR, barHTML } from '../ui.js';

const RO = '#f2b8cc', MN = '#8de8c6', LV = '#b896f5';
const ICONS = {
  h: 'M12 21s-7-4.4-9.3-8.6C1 9 3 5.5 6.4 5.5c2 0 3.6 1.1 4.4 2.6.8-1.5 2.4-2.6 4.4-2.6 3.4 0 5.4 3.5 3.7 6.9C19 16.6 12 21 12 21z',
  b: 'M13 2L5 14h6l-1 8 8-12h-6z',
  e: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 3a4 4 0 110 8 4 4 0 010-8z'
};

export function avatarHTML() {
  const p = state.prof;
  const ini = (p.name || 'Juan').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  return p.avatar ? `<img src="${p.avatar}" alt="">` : esc(ini);
}

function ringSVG(p, color, key) {
  const C = 2 * Math.PI * 34;
  return `<svg class="rg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="34" fill="none" stroke="#2a2f3a" stroke-width="6"/>
    <circle class="arc" cx="50" cy="50" r="34" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - (PR[key] || 0))}" data-o="${C * (1 - p)}" data-k="${key}" data-p="${p}"/>
    <path transform="translate(38 38)" fill="${color}" fill-rule="evenodd" d="${ICONS[key]}"/>
  </svg>`;
}

function hudCard(key, title, p, color, action, val, hasWindow) {
  return `<div class="hc" style="--ac:${color}" data-a="${action}" data-v="${val}" role="button">
    <div class="hrow"><div><b>${title}</b><div class="sub">Nivel ${levelOf(p)}/4</div></div>${ringSVG(p, color, key)}</div>
    ${hasWindow ? `<div class="win"><span>Ventana de rutina</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h12v5l-4 5 4 5v5H6v-5l4-5-4-5z"/></svg>${barHTML('b' + key, p * 100)}</div>` : ''}
  </div>`;
}

function recompSummaryLine(rc) {
  const bt = bioTrend();
  if (!bt) return `Musculatura: ${rc.m} · Grasa: ${rc.g}`;
  const label = (d, th) => (d == null ? '' : ` (${d > th ? 'Subiendo' : d < -th ? 'Bajando' : 'Estable'})`);
  return `Músculo: ${bt.mm.toFixed(1)} kg${label(bt.dm, 0.2)} · Grasa: ${bt.bf.toFixed(1)}%${label(bt.df, 0.3)}`;
}

export function renderHudView() {
  const status = evaluateCharacterStatus();
  const rc = recompSummary();
  const rate = weightTrendInfo().rate;
  const P = getDailyProgress();
  const latestW = [...state.wt].sort((a, b) => a.d.localeCompare(b.d)).pop();
  const goalW = state.prof.goal;
  const balText = rate == null ? 'Registra tu peso para calcular' : rate < -0.15 ? 'Perderás peso' : rate > 0.15 ? 'Ganarás peso' : 'Mantendrás el peso actual';
  const rateLabel = rate == null ? 'Calibrando con tus pesajes' : `${rate > 0 ? '+' : ''}${rate.toFixed(1)} kg/sem estimado`;

  return `
    <div class="hdr">
      <div class="who" data-a="view" data-v="prof" style="cursor:pointer">
        <b>${esc(state.prof.name || 'Juan')}</b>
        <span style="color:${status.c}">${status.e}</span>
        <div class="sub">${esc(status.why)}</div>
      </div>
      <div class="av" style="border-color:${status.c}" data-a="view" data-v="prof" role="button" aria-label="Perfil">${avatarHTML()}</div>
    </div>
    <div class="sub" style="margin:16px 0 8px">Fitness</div>
    ${hudCard('h', 'Fuerza', P.str, RO, 'goto', 'train', true)}
    ${hudCard('b', 'Cardio', P.car, MN, 'view', 'car', true)}
    ${hudCard('e', 'Concentración', P.foc, LV, 'view', 'foc', false)}
    <div class="sub" style="margin:16px 0 8px">Cuerpo y nutrición</div>
    <div class="hc" style="--ac:var(--tx)" data-a="view" data-v="body">
      <b>Recomposición</b>
      <div class="m">${latestW ? latestW.w.toFixed(1) + ' kg' : '--'} → ${goalW ? (+goalW).toFixed(1) + ' kg' : 'sin meta'}</div>
      <div class="sub">${recompSummaryLine(rc)}</div>
    </div>
    <div class="hc" style="--ac:var(--tx)" data-a="view" data-v="nutri">
      <b>Balance calórico</b>
      <div>${balText}</div>
      <div class="sub">${rateLabel}</div>
      <div class="sub">Proteína: ${state.nut.prot[dstr()] || 0} / ${state.nut.goal} g</div>
    </div>`;
}
