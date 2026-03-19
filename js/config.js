/**
 * config.js — Application-wide constants
 */

// GeoJSON
export const GEOJSON_PATH = './data/combined_map.geojson';

// CSV paths — one per visualisation mode
export const CSV_TRACKS_PATH    = './data/charts_tracks.csv';
export const CSV_ARTISTS_PATH   = './data/charts_artists.csv';
export const CSV_DISCOVER_PATH  = './data/charts_tracks_discover.csv';
export const CSV_LANGUAGES_PATH = './data/charts_tracks_language_summary.csv';

// How many items to show in the panel (tracks / artists modes)
export const TOP_N = 20;

// MapLibre base style — CartoDB Dark Matter (no labels, free, no API key)
export const MAP_STYLE   = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
export const MAP_CENTER  = [10, 20];
export const MAP_ZOOM    = 2.2;
export const MAP_MIN_ZOOM = 1.5;
export const MAP_MAX_ZOOM = 12;

/** Fallback fill for regions with no chart data. */
export const NO_DATA_COLOR  = '#1a1a2e';
export const HOVER_LINE_CLR = 'rgba(255,255,255,0.65)';
export const SEL_LINE_CLR   = 'rgba(160,160,255,0.95)';

// Hierarchy labels for the panel type badge
export const HIERARCHY_LABELS = {
  0: 'City',
  1: 'Region / State',
  2: 'Country',
};
