/**
 * player.js — Floating YouTube mini-player (Option B / PiP style)
 *
 * Features:
 *  - Loads YouTube IFrame API once on init
 *  - Draggable on desktop (mouse + touch), constrained to viewport
 *  - Minimizable (collapses to header bar, audio continues)
 *  - Shows animated equaliser bars while playing
 *  - Updates video + track metadata on every playTrack() call
 *  - Temporarily slides off-screen on mobile when the panel opens
 *
 * Public API:
 *  initPlayer()              – load YT API & bind all widget events
 *  playTrack(track)          – load + autoplay a specific track object
 *  closePlayerWidget()       – stop video and hide widget
 *  hidePlayerForPanel()      – slide widget away (mobile panel open)
 *  restorePlayerAfterPanel() – bring widget back (mobile panel close)
 *  hasActiveTrack()          – returns true if widget is visible
 */

/* ------------------------------------------------------------------
   Module state
   ------------------------------------------------------------------ */
let ytPlayer         = null;   // YT.Player instance
let apiReady         = false;  // IFrame API fully initialised
let pendingVideoId   = null;   // queued if API not yet ready
let isVisible        = false;
let isMinimized      = false;
let hiddenForPanel   = false;

let isDragging       = false;
let dragOffset       = { x: 0, y: 0 };
let hasBeenDragged   = false;  // tracks switch from CSS pos → JS pos

let currentTrack     = null;

/* ------------------------------------------------------------------
   Public API
   ------------------------------------------------------------------ */

export function initPlayer() {
  // Register callback BEFORE injecting the script tag
  // (YT API calls this global function when it's ready)
  window.onYouTubeIframeAPIReady = _onApiReady;

  const tag  = document.createElement('script');
  tag.src    = 'https://www.youtube.com/iframe_api';
  tag.async  = true;
  document.head.appendChild(tag);

  _bindWidgetEvents();
}

/**
 * Load a track into the player and show the widget.
 * @param {Object} track  — row from charts_tracks.csv
 */
export function playTrack(track) {
  if (!track) return;
  currentTrack = track;

  _updateWidgetInfo(track);
  _showWidget();

  const videoId = track.encrypted_video_id?.trim();
  if (!videoId) return;

  if (!apiReady || !ytPlayer) {
    pendingVideoId = videoId;
    return;
  }

  // loadVideoById auto-plays when playerVars.autoplay = 1
  ytPlayer.loadVideoById(videoId);
}

/** Stop and hide the player entirely. */
export function closePlayerWidget() {
  if (apiReady && ytPlayer) {
    try { ytPlayer.stopVideo(); } catch (_) { /* ignore */ }
  }
  currentTrack = null;
  _hideWidget();
}

/** Slide widget out of view when the panel opens on mobile. */
export function hidePlayerForPanel() {
  if (!isVisible || hiddenForPanel) return;
  hiddenForPanel = true;
  _el()?.classList.add('player-widget--offscreen');
}

/** Bring widget back after panel closes on mobile. */
export function restorePlayerAfterPanel() {
  if (!hiddenForPanel) return;
  hiddenForPanel = false;
  _el()?.classList.remove('player-widget--offscreen');
}

/** True when the widget is visible with a track loaded. */
export function hasActiveTrack() {
  return isVisible && currentTrack !== null;
}

/* ------------------------------------------------------------------
   YouTube IFrame API callbacks
   ------------------------------------------------------------------ */

function _onApiReady() {
  // Create the single, persistent YT player inside #yt-iframe
  ytPlayer = new YT.Player('yt-iframe', {
    height: '100%',
    width:  '100%',
    videoId: '',
    playerVars: {
      autoplay:       1,
      controls:       1,
      modestbranding: 1,
      rel:            0,
      iv_load_policy: 3,   // hide annotations
      playsinline:    1,   // iOS inline play (no fullscreen takeover)
      fs:             1,   // fullscreen button still available
    },
    events: {
      onReady:       _onPlayerReady,
      onStateChange: _onStateChange,
      onError:       _onError,
    },
  });
}

function _onPlayerReady() {
  apiReady = true;
  if (pendingVideoId) {
    ytPlayer.loadVideoById(pendingVideoId);
    pendingVideoId = null;
  }
}

function _onStateChange({ data }) {
  // PlayerState: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
  const playing = (data === 1 || data === 3);
  _el()?.classList.toggle('player-widget--playing', playing);

  // Minimised widget title shows "Playing" / "Paused" hint
  const statusEl = document.getElementById('pw-status');
  if (statusEl) {
    if (data === 1) statusEl.textContent = 'Playing';
    else if (data === 2) statusEl.textContent = 'Paused';
    else if (data === 0) statusEl.textContent = 'Ended';
    else statusEl.textContent = '';
  }
}

function _onError({ data }) {
  console.warn('[Player] YouTube IFrame error code:', data);
  // 101 / 150 = video not embeddable — degrade gracefully
  const nameEl = document.getElementById('pw-track-name');
  if (nameEl && (data === 101 || data === 150)) {
    // Append a small note; the row still shows external link
    const note = document.createElement('span');
    note.style.cssText = 'font-size:.6rem;opacity:.5;margin-left:.25rem';
    note.textContent = '(not embeddable)';
    nameEl.appendChild(note);
  }
}

/* ------------------------------------------------------------------
   Widget DOM helpers
   ------------------------------------------------------------------ */

const _el = () => document.getElementById('player-widget');

function _showWidget() {
  const el = _el();
  if (!el) return;
  isVisible = true;
  el.removeAttribute('hidden');
  // rAF so the remove-hidden triggers a layout paint before the transition
  requestAnimationFrame(() => el.classList.add('player-widget--visible'));
}

function _hideWidget() {
  const el = _el();
  if (!el) return;
  el.classList.remove('player-widget--visible', 'player-widget--minimized',
                       'player-widget--playing', 'player-widget--offscreen');
  isVisible    = false;
  isMinimized  = false;
  hiddenForPanel = false;
  // Wait for CSS transition to finish before setting hidden
  el.addEventListener('transitionend', () => {
    if (!isVisible) el.setAttribute('hidden', '');
  }, { once: true });
}

function _minimize() {
  isMinimized = true;
  _el()?.classList.add('player-widget--minimized');
  _syncMinimizeIcon();
}

function _expand() {
  isMinimized = false;
  _el()?.classList.remove('player-widget--minimized');
  _syncMinimizeIcon();
}

function _syncMinimizeIcon() {
  const btn = document.getElementById('pw-minimize');
  if (!btn) return;
  btn.setAttribute('aria-label', isMinimized ? 'Expand player' : 'Minimise player');
  btn.setAttribute('title',      isMinimized ? 'Expand'         : 'Minimise');
  // Rotate the chevron via data attribute (CSS handles it)
  btn.dataset.minimized = String(isMinimized);
}

function _updateWidgetInfo(track) {
  const nameEl   = document.getElementById('pw-track-name');
  const artistEl = document.getElementById('pw-artist');
  const thumbEl  = document.getElementById('pw-thumb');
  const extEl    = document.getElementById('pw-open-yt');
  const statusEl = document.getElementById('pw-status');

  if (nameEl)   nameEl.textContent   = track.track_name   || 'Unknown track';
  if (artistEl) artistEl.textContent = track.artist_names || 'Unknown artist';
  if (statusEl) statusEl.textContent = '';

  if (thumbEl) {
    thumbEl.src    = track.thumbnail_url || '';
    thumbEl.hidden = !track.thumbnail_url;
  }

  if (extEl && track.youtube_url) {
    extEl.href = track.youtube_url;
  }
}

/* ------------------------------------------------------------------
   Drag (desktop only — disabled on touch/mobile)
   ------------------------------------------------------------------ */

function _bindWidgetEvents() {
  const el     = _el();
  if (!el) return;

  const handle   = document.getElementById('pw-drag-handle');
  const minBtn   = document.getElementById('pw-minimize');
  const closeBtn = document.getElementById('pw-close');
  const frame    = document.getElementById('pw-frame');

  /* ── Drag ────────────────────────────────────────────────────── */
  const dragTarget = handle || el;

  function onDragStart(e) {
    // Only desktop, not from interactive children
    if (window.innerWidth < 768) return;
    if (e.target.closest('button, a')) return;

    isDragging = true;
    const pt = e.touches?.[0] ?? e;

    // First drag: switch from CSS-defined bottom/right → JS-controlled top/left
    if (!hasBeenDragged) {
      const r = el.getBoundingClientRect();
      el.style.top    = `${r.top}px`;
      el.style.left   = `${r.left}px`;
      el.style.bottom = 'auto';
      el.style.right  = 'auto';
      hasBeenDragged  = true;
    }

    dragOffset.x = pt.clientX - el.offsetLeft;
    dragOffset.y = pt.clientY - el.offsetTop;
    el.classList.add('player-widget--dragging');
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!isDragging) return;
    const pt   = e.touches?.[0] ?? e;
    const maxX = window.innerWidth  - el.offsetWidth;
    const maxY = window.innerHeight - el.offsetHeight;
    el.style.left = `${Math.max(0, Math.min(pt.clientX - dragOffset.x, maxX))}px`;
    el.style.top  = `${Math.max(0, Math.min(pt.clientY - dragOffset.y, maxY))}px`;
    if (e.cancelable) e.preventDefault();
  }

  function onDragEnd() {
    isDragging = false;
    el.classList.remove('player-widget--dragging');
  }

  dragTarget.addEventListener('mousedown',  onDragStart);
  dragTarget.addEventListener('touchstart', onDragStart, { passive: false });
  document.addEventListener('mousemove',   onDragMove);
  document.addEventListener('touchmove',   onDragMove,  { passive: false });
  document.addEventListener('mouseup',     onDragEnd);
  document.addEventListener('touchend',    onDragEnd);

  // Double-click handle → toggle minimise
  dragTarget.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, a')) return;
    isMinimized ? _expand() : _minimize();
  });

  /* ── Minimise button ─────────────────────────────────────────── */
  minBtn?.addEventListener('click', () => isMinimized ? _expand() : _minimize());

  /* ── Close button ────────────────────────────────────────────── */
  closeBtn?.addEventListener('click', closePlayerWidget);

  /* ── Frame click-to-expand (when minimised) ──────────────────── */
  el.addEventListener('click', (e) => {
    if (isMinimized && !e.target.closest('button, a')) _expand();
  });
}
