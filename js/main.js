/**
 * main.js — Application entry point.
 *
 * Phase 1 (blocking): GeoJSON + tracks CSV + map style.
 * Phase 2 (background): artists, discover, languages CSVs.
 */

import { loadGeoJSON, loadModeData }  from './data.js';
import { MODES, getModeById }         from './modes.js';
import {
  initMap, waitForStyle, addRegionsLayer,
  bindInteractions, updateFillColor, setMapPadding,
} from './map.js';
import {
  stageActive, stageDone, stageProgress, hideLoader,
  updateTooltip, openPanel, closePanel, onPanelToggle,
  buildLegend, bindUIEvents, setPlayCallback, markTrackActive,
  toggleLegendSheet,
} from './ui.js';
import {
  initPlayer, playTrack,
  hidePlayerForPanel, restorePlayerAfterPanel,
} from './player.js';

/* ------------------------------------------------------------------
   Module state
   ------------------------------------------------------------------ */

/** modeId → { dataMap, colorMap, fillExpression, legendItems } */
const modeCache = new Map();

let map        = null;
let activeMode = getModeById('discover');

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */

async function main() {
  bindUIEvents();
  initPlayer();

  setPlayCallback((track) => {
    playTrack(track);
    markTrackActive(Number(track.rank ?? track.selected_rank));
  });

  stageActive('geo');
  stageActive('csv');

  map = initMap();

  // Phase 1 — blocking
  let geoJSON, tracksResult;
  try {
    [geoJSON, tracksResult] = await Promise.all([
      loadGeoJSON(p => { stageProgress('geo', p); if (p >= 1) stageDone('geo'); }),
      loadModeData(getModeById('discover'), p => { stageProgress('csv', p); if (p >= 1) stageDone('csv'); }),
      waitForStyle(map),
    ]);
  } catch (err) {
    _showFatalError(err);
    return;
  }

  modeCache.set('discover', tracksResult);

  addRegionsLayer(map, geoJSON, tracksResult.fillExpression);

  // Callback that always returns data for the current active mode
  const getActiveData = (locationId) =>
    modeCache.get(activeMode.id)?.dataMap.get(locationId) ?? [];

  bindInteractions(map, getActiveData, {
    onHover(data) {
      if (window.matchMedia('(hover: none)').matches) { updateTooltip(null); return; }
      if (!data) { updateTooltip(null); return; }
      const subtitle = activeMode.getTooltipSubtitle(data.rows);
      updateTooltip({ point: data.point, name: data.name, subtitle });
    },

    onSelect(data) {
      if (!data) { closePanel(); return; }
      updateTooltip(null);
      const rows      = getActiveData(data.locationId);
      const fetchedAt = rows[0]?.fetched_at ?? null;
      const meta      = { name: data.name, hierarchyRank: data.hierarchyRank, fetchedAt };
      const handled   = activeMode.onSelect(rows, meta, { playTrack });
      if (!handled) openPanel({ rows, meta }, activeMode);
    },
  });

  onPanelToggle((isOpen) => {
    setMapPadding(map, isOpen, 400);
    if (window.innerWidth < 768) {
      if (isOpen) hidePlayerForPanel();
      else        restorePlayerAfterPanel();
    }
  });

  buildLegend(tracksResult.legendItems);
  hideLoader();

  // Mode bar
  document.getElementById('mode-bar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    _setActiveMode(btn.dataset.mode);
  });

  // Mobile legend toggle
  document.getElementById('legend-toggle-btn')?.addEventListener('click', toggleLegendSheet);

  // Phase 2 — background
  _loadBackgroundModes();
}

/* ------------------------------------------------------------------
   Mode switching
   ------------------------------------------------------------------ */

function _setActiveMode(modeId) {
  const mode = getModeById(modeId);
  if (!mode || mode === activeMode) return;

  document.querySelectorAll('.mode-bar__tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.mode === modeId);
  });

  activeMode = mode;
  closePanel();

  const cached = modeCache.get(modeId);
  if (!cached) return; // still loading — will apply when Phase 2 finishes

  updateFillColor(map, cached.fillExpression);
  buildLegend(cached.legendItems);
}

/* ------------------------------------------------------------------
   Phase 2 — background CSV loading
   ------------------------------------------------------------------ */

async function _loadBackgroundModes() {
  const bg = MODES.filter(m => m.id !== 'discover');

  await Promise.allSettled(bg.map(async (mode) => {
    _setTabLoading(mode.id, true);
    try {
      const result = await loadModeData(mode);
      modeCache.set(mode.id, result);
      _setTabLoading(mode.id, false);
      // If the user already switched to this mode while it was loading, apply now
      if (activeMode.id === mode.id) {
        updateFillColor(map, result.fillExpression);
        buildLegend(result.legendItems);
      }
    } catch (err) {
      console.warn(`[CulturalBorders] Failed to load mode "${mode.id}":`, err);
      _setTabLoading(mode.id, false);
    }
  }));
}

function _setTabLoading(modeId, loading) {
  document.querySelector(`.mode-bar__tab[data-mode="${modeId}"]`)
    ?.classList.toggle('is-loading', loading);
}

/* ------------------------------------------------------------------
   Fatal error fallback
   ------------------------------------------------------------------ */

function _showFatalError(err) {
  console.error('[CulturalBorders] Fatal init error:', err);
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="loader" style="gap:1rem">
      <svg viewBox="0 0 24 24" fill="none" stroke="#ff5b5b" stroke-width="1.5"
           style="width:48px;height:48px;opacity:.8">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <circle cx="12" cy="16" r="0.5" fill="#ff5b5b"/>
      </svg>
      <p style="color:#ff5b5b;font-weight:700;font-size:.95rem">Failed to load</p>
      <p style="color:#7070a0;font-size:.75rem;max-width:260px;line-height:1.5">
        ${err.message || 'Unknown error'}.<br>
        Make sure the data files are in <code>web/data/</code> and the
        app is served via a local HTTP server.
      </p>
      <button onclick="location.reload()"
              style="margin-top:.5rem;padding:.45rem 1rem;background:#6b6bff;
                     color:#fff;border:none;border-radius:20px;cursor:pointer;
                     font-size:.8rem;font-weight:600">
        Retry
      </button>
    </div>`;
}

main();
