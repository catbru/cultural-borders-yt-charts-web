/**
 * map.js — MapLibre GL JS initialisation, layer setup, and interaction bindings
 */

import {
  MAP_STYLE, MAP_CENTER, MAP_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM,
  HOVER_LINE_CLR, SEL_LINE_CLR, NO_DATA_COLOR,
} from './config.js';

/* ------------------------------------------------------------------
   Initialise the map
   ------------------------------------------------------------------ */

/**
 * Creates and returns a MapLibre Map instance.
 * @returns {maplibregl.Map}
 */
export function initMap() {
  const map = new maplibregl.Map({
    container: 'map',
    style: MAP_STYLE,
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
    attributionControl: false,
    renderWorldCopies: true,
    antialias: true,
  });

  // Controls
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    'top-right',
  );
  map.addControl(
    new maplibregl.AttributionControl({ compact: true }),
    'bottom-right',
  );

  return map;
}

/**
 * Resolves when the map style has finished loading.
 * @param {maplibregl.Map} map
 * @returns {Promise<void>}
 */
export function waitForStyle(map) {
  return new Promise((resolve, reject) => {
    if (map.isStyleLoaded()) { resolve(); return; }
    map.once('load', resolve);
    map.once('error', (e) => reject(e.error || new Error('Map style failed to load')));
  });
}

/* ------------------------------------------------------------------
   Add the regions GeoJSON source + layers
   ------------------------------------------------------------------ */

/**
 * @param {maplibregl.Map}  map
 * @param {object}          geoJSON        — parsed GeoJSON FeatureCollection
 * @param {Array}           fillExpression — MapLibre match expression for fill-color
 */
export function addRegionsLayer(map, geoJSON, fillExpression) {
  // Source — use promoteId so we can drive feature-state with yt_id strings
  map.addSource('regions', {
    type: 'geojson',
    data: geoJSON,
    promoteId: 'yt_id',   // promotes yt_id property as the feature ID
  });

  // ── Fill ────────────────────────────────────────────────────────
  map.addLayer({
    id: 'regions-fill',
    type: 'fill',
    source: 'regions',
    paint: {
      'fill-color': fillExpression,
      'fill-opacity': [
        'interpolate', ['linear'], ['zoom'],
        1,  // at zoom 1  → slightly more transparent (context overview)
        ['case',
          ['boolean', ['feature-state', 'selected'], false], 0.88,
          ['boolean', ['feature-state', 'hover'],    false], 0.78,
          0.62,
        ],
        7,  // at zoom 7+ → more opaque (detailed view)
        ['case',
          ['boolean', ['feature-state', 'selected'], false], 0.94,
          ['boolean', ['feature-state', 'hover'],    false], 0.86,
          0.72,
        ],
      ],
    },
  });

  // ── Borders ─────────────────────────────────────────────────────
  map.addLayer({
    id: 'regions-line',
    type: 'line',
    source: 'regions',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], SEL_LINE_CLR,
        ['boolean', ['feature-state', 'hover'],    false], HOVER_LINE_CLR,
        'rgba(255,255,255,0.08)',
      ],
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        2, ['case',
              ['boolean', ['feature-state', 'selected'], false], 1.5,
              ['boolean', ['feature-state', 'hover'],    false], 0.8,
              0.3,
            ],
        8, ['case',
              ['boolean', ['feature-state', 'selected'], false], 2.5,
              ['boolean', ['feature-state', 'hover'],    false], 1.5,
              0.6,
            ],
      ],
    },
  });
}

/* ------------------------------------------------------------------
   Interaction bindings (hover + click)
   ------------------------------------------------------------------ */

/**
 * @param {maplibregl.Map} map
 * @param {Map<string, Object[]>} tracksMap  — location_id → sorted tracks
 * @param {{ onHover, onSelect }} handlers
 *   onHover(null | { point, name, rank, top }) — called on mousemove / leave
 *   onSelect(null | { name, rank, tracks })    — called on click / deselect
 */
export function bindInteractions(map, tracksMap, { onHover, onSelect }) {
  let hoveredId  = null;
  let selectedId = null;

  const setState = (id, state) => {
    if (id == null) return;
    map.setFeatureState({ source: 'regions', id }, state);
  };

  /* ---- HOVER ---------------------------------------------------- */
  map.on('mousemove', 'regions-fill', (e) => {
    const f = e.features?.[0];
    if (!f) return;

    const id = f.properties.yt_id;

    if (hoveredId !== id) {
      if (hoveredId !== null) setState(hoveredId, { hover: false });
      hoveredId = id;
      setState(id, { hover: true });
    }

    map.getCanvas().style.cursor = 'pointer';

    const tracks = tracksMap.get(id) ?? [];
    onHover({
      point: e.point,
      name:  f.properties.yt_name,
      rank:  f.properties.hierarchy_rank,
      top:   tracks[0] ?? null,
    });
  });

  map.on('mouseleave', 'regions-fill', () => {
    map.getCanvas().style.cursor = '';
    if (hoveredId !== null) {
      setState(hoveredId, { hover: false });
      hoveredId = null;
    }
    onHover(null);
  });

  /* ---- CLICK (region) ------------------------------------------- */
  map.on('click', 'regions-fill', (e) => {
    const f = e.features?.[0];
    if (!f) return;

    const id = f.properties.yt_id;

    if (selectedId !== null && selectedId !== id) {
      setState(selectedId, { selected: false });
    }
    selectedId = id;
    setState(id, { selected: true });

    const tracks = tracksMap.get(id) ?? [];
    onSelect({
      name:   f.properties.yt_name,
      rank:   f.properties.hierarchy_rank,
      tracks,
    });

    // Prevent the canvas-level handler below from deselecting immediately
    e._regionHandled = true;
  });

  /* ---- CLICK (empty canvas) — deselect ------------------------- */
  map.on('click', (e) => {
    if (e._regionHandled) return;  // already handled above

    // Double-check: did the click land on any region?
    const hits = map.queryRenderedFeatures(e.point, { layers: ['regions-fill'] });
    if (hits.length > 0) return;

    if (selectedId !== null) {
      setState(selectedId, { selected: false });
      selectedId = null;
      onSelect(null);
    }
  });
}

/* ------------------------------------------------------------------
   Map padding helper — shift center away from open panel
   ------------------------------------------------------------------ */

/**
 * Adjusts map padding to account for the side panel on desktop.
 * @param {maplibregl.Map} map
 * @param {boolean} open
 * @param {number}  [panelWidth=400]
 */
export function setMapPadding(map, open, panelWidth = 400) {
  if (window.innerWidth < 768) return; // no padding needed on mobile
  map.easeTo({
    padding: { right: open ? panelWidth : 0 },
    duration: 320,
  });
}
