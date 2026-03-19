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

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  return map;
}

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

export function addRegionsLayer(map, geoJSON, fillExpression) {
  map.addSource('regions', {
    type: 'geojson',
    data: geoJSON,
    promoteId: 'yt_id',
  });

  map.addLayer({
    id: 'regions-fill',
    type: 'fill',
    source: 'regions',
    paint: {
      'fill-color': fillExpression,
      'fill-opacity': [
        'interpolate', ['linear'], ['zoom'],
        1, ['case',
          ['boolean', ['feature-state', 'selected'], false], 0.88,
          ['boolean', ['feature-state', 'hover'],    false], 0.78,
          0.62,
        ],
        7, ['case',
          ['boolean', ['feature-state', 'selected'], false], 0.94,
          ['boolean', ['feature-state', 'hover'],    false], 0.86,
          0.72,
        ],
      ],
    },
  });

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
   Swap fill-color without rebuilding the layer
   ------------------------------------------------------------------ */

export function updateFillColor(map, fillExpression) {
  map.setPaintProperty('regions-fill', 'fill-color', fillExpression);
}

/* ------------------------------------------------------------------
   Interaction bindings (hover + click)
   ------------------------------------------------------------------ */

/**
 * @param {maplibregl.Map} map
 * @param {function(string): Object[]} getActiveData
 *   Called with locationId at event time; returns rows for the current mode.
 * @param {{ onHover, onSelect }} handlers
 *   onHover(null | { point, name, hierarchyRank, rows })
 *   onSelect(null | { locationId, name, hierarchyRank })
 */
export function bindInteractions(map, getActiveData, { onHover, onSelect }) {
  let hoveredId  = null;
  let selectedId = null;

  const setState = (id, state) => {
    if (id == null) return;
    map.setFeatureState({ source: 'regions', id }, state);
  };

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

    onHover({
      point:         e.point,
      name:          f.properties.yt_name,
      hierarchyRank: f.properties.hierarchy_rank,
      rows:          getActiveData(id),
    });
  });

  map.on('mouseleave', 'regions-fill', () => {
    map.getCanvas().style.cursor = '';
    if (hoveredId !== null) { setState(hoveredId, { hover: false }); hoveredId = null; }
    onHover(null);
  });

  map.on('click', 'regions-fill', (e) => {
    const f = e.features?.[0];
    if (!f) return;
    const id = f.properties.yt_id;

    if (selectedId !== null && selectedId !== id) setState(selectedId, { selected: false });
    selectedId = id;
    setState(id, { selected: true });

    onSelect({
      locationId:    id,
      name:          f.properties.yt_name,
      hierarchyRank: f.properties.hierarchy_rank,
    });
    e._regionHandled = true;
  });

  map.on('click', (e) => {
    if (e._regionHandled) return;
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
   Map padding helper
   ------------------------------------------------------------------ */

export function setMapPadding(map, open, panelWidth = 400) {
  if (window.innerWidth < 768) return;
  map.easeTo({ padding: { right: open ? panelWidth : 0 }, duration: 320 });
}
