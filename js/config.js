/**
 * config.js — Application-wide constants and colour palette
 */

// Data paths (relative to index.html, served from web/)
export const GEOJSON_PATH = './data/combined_map.geojson';
export const CSV_PATH     = './data/charts_tracks.csv';

// How many tracks to show in the panel
export const TOP_N = 10;

// MapLibre base style — CartoDB Dark Matter (no labels, free, no API key)
export const MAP_STYLE  = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
export const MAP_CENTER = [10, 20];   // [lng, lat]
export const MAP_ZOOM   = 2.2;
export const MAP_MIN_ZOOM = 1.5;
export const MAP_MAX_ZOOM = 12;

/**
 * 44 vibrant colours that pop on dark backgrounds.
 * Palette is stable: same index → same colour across sessions.
 */
export const PALETTE = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB', '#1DD1A1',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#EE5A24',
  '#C44569', '#6AB04C', '#EB4D4B', '#7ED6DF', '#E056FD',
  '#686DE0', '#F9CA24', '#FDA7DF', '#D980FA', '#9980FA',
  '#F79F1F', '#12CBC4', '#ED4C67', '#A3CB38', '#B53471',
  '#EAD623', '#EA2027', '#1289A7', '#009432', '#C4E538',
  '#ee4265', '#3bceac', '#f4d35e', '#08b2e3', '#ef7b45',
  '#d62246', '#4b9e44', '#7b2d8b', '#e8871e', '#3a86ff',
  '#ff006e', '#8338ec', '#06d6a0', '#ffb703', '#fb8500',
];

/**
 * Fallback fill for regions with no chart data.
 * Subtle enough not to distract from coloured regions.
 */
export const NO_DATA_COLOR  = '#1a1a2e';
export const HOVER_LINE_CLR = 'rgba(255,255,255,0.65)';
export const SEL_LINE_CLR   = 'rgba(160,160,255,0.95)';

// Hierarchy labels for the panel type badge
export const HIERARCHY_LABELS = {
  0: 'City',
  1: 'Region / State',
  2: 'Country',
};
