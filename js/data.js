/**
 * data.js — Asynchronous loading and cross-referencing of
 * combined_map.geojson + charts_tracks.csv
 *
 * Public API:
 *   loadAllData(callbacks) → { geoJSON, tracksMap, colorMap, fillExpression }
 */

import { GEOJSON_PATH, CSV_PATH, PALETTE, NO_DATA_COLOR } from './config.js';

/* ------------------------------------------------------------------
   Public entry point
   ------------------------------------------------------------------ */

/**
 * @param {{ onGeoProgress, onCsvProgress }} [cbs] - optional progress callbacks (0–1)
 * @returns {Promise<{ geoJSON, tracksMap, colorMap, fillExpression }>}
 */
export async function loadAllData(cbs = {}) {
  const { onGeoProgress, onCsvProgress } = cbs;

  // Kick off both downloads in parallel
  const [geoJSON, tracksMap] = await Promise.all([
    fetchGeoJSON(onGeoProgress),
    fetchAndParseCSV(onCsvProgress),
  ]);

  const { colorMap, fillExpression } = buildColorData(tracksMap);

  return { geoJSON, tracksMap, colorMap, fillExpression };
}

/* ------------------------------------------------------------------
   GeoJSON — streaming fetch with byte progress
   ------------------------------------------------------------------ */

async function fetchGeoJSON(onProgress) {
  const res = await fetch(GEOJSON_PATH);
  if (!res.ok) throw new Error(`GeoJSON fetch failed (HTTP ${res.status})`);

  const total = Number(res.headers.get('content-length')) || 0;

  if (!res.body || total === 0) {
    // Fallback: no streaming support or unknown length
    onProgress?.(0.5);
    const data = await res.json();
    onProgress?.(1);
    return data;
  }

  // Stream + track progress
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

  // Assemble into single buffer, decode once
  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }

  return JSON.parse(new TextDecoder().decode(combined));
}

/* ------------------------------------------------------------------
   CSV — PapaParse (streaming download) + progress via fetch pre-pass
   ------------------------------------------------------------------ */

async function fetchAndParseCSV(onProgress) {
  // Phase 1: download as text (so we can track progress)
  const text = await downloadTextWithProgress(CSV_PATH, p => onProgress?.(p * 0.6));

  // Phase 2: parse (PapaParse is synchronous for string input — fast enough
  //           for ~30 MB; consider worker:true for very slow devices)
  onProgress?.(0.65);

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: false,  // keep everything as strings to avoid float coercion
      skipEmptyLines: true,
      worker: false,         // synchronous is fine; change to true on slow targets
      complete({ data }) {
        onProgress?.(1);
        resolve(buildTracksMap(data));
      },
      error: reject,
    });
  });
}

async function downloadTextWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed (HTTP ${res.status})`);

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

/* ------------------------------------------------------------------
   Build location → tracks dictionary
   ------------------------------------------------------------------ */

/**
 * Groups and sorts rows by location_id.
 * @param {Object[]} rows  — parsed CSV rows
 * @returns {Map<string, Object[]>}  location_id → tracks sorted by rank
 */
function buildTracksMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const id = row.location_id?.trim();
    if (!id) continue;

    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }

  for (const tracks of map.values()) {
    tracks.sort((a, b) => Number(a.rank) - Number(b.rank));
  }

  return map;
}

/* ------------------------------------------------------------------
   Build artist colours + MapLibre fill-color expression
   ------------------------------------------------------------------ */

/**
 * Deterministic hash of a string → palette index.
 * Same artist name will always produce the same colour.
 */
function hashArtistColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(31, h) + name.charCodeAt(i) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/**
 * Builds:
 *   colorMap   — Map<artistName, hexColor>  (for the legend)
 *   fillExpression — MapLibre GL match expression for fill-color
 *
 * The match expression maps each yt_id to the colour of its #1 artist.
 */
function buildColorData(tracksMap) {
  const colorMap = new Map();  // artist → colour (deduped)

  // ['match', ['get', 'yt_id'], id1, clr1, id2, clr2, …, default]
  const expr = ['match', ['get', 'yt_id']];

  for (const [locationId, tracks] of tracksMap) {
    // tracks are already sorted by rank; tracks[0] is rank 1
    const top = tracks[0];
    if (!top) continue;

    const artist = top.artist_names?.trim() || '';
    const color  = artist ? hashArtistColor(artist) : NO_DATA_COLOR;

    if (artist && !colorMap.has(artist)) {
      colorMap.set(artist, color);
    }

    // The match expression expects alternating [id, value] pairs
    expr.push(locationId, color);
  }

  expr.push(NO_DATA_COLOR);  // default fallback

  return { colorMap, fillExpression: expr };
}

/* ------------------------------------------------------------------
   Helper — build a summary of top artists by territory count
   (used for the legend)
   ------------------------------------------------------------------ */

/**
 * @param {Map<string, Object[]>} tracksMap
 * @param {Map<string, string>}   colorMap
 * @param {number} [limit=15]
 * @returns {{ artist: string, color: string, count: number }[]}
 */
export function getTopArtistsSummary(tracksMap, colorMap, limit = 15) {
  const counts = new Map();  // artist → territory count

  for (const tracks of tracksMap.values()) {
    const artist = tracks[0]?.artist_names?.trim() || '';
    if (!artist) continue;
    counts.set(artist, (counts.get(artist) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([artist, count]) => ({
      artist,
      color: colorMap.get(artist) || NO_DATA_COLOR,
      count,
    }));
}
