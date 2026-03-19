/**
 * data.js — Generic data loading for all visualisation modes.
 *
 * Public API:
 *   loadGeoJSON(onProgress?)    → GeoJSON FeatureCollection
 *   loadModeData(mode, onProgress?) → { dataMap, colorMap, fillExpression, legendItems }
 */

import { GEOJSON_PATH, NO_DATA_COLOR } from './config.js';

/* ------------------------------------------------------------------
   GeoJSON — streaming fetch with byte progress
   ------------------------------------------------------------------ */

export async function loadGeoJSON(onProgress) {
  const res = await fetch(GEOJSON_PATH);
  if (!res.ok) throw new Error(`GeoJSON fetch failed (HTTP ${res.status})`);

  const total = Number(res.headers.get('content-length')) || 0;

  if (!res.body || total === 0) {
    onProgress?.(0.5);
    const data = await res.json();
    onProgress?.(1);
    return data;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received / total);
  }
  onProgress?.(1);

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(combined));
}

/* ------------------------------------------------------------------
   Mode data — download CSV, parse, build dataMap + color data
   ------------------------------------------------------------------ */

/**
 * Load and process CSV data for a given mode.
 * @param {Object}   mode        — mode object from modes.js
 * @param {Function} [onProgress] — called with 0–1
 * @returns {{ dataMap, colorMap, fillExpression, legendItems }}
 */
export async function loadModeData(mode, onProgress) {
  const text = await _downloadTextWithProgress(mode.csvPath, p => onProgress?.(p * 0.7));
  onProgress?.(0.75);

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      worker: false,
      complete({ data }) {
        onProgress?.(1);
        const dataMap  = _buildDataMap(data, mode);
        const colorData = _buildColorData(dataMap, mode);
        resolve({ dataMap, ...colorData });
      },
      error: reject,
    });
  });
}

/* ------------------------------------------------------------------
   Build location → rows dictionary
   ------------------------------------------------------------------ */

function _buildDataMap(rows, mode) {
  const map = new Map();

  for (const row of rows) {
    const id = row.location_id?.trim();
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);

    // Discover: synthesise encrypted_video_id from youtube_url
    // so that player.js (which uses encrypted_video_id) works unchanged.
    if (mode.id === 'discover' && row.youtube_url && !row.encrypted_video_id) {
      try {
        row.encrypted_video_id = new URL(row.youtube_url).searchParams.get('v') || '';
      } catch (_) {
        row.encrypted_video_id = '';
      }
    }

    map.get(id).push(row);
  }

  // Sort each location's rows
  for (const [, rows] of map) {
    if (mode.id === 'languages') {
      rows.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    } else {
      rows.sort((a, b) => Number(a.rank ?? a.selected_rank) - Number(b.rank ?? b.selected_rank));
    }
  }

  return map;
}

/* ------------------------------------------------------------------
   Color system — frequency-ranked unique assignment with golden-angle HSL
   ------------------------------------------------------------------ */

function _generatePalette(n = 200) {
  const colors = [];
  for (let i = 0; i < n; i++) {
    const hue        = (i * 137.508) % 360;
    const lightness  = i % 2 === 0 ? 58 : 68;
    const saturation = Math.floor(i / 2) % 2 === 0 ? 75 : 85;
    colors.push(`hsl(${hue.toFixed(1)},${saturation}%,${lightness}%)`);
  }
  return colors;
}

function _hashIndex(str, max) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return Math.abs(h) % max;
}

function _buildColorData(dataMap, mode) {
  // Count territory dominance per colour key
  const keyCounts = new Map();
  for (const rows of dataMap.values()) {
    const key = mode.getColorKey(rows);
    if (key) keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  }

  const sortedKeys  = [...keyCounts.entries()].sort((a, b) => b[1] - a[1]);
  const PALETTE_SIZE = 200;
  const palette     = _generatePalette(PALETTE_SIZE);

  const colorMap = new Map();
  sortedKeys.forEach(([key], i) => {
    colorMap.set(key, i < PALETTE_SIZE ? palette[i] : palette[_hashIndex(key, PALETTE_SIZE)]);
  });

  // MapLibre match expression
  const expr = ['match', ['get', 'yt_id']];
  for (const [locationId, rows] of dataMap) {
    const key   = mode.getColorKey(rows);
    const color = key ? (colorMap.get(key) ?? NO_DATA_COLOR) : NO_DATA_COLOR;
    expr.push(locationId, color);
  }
  expr.push(NO_DATA_COLOR);

  // Top 15 legend items
  const legendItems = sortedKeys.slice(0, 15).map(([label, count]) => ({
    label,
    color: colorMap.get(label) ?? NO_DATA_COLOR,
    count,
  }));

  return { colorMap, fillExpression: expr, legendItems };
}

/* ------------------------------------------------------------------
   Download helper
   ------------------------------------------------------------------ */

async function _downloadTextWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed: ${url} (HTTP ${res.status})`);

  const total = Number(res.headers.get('content-length')) || 0;

  if (!res.body || total === 0) {
    onProgress?.(0.5);
    const text = await res.text();
    onProgress?.(1);
    return text;
  }

  const reader = res.body.getReader();
  const parts  = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.length;
    onProgress?.(received / total);
  }
  onProgress?.(1);

  const full = new Uint8Array(received);
  let off = 0;
  for (const p of parts) { full.set(p, off); off += p.length; }
  return new TextDecoder().decode(full);
}
