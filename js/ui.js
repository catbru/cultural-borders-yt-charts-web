/**
 * ui.js — All DOM manipulation: loading overlay, tooltip,
 *          side panel / bottom sheet, and the legend.
 */

import { TOP_N, HIERARCHY_LABELS } from './config.js';
import { getTopArtistsSummary }    from './data.js';

/* ------------------------------------------------------------------
   Element refs (bound lazily — only after DOM ready)
   ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------
   1. LOADING OVERLAY
   ------------------------------------------------------------------ */

const STAGES = { geo: 'stage-geo', csv: 'stage-csv' };

/**
 * Marks a loading stage as active (currently running).
 * @param {'geo'|'csv'} key
 */
export function stageActive(key) {
  const el = $(`stage-${key}`);
  el?.classList.add('is-active');
  el?.classList.remove('is-done');
}

/**
 * Marks a loading stage as complete and sets the bar to 100 %.
 * @param {'geo'|'csv'} key
 */
export function stageDone(key) {
  const el  = $(`stage-${key}`);
  const bar = $(`bar-${key}`);
  if (!el || !bar) return;
  bar.style.width = '100%';
  bar.classList.add('has-progress');
  el.classList.remove('is-active');
  el.classList.add('is-done');
}

/**
 * Updates the progress bar for a loading stage.
 * @param {'geo'|'csv'} key
 * @param {number} value  0–1
 */
export function stageProgress(key, value) {
  const bar = $(`bar-${key}`);
  if (!bar) return;
  if (value > 0) {
    bar.classList.add('has-progress');
    bar.style.width = `${Math.round(value * 100)}%`;
  }
}

/** Fades out and hides the loading overlay. */
export function hideLoader() {
  const overlay = $('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('is-hidden');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

/* ------------------------------------------------------------------
   2. TOOLTIP (desktop only — hidden when panel is open)
   ------------------------------------------------------------------ */

const TOOLTIP_OFFSET   = 18;   // px from cursor
const TOOLTIP_MARGIN   = 12;   // min px from viewport edge
let   tooltipHidden    = true;

/**
 * Updates and positions the tooltip.
 * @param {{ point: {x,y}, name: string, top: object|null } | null} data
 *   Pass null to hide.
 */
export function updateTooltip(data) {
  const el = $('tooltip');
  if (!el) return;

  if (!data || !data.top) {
    if (!tooltipHidden) {
      el.classList.add('is-hidden');
      el.setAttribute('aria-hidden', 'true');
      tooltipHidden = true;
    }
    return;
  }

  // Populate content
  el.querySelector('.tooltip__territory').textContent = data.name ?? '';
  el.querySelector('.tooltip__track').textContent     = data.top.track_name  ?? '—';
  el.querySelector('.tooltip__artist').textContent    = data.top.artist_names ?? '';

  // Position: follow cursor, avoid viewport overflow
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W  = 250;  // approximate tooltip width
  const H  = 80;   // approximate tooltip height

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

let onPanelCloseCb = null;   // external callback (map padding etc.)
let _playCallback  = null;   // called when user clicks a track row
let _currentTracks = [];     // tracks currently rendered in the panel

/**
 * Register the callback that fires when a user clicks a track to play.
 * @param {function(track: Object): void} cb
 */
export function setPlayCallback(cb) { _playCallback = cb; }

/**
 * Highlights the track row with the given rank as "active" (now playing).
 * Clears any previously active row first.
 * @param {number} rank
 */
export function markTrackActive(rank) {
  const container = $('panel-tracks');
  if (!container) return;
  container.querySelectorAll('.track--active').forEach(el => el.classList.remove('track--active'));
  container.querySelector(`.track[data-rank="${rank}"]`)?.classList.add('track--active');
}

/**
 * Register a callback invoked when the panel opens/closes.
 * @param {function(boolean): void} cb   receives `true` when open
 */
export function onPanelToggle(cb) { onPanelCloseCb = cb; }

function _openPanel() {
  const panel   = $('panel');
  const overlay = $('panel-overlay');
  panel.classList.add('panel--open');
  panel.classList.remove('panel--closed');
  panel.setAttribute('aria-hidden', 'false');
  if (window.innerWidth < 768) {
    overlay.classList.remove('is-hidden');
  }
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
  // Clear the tooltip (hidden while panel is open anyway)
  updateTooltip(null);
}

/**
 * Opens the panel and populates it with location data.
 * Pass null to close without populating.
 * @param {{ name: string, rank: number, tracks: Object[] } | null} data
 */
export function openPanel(data) {
  if (!data) { _closePanel(); return; }

  const { name, rank, tracks } = data;

  // Territory name + type badge
  $('panel-territory').textContent = name ?? '';
  $('panel-type').textContent      = HIERARCHY_LABELS[rank] ?? '';

  // Track list
  const container = $('panel-tracks');
  const topN      = tracks.slice(0, TOP_N);
  _currentTracks  = topN;   // keep ref for click delegation

  if (topN.length === 0) {
    container.innerHTML = '<p class="panel__empty">No chart data available for this area.</p>';
  } else {
    container.innerHTML = topN.map(renderTrack).join('');
  }

  container.scrollTop = 0;
  _openPanel();
}

/** Closes the info panel. */
export function closePanel() { _closePanel(); }

/* ------------------------------------------------------------------
   Track item renderer
   Clicking the row → play in floating player
   Clicking the ↗ icon → open YouTube in new tab
   ------------------------------------------------------------------ */

function renderTrack(track) {
  const rank    = Number(track.rank);
  const isTop3  = rank <= 3;
  const name    = esc(track.track_name   || 'Unknown Track');
  const artist  = esc(track.artist_names || 'Unknown Artist');
  const thumb   = track.thumbnail_url    || '';
  const ytUrl   = track.youtube_url      || '#';
  const views   = formatViews(track.view_count);

  const thumbHtml = thumb
    ? `<img class="track__thumb"
            src="${thumb}"
            alt="${name}"
            loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.removeProperty('display')"
       /><span class="track__thumb-placeholder" style="display:none">♪</span>`
    : `<span class="track__thumb-placeholder">♪</span>`;

  return `
    <div class="track"
         role="button"
         tabindex="0"
         data-rank="${rank}"
         aria-label="Play ${name} by ${artist}">
      <span class="track__rank ${isTop3 ? 'track__rank--top' : ''}">${rank}</span>
      <div class="track__thumb-wrap">${thumbHtml}</div>
      <div class="track__info">
        <div class="track__name">${name}</div>
        <div class="track__artist">${artist}</div>
        ${views ? `<div class="track__views">${views} views</div>` : ''}
      </div>
      <div class="track__actions">
        <span class="track__play-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3.5l8 4.5-8 4.5V3.5z"/>
          </svg>
        </span>
        <a class="track__ext-link"
           href="${ytUrl}"
           target="_blank"
           rel="noopener noreferrer"
           aria-label="Open ${name} on YouTube"
           title="Open in YouTube"
           tabindex="-1">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7"/>
            <path d="M8 1h3m0 0v3m0-3L5 7"/>
          </svg>
        </a>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------
   4. LEGEND
   ------------------------------------------------------------------ */

/**
 * Builds and shows the legend.
 * @param {Map<string, Object[]>} tracksMap
 * @param {Map<string, string>}   colorMap
 */
export function buildLegend(tracksMap, colorMap) {
  const legendEl = $('legend');
  const listEl   = $('legend-list');
  if (!legendEl || !listEl) return;

  const items = getTopArtistsSummary(tracksMap, colorMap, 15);
  if (items.length === 0) return;

  listEl.innerHTML = items.map(({ artist, color, count }) => `
    <li class="legend__item">
      <span class="legend__swatch" style="background:${color}"></span>
      <span class="legend__artist" title="${esc(artist)}">${esc(artist)}</span>
      <span class="legend__count">${count}</span>
    </li>`).join('');

  legendEl.removeAttribute('hidden');
}

/* ------------------------------------------------------------------
   5. EVENT BINDING (called once from main.js)
   ------------------------------------------------------------------ */

/**
 * Binds all static UI event listeners.
 */
export function bindUIEvents() {
  // Panel close button
  $('panel-close')?.addEventListener('click', _closePanel);

  // Mobile backdrop
  $('panel-overlay')?.addEventListener('click', _closePanel);

  // Legend toggle
  const legendBtn  = $('legend-btn');
  const legendBody = $('legend-body');
  legendBtn?.addEventListener('click', () => {
    const expanded = legendBtn.getAttribute('aria-expanded') === 'true';
    legendBtn.setAttribute('aria-expanded', String(!expanded));
    if (!expanded) {
      legendBody.removeAttribute('hidden');
    } else {
      legendBody.setAttribute('hidden', '');
    }
  });

  // Track list — click delegation
  // Clicking the row body plays in the floating player.
  // Clicking the .track__ext-link bubbles normally (opens YouTube).
  $('panel-tracks')?.addEventListener('click', (e) => {
    // Let the external YouTube link open normally
    if (e.target.closest('.track__ext-link')) return;

    const trackEl = e.target.closest('.track[data-rank]');
    if (!trackEl) return;

    const rank  = Number(trackEl.dataset.rank);
    const track = _currentTracks.find(t => Number(t.rank) === rank);
    if (!track) return;

    // Visual feedback
    $('panel-tracks').querySelectorAll('.track--active')
      .forEach(el => el.classList.remove('track--active'));
    trackEl.classList.add('track--active');

    _playCallback?.(track);
  });

  // Keyboard: Enter / Space activates focused track row
  $('panel-tracks')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const trackEl = e.target.closest('.track[data-rank]');
    if (trackEl) { e.preventDefault(); trackEl.click(); }
  });

  // Keyboard: Escape closes panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') _closePanel();
  });
}

/* ------------------------------------------------------------------
   Utility
   ------------------------------------------------------------------ */

/** Escape HTML special chars to prevent XSS in innerHTML. */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/** Format a view count as "1.2M", "340K", etc. */
function formatViews(raw) {
  const n = Number(raw);
  if (!n || isNaN(n)) return '';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)        return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
