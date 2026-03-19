/**
 * ui.js — DOM manipulation: loading overlay, tooltip, panel, legend,
 *          share button, toast, mobile legend sheet.
 */

import { HIERARCHY_LABELS } from './config.js';
import { esc, formatDate }  from './utils.js';

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------
   1. LOADING OVERLAY
   ------------------------------------------------------------------ */

export function stageActive(key) {
  const el = $(`stage-${key}`);
  el?.classList.add('is-active');
  el?.classList.remove('is-done');
}

export function stageDone(key) {
  const el  = $(`stage-${key}`);
  const bar = $(`bar-${key}`);
  if (!el || !bar) return;
  bar.style.width = '100%';
  bar.classList.add('has-progress');
  el.classList.remove('is-active');
  el.classList.add('is-done');
}

export function stageProgress(key, value) {
  const bar = $(`bar-${key}`);
  if (!bar) return;
  if (value > 0) {
    bar.classList.add('has-progress');
    bar.style.width = `${Math.round(value * 100)}%`;
  }
}

export function hideLoader() {
  const overlay = $('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('is-hidden');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

/* ------------------------------------------------------------------
   2. TOOLTIP
   ------------------------------------------------------------------ */

const TOOLTIP_OFFSET = 18;
const TOOLTIP_MARGIN = 12;
let   tooltipHidden  = true;

/**
 * @param {null | { point: {x,y}, name: string, subtitle: string|null }} data
 */
export function updateTooltip(data) {
  const el = $('tooltip');
  if (!el) return;

  if (!data || !data.subtitle) {
    if (!tooltipHidden) {
      el.classList.add('is-hidden');
      el.setAttribute('aria-hidden', 'true');
      tooltipHidden = true;
    }
    return;
  }

  el.querySelector('.tooltip__territory').textContent = data.name     ?? '';
  el.querySelector('.tooltip__track').textContent     = data.subtitle ?? '';
  el.querySelector('.tooltip__artist').textContent    = '';

  const vw = window.innerWidth, vh = window.innerHeight;
  const W = 250, H = 80;
  let left = data.point.x + TOOLTIP_OFFSET;
  let top  = data.point.y + TOOLTIP_OFFSET;
  if (left + W > vw - TOOLTIP_MARGIN) left = data.point.x - W - TOOLTIP_OFFSET;
  if (top  + H > vh - TOOLTIP_MARGIN) top  = data.point.y - H - TOOLTIP_OFFSET;
  el.style.transform = `translate(${left}px, ${top}px)`;

  if (tooltipHidden) {
    el.classList.remove('is-hidden');
    el.setAttribute('aria-hidden', 'false');
    tooltipHidden = false;
  }
}

/* ------------------------------------------------------------------
   3. INFO PANEL / BOTTOM SHEET
   ------------------------------------------------------------------ */

let onPanelCloseCb = null;
let _playCallback  = null;
let _currentRows   = [];

export function setPlayCallback(cb) { _playCallback = cb; }

export function markTrackActive(rank) {
  const container = $('panel-body');
  if (!container) return;
  container.querySelectorAll('.track--active').forEach(el => el.classList.remove('track--active'));
  container.querySelector(`.track[data-rank="${rank}"]`)?.classList.add('track--active');
}

export function onPanelToggle(cb) { onPanelCloseCb = cb; }

function _openPanel() {
  const panel   = $('panel');
  const overlay = $('panel-overlay');
  panel.classList.add('panel--open');
  panel.classList.remove('panel--closed');
  panel.setAttribute('aria-hidden', 'false');
  if (window.innerWidth < 768) overlay.classList.remove('is-hidden');
  onPanelCloseCb?.(true);
}

function _closePanel() {
  const panel   = $('panel');
  const overlay = $('panel-overlay');
  panel.classList.remove('panel--open');
  panel.classList.add('panel--closed');
  panel.setAttribute('aria-hidden', 'true');
  overlay.classList.add('is-hidden');
  onPanelCloseCb?.(false);
  updateTooltip(null);
}

/**
 * Open the panel for a location.
 * @param {{ rows: Object[], meta: { name, hierarchyRank, fetchedAt } } | null} data
 * @param {Object} mode — active mode from modes.js
 */
export function openPanel(data, mode) {
  if (!data) { _closePanel(); return; }

  const { rows, meta } = data;

  $('panel-territory').textContent = meta.name ?? '';
  $('panel-type').textContent      = HIERARCHY_LABELS[meta.hierarchyRank] ?? '';

  const bodyEl = $('panel-body');
  if (bodyEl) {
    _currentRows      = rows;
    bodyEl.innerHTML  = rows.length
      ? mode.renderPanelBody(rows, meta)
      : '<p class="panel__empty">No chart data available for this area.</p>';
    bodyEl.scrollTop = 0;
  }

  _openPanel();
}

export function closePanel() { _closePanel(); }

/* ------------------------------------------------------------------
   4. LEGEND
   ------------------------------------------------------------------ */

/**
 * @param {{ label: string, color: string, count: number }[]} legendItems
 */
export function buildLegend(legendItems) {
  const legendEl = $('legend');
  const listEl   = $('legend-list');
  if (!legendEl || !listEl || !legendItems?.length) return;

  const html = legendItems.map(({ label, color, count }) => `
    <li class="legend__item">
      <span class="legend__swatch" style="background:${color}"></span>
      <span class="legend__artist" title="${esc(label)}">${esc(label)}</span>
      <span class="legend__count">${count}</span>
    </li>`).join('');

  listEl.innerHTML = html;
  legendEl.removeAttribute('hidden');

  // Also populate mobile legend sheet
  const sheetList = $('legend-sheet-list');
  if (sheetList) sheetList.innerHTML = html;
}

/* ------------------------------------------------------------------
   5. MOBILE LEGEND SHEET
   ------------------------------------------------------------------ */

export function toggleLegendSheet() {
  const sheet = $('legend-sheet');
  if (!sheet) return;
  if (sheet.classList.contains('legend-sheet--open')) {
    _closeLegendSheet();
  } else {
    sheet.classList.add('legend-sheet--open');
    sheet.setAttribute('aria-hidden', 'false');
    const overlay = $('panel-overlay');
    overlay?.classList.remove('is-hidden');
    overlay?.addEventListener('click', _closeLegendSheet, { once: true });
  }
}

function _closeLegendSheet() {
  const sheet = $('legend-sheet');
  if (!sheet) return;
  sheet.classList.remove('legend-sheet--open');
  sheet.setAttribute('aria-hidden', 'true');
  $('panel-overlay')?.classList.add('is-hidden');
}

/* ------------------------------------------------------------------
   6. TOAST
   ------------------------------------------------------------------ */

export function showToast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('toast--visible');
  setTimeout(() => el.classList.remove('toast--visible'), 2000);
}

/* ------------------------------------------------------------------
   7. EVENT BINDING
   ------------------------------------------------------------------ */

export function bindUIEvents() {
  $('panel-overlay')?.classList.add('is-hidden');

  const tooltip = $('tooltip');
  tooltip?.classList.add('is-hidden');
  tooltip?.setAttribute('aria-hidden', 'true');
  tooltipHidden = true;

  $('panel-close')?.addEventListener('click', _closePanel);
  $('panel-overlay')?.addEventListener('click', _closePanel);

  // Legend toggle (desktop)
  const legendBtn  = $('legend-btn');
  const legendBody = $('legend-body');
  legendBtn?.addEventListener('click', () => {
    const expanded = legendBtn.getAttribute('aria-expanded') === 'true';
    legendBtn.setAttribute('aria-expanded', String(!expanded));
    expanded ? legendBody.setAttribute('hidden', '') : legendBody.removeAttribute('hidden');
  });

  // Panel body — click delegation (tracks + discover)
  $('panel-body')?.addEventListener('click', (e) => {
    if (e.target.closest('.track__ext-link')) return;

    // Discover play button
    if (e.target.closest('.discover-card__play')) {
      const row = _currentRows[0];
      if (row) _playCallback?.(row);
      return;
    }

    // Track list row
    const trackEl = e.target.closest('.track[data-rank]');
    if (!trackEl) return;
    const rank  = Number(trackEl.dataset.rank);
    const track = _currentRows.find(t => Number(t.rank) === rank);
    if (!track) return;
    $('panel-body').querySelectorAll('.track--active')
      .forEach(el => el.classList.remove('track--active'));
    trackEl.classList.add('track--active');
    _playCallback?.(track);
  });

  $('panel-body')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const trackEl = e.target.closest('.track[data-rank]');
    if (trackEl) { e.preventDefault(); trackEl.click(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { _closePanel(); _closeLegendSheet(); }
  });

  // Share button
  $('share-btn')?.addEventListener('click', () => {
    const url = window.location.origin + window.location.pathname
      + '?utm_source=share&utm_medium=button&utm_campaign=culturalborders';
    if (navigator.share) {
      navigator.share({ title: 'Cultural Borders — Global Music Atlas', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url)
        .then(() => showToast('Link copied!'))
        .catch(() => showToast('Copy the URL from your browser'));
    }
  });
}
