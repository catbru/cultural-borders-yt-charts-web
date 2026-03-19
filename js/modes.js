/**
 * modes.js — Four visualisation mode definitions.
 *
 * Each mode object implements:
 *   id, label, csvPath
 *   getColorKey(rows) → string|null
 *   getTooltipSubtitle(rows) → string|null
 *   renderPanelBody(rows, meta) → HTML string
 *   onSelect(rows, meta, { playTrack }) → boolean (true = fully handled, no panel)
 */

import {
  CSV_TRACKS_PATH, CSV_ARTISTS_PATH,
  CSV_DISCOVER_PATH, CSV_LANGUAGES_PATH, TOP_N,
} from './config.js';
import { esc, formatViews, formatDate } from './utils.js';

/* ------------------------------------------------------------------
   Shared helpers
   ------------------------------------------------------------------ */

function _updatedLine(fetchedAt) {
  const date = formatDate(fetchedAt);
  return date ? `<div class="panel__updated">Updated ${esc(date)}</div>` : '';
}

function _trackItem(track) {
  const rank   = Number(track.rank);
  const isTop3 = rank <= 3;
  const name   = esc(track.track_name   || 'Unknown Track');
  const artist = esc(track.artist_names || 'Unknown Artist');
  const thumb  = track.thumbnail_url    || '';
  const ytUrl  = track.youtube_url      || '#';
  const views  = formatViews(track.view_count);

  const thumbHtml = thumb
    ? `<img class="track__thumb" src="${thumb}" alt="${name}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.removeProperty('display')"
       /><span class="track__thumb-placeholder" style="display:none">♪</span>`
    : `<span class="track__thumb-placeholder">♪</span>`;

  return `
    <div class="track" role="button" tabindex="0" data-rank="${rank}"
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
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5V3.5z"/></svg>
        </span>
        <a class="track__ext-link" href="${ytUrl}" target="_blank" rel="noopener noreferrer"
           aria-label="Open ${name} on YouTube" title="Open in YouTube" tabindex="-1">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7"/>
            <path d="M8 1h3m0 0v3m0-3L5 7"/>
          </svg>
        </a>
      </div>
    </div>`;
}

function _artistItem(artist) {
  const rank   = Number(artist.rank);
  const isTop3 = rank <= 3;
  const name   = esc(artist.artist_name || 'Unknown Artist');
  const thumb  = artist.thumbnail_url   || '';
  const views  = formatViews(artist.view_count);

  const thumbHtml = thumb
    ? `<img class="track__thumb" src="${thumb}" alt="${name}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.removeProperty('display')"
       /><span class="track__thumb-placeholder" style="display:none">♪</span>`
    : `<span class="track__thumb-placeholder">♪</span>`;

  return `
    <div class="track" role="listitem">
      <span class="track__rank ${isTop3 ? 'track__rank--top' : ''}">${rank}</span>
      <div class="track__thumb-wrap">${thumbHtml}</div>
      <div class="track__info">
        <div class="track__name">${name}</div>
        ${views ? `<div class="track__views">${views} views</div>` : ''}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------
   Mode definitions
   ------------------------------------------------------------------ */

const TRACKS_MODE = {
  id:      'tracks',
  label:   'Tracks',
  csvPath: CSV_TRACKS_PATH,

  getColorKey(rows)        { return rows[0]?.artist_names?.trim() || null; },
  getTooltipSubtitle(rows) { return rows[0]?.track_name || null; },

  renderPanelBody(rows, meta) {
    const updated = _updatedLine(meta.fetchedAt);
    const items   = rows.slice(0, TOP_N).map(_trackItem).join('');
    return `${updated}
      <div class="panel__section-label">Top Tracks</div>
      <div class="panel__tracks" role="list" aria-label="Top tracks">${items}</div>`;
  },

  onSelect() { return false; },
};

const ARTISTS_MODE = {
  id:      'artists',
  label:   'Artists',
  csvPath: CSV_ARTISTS_PATH,

  getColorKey(rows)        { return rows[0]?.artist_name?.trim() || null; },
  getTooltipSubtitle(rows) { return rows[0]?.artist_name || null; },

  renderPanelBody(rows, meta) {
    const updated = _updatedLine(meta.fetchedAt);
    const items   = rows.slice(0, TOP_N).map(_artistItem).join('');
    return `${updated}
      <div class="panel__section-label">Top Artists</div>
      <div class="panel__tracks" role="list" aria-label="Top artists">${items}</div>`;
  },

  onSelect() { return false; },
};

const DISCOVER_MODE = {
  id:      'discover',
  label:   'Discover',
  csvPath: CSV_DISCOVER_PATH,

  getColorKey(rows)        { return rows[0]?.artist_names?.trim() || null; },
  getTooltipSubtitle(rows) { return rows[0]?.track_name || null; },

  renderPanelBody(rows, meta) {
    const row = rows[0];
    if (!row) return '<p class="panel__empty">No discover data for this area.</p>';

    const updated = _updatedLine(meta.fetchedAt);
    const name    = esc(row.track_name   || 'Unknown Track');
    const artist  = esc(row.artist_names || 'Unknown Artist');
    const ytUrl   = row.youtube_url      || '#';
    const count   = Number(row.global_track_count) || 0;
    const badge   = count > 0
      ? `Found in ${count} location${count === 1 ? '' : 's'} worldwide`
      : '';

    return `${updated}
      <div class="panel__section-label">Peculiar Pick</div>
      <div class="discover-card">
        <div class="discover-card__info">
          <div class="discover-card__name">${name}</div>
          <div class="discover-card__artist">${artist}</div>
          ${badge ? `<div class="discover-card__badge">${esc(badge)}</div>` : ''}
        </div>
        <div class="discover-card__actions">
          <span class="discover-card__play" role="button" aria-label="Play ${name}" tabindex="0">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5V3.5z"/></svg>
          </span>
          <a class="track__ext-link" href="${ytUrl}" target="_blank"
             rel="noopener noreferrer" aria-label="Open on YouTube" title="Open in YouTube">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7"/>
              <path d="M8 1h3m0 0v3m0-3L5 7"/>
            </svg>
          </a>
        </div>
      </div>`;
  },

  onSelect(rows, _meta, { playTrack }) {
    if (rows[0]) playTrack(rows[0]);
    return false;
  },
};

const LANGUAGES_MODE = {
  id:      'languages',
  label:   'Languages',
  csvPath: CSV_LANGUAGES_PATH,

  getColorKey(rows)        { return rows[0]?.language_name?.trim() || null; },
  getTooltipSubtitle(rows) { return rows[0]?.language_name || null; },

  renderPanelBody(rows) {
    if (!rows || rows.length === 0) {
      return '<p class="panel__empty">No language data for this area.</p>';
    }
    const total = rows[0]?.total_tracks_considered || '';
    const items = rows.map(row => {
      const pct  = parseFloat(row.percentage) || 0;
      const lang = esc(row.language_name || row.language_code || '?');
      return `
        <div class="lang-item">
          <span class="lang-item__name">${lang}</span>
          <div class="lang-item__bar-wrap">
            <div class="lang-item__bar" style="width:${Math.min(pct, 100)}%"></div>
          </div>
          <span class="lang-item__pct">${pct.toFixed(0)}%</span>
        </div>`;
    }).join('');

    const footer = total
      ? `<p class="lang-footer">Based on top ${esc(String(total))} tracks</p>`
      : '';

    return `
      <div class="panel__section-label">Language Breakdown</div>
      <div class="lang-list">${items}</div>
      ${footer}`;
  },

  onSelect() { return false; },
};

/* ------------------------------------------------------------------
   Exports
   ------------------------------------------------------------------ */

export const MODES = [TRACKS_MODE, ARTISTS_MODE, DISCOVER_MODE, LANGUAGES_MODE];

export function getModeById(id) {
  return MODES.find(m => m.id === id) ?? MODES[0];
}
