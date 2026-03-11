/**
 * main.js — Application entry point
 *
 * Orchestrates:
 *   1. Loading overlay feedback
 *   2. Parallel fetch of GeoJSON + CSV
 *   3. MapLibre style boot
 *   4. Layer and interaction setup
 *   5. Legend build
 */

import { loadAllData }      from './data.js';
import { initMap, waitForStyle, addRegionsLayer, bindInteractions, setMapPadding } from './map.js';
import {
  stageActive, stageDone, stageProgress,
  hideLoader,
  updateTooltip,
  openPanel, closePanel,
  onPanelToggle,
  buildLegend,
  bindUIEvents,
  setPlayCallback,
  markTrackActive,
} from './ui.js';
import {
  initPlayer,
  playTrack,
  hidePlayerForPanel,
  restorePlayerAfterPanel,
} from './player.js';

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */

async function main() {
  // ── Static UI events (close button, escape key, legend toggle) ──
  bindUIEvents();

  // ── Initialise the floating YouTube player (loads API in background) ──
  initPlayer();

  // ── Wire track-click → player ────────────────────────────────
  setPlayCallback((track) => {
    playTrack(track);
    markTrackActive(Number(track.rank));
  });

  // ── Activate loading stage indicators ───────────────────────────
  stageActive('geo');
  stageActive('csv');

  // ── Start the map (style fetch runs in parallel with data) ───────
  const map = initMap();

  // ── Kick off both data loads and map style in parallel ──────────
  let dataResult;
  try {
    [dataResult] = await Promise.all([
      loadAllData({
        onGeoProgress(p) {
          stageProgress('geo', p);
          if (p >= 1) stageDone('geo');
        },
        onCsvProgress(p) {
          stageProgress('csv', p);
          if (p >= 1) stageDone('csv');
        },
      }),
      waitForStyle(map),
    ]);
  } catch (err) {
    showFatalError(err);
    return;
  }

  const { geoJSON, tracksMap, colorMap, fillExpression } = dataResult;

  // ── Add region layers ────────────────────────────────────────────
  addRegionsLayer(map, geoJSON, fillExpression);

  // ── Wire map interactions ────────────────────────────────────────
  bindInteractions(map, tracksMap, {
    // Hover → tooltip (desktop); suppressed when panel is open
    onHover(data) {
      // Skip tooltip on mobile (touch devices have no hover)
      if (window.matchMedia('(hover: none)').matches) return;
      updateTooltip(data);
    },

    // Click → info panel
    onSelect(data) {
      if (!data) {
        closePanel();
        return;
      }
      // Hide tooltip while panel is visible
      updateTooltip(null);
      openPanel(data);
    },
  });

  // ── Adjust map padding + player visibility on panel toggle ──────
  onPanelToggle((isOpen) => {
    setMapPadding(map, isOpen, 400);
    // On mobile: slide the player out of view while the bottom sheet is up
    if (window.innerWidth < 768) {
      if (isOpen) hidePlayerForPanel();
      else        restorePlayerAfterPanel();
    }
  });

  // ── Build legend ─────────────────────────────────────────────────
  buildLegend(tracksMap, colorMap);

  // ── Remove loading overlay ───────────────────────────────────────
  hideLoader();
}

/* ------------------------------------------------------------------
   Fatal error fallback
   ------------------------------------------------------------------ */

function showFatalError(err) {
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

/* ------------------------------------------------------------------
   Run
   ------------------------------------------------------------------ */
main();
