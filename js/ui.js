/* ==========================================================================
   ui.js — Motor Incremental morph(), Audio, Vibración, Toasts y Timer #rest
   ========================================================================== */

import { state, two, esc } from './store.js';

export const $ = (s) => document.querySelector(s);

export const PR = {}; // Progreso previo de barras/anillos para animaciones suaves
let glowKey = null;
export const setGlow = (k) => { glowKey = k; };
export const consumeGlow = () => { const k = glowKey; glowKey = null; return k; };

export const barHTML = (k, p) =>
  `<div class="bar"><i style="width:${PR[k] || 0}%" data-w="${p}" data-k="${k}"></i></div>`;

export const backHeader = (title) =>
  `<div class="top"><div class="row"><button data-a="back" aria-label="Volver">←</button><h1>${esc(title)}</h1></div></div>`;

export function sparkline(vals, color, w = 300, h = 70) {
  if (vals.length < 2) return '<div class="sub">Faltan datos</div>';
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const range = mx - mn || 1;
  const pts = vals.map(
    (y, i) => `${((i / (vals.length - 1)) * (w - 16) + 8).toFixed(1)},${(h - 8 - ((y - mn) / range) * (h - 16)).toFixed(1)}`
  );
  const lastPt = pts[pts.length - 1].split(',');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="4" fill="${color}"/>
    <text x="8" y="12" fill="#7a879f" font-size="10">${mx}</text>
    <text x="8" y="${h - 1}" fill="#7a879f" font-size="10">${mn}</text>
  </svg>`;
}

export const vib = (pattern = 15) => {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {}
};

let audioCtx;
export function beep(freqs = [880], dur = 0.13) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((fr, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime + i * dur;
      osc.type = 'square';
      osc.frequency.value = fr;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur);
    });
  } catch (e) {}
}

// Copia al portapapeles: API moderna y, si falla (WebView/APK, http), textarea temporal + execCommand
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch (e) {
    return false;
  }
}

export function toast(title, sub, color = 'var(--cy)') {
  const div = document.createElement('div');
  div.className = 'lvl';
  div.style.setProperty('--ac', color);
  div.innerHTML = `${esc(title)}<small>${esc(sub)}</small>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2900);
}

/* ---------- Temporizador de Descanso ---------- */
let restTimer = null;
let restInterval = null;

export function startRest() {
  restTimer = { end: Date.now() + state.rest * 1000, tot: state.rest };
  const el = $('#rest');
  el.innerHTML = `
    <svg viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#1a2232" stroke-width="5"/>
      <circle id="rc" cx="25" cy="25" r="20" fill="none" stroke="#8de8c6" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 20}" stroke-dashoffset="0" transform="rotate(-90 25 25)"/>
    </svg>
    <span class="big m" id="rt"></span>
    <span class="sub" style="flex:1">Descanso</span>
    <button data-a="rm">-15</button>
    <button data-a="rp">+15</button>
    <button data-a="skip">Saltar</button>`;
  el.style.display = 'flex';
  clearInterval(restInterval);
  restInterval = setInterval(tickRest, 250);
  tickRest();
}

export function adjustRest(deltaSec) {
  if (!restTimer) return;
  restTimer.end += deltaSec * 1000;
  restTimer.tot = Math.max(15, restTimer.tot + deltaSec);
}

export function stopRest() {
  restTimer = null;
  clearInterval(restInterval);
  const el = $('#rest');
  if (el) el.style.display = 'none';
}

function tickRest() {
  if (!restTimer) { clearInterval(restInterval); return; }
  const left = Math.ceil((restTimer.end - Date.now()) / 1000);
  if (left <= 0) {
    stopRest();
    beep([880, 880, 1175]);
    vib([200, 100, 200]);
    toast('A LA SIGUIENTE SERIE', 'Descanso terminado', 'var(--mg)');
    return;
  }
  const rc = $('#rc'), rt = $('#rt');
  if (rc) rc.style.strokeDashoffset = 2 * Math.PI * 20 * (1 - left / restTimer.tot);
  if (rt) rt.textContent = `${Math.floor(left / 60)}:${two(left % 60)}`;
}

/* ---------- Motor DOM Incremental morph() ---------- */
export function morph(a, b) {
  const ac = [...a.childNodes];
  const bc = [...b.childNodes];
  bc.forEach((n, i) => {
    const o = ac[i];
    if (!o) { a.appendChild(n); return; }
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) { a.replaceChild(n, o); return; }
    if (n.nodeType !== 1) {
      if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
      return;
    }
    const isAnimated = o.matches('.arc,.bar i[data-w]');
    [...o.attributes].forEach((t) => {
      if (!n.hasAttribute(t.name) && !(isAnimated && t.name === 'style')) o.removeAttribute(t.name);
    });
    [...n.attributes].forEach((t) => {
      if (isAnimated && t.name === 'style') return;
      if (o.getAttribute(t.name) !== t.value) o.setAttribute(t.name, t.value);
    });
    if (isAnimated) {
      if (o.classList.contains('arc')) {
        o.style.strokeDashoffset = o.dataset.o;
        PR[o.dataset.k] = +o.dataset.p;
      } else {
        o.style.width = o.dataset.w + '%';
        PR[o.dataset.k] = +o.dataset.w;
      }
    }
    morph(o, n);
    if (o.tagName === 'SELECT') o.value = n.value;
    else if (o.tagName === 'INPUT' && document.activeElement !== o && o.value !== n.value) o.value = n.value;
  });
  while (a.childNodes.length > bc.length) a.removeChild(a.lastChild);
}

export function patch(el, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  morph(el, t.content);
}
