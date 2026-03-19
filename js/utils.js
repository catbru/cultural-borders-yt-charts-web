/**
 * utils.js — Shared DOM/formatting helpers
 */

/** Escape HTML special chars to prevent XSS in innerHTML. */
export function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/** Format a view count as "1.2M", "340K", etc. */
export function formatViews(raw) {
  const n = Number(raw);
  if (!n || isNaN(n)) return '';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)        return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format an ISO date string as "Mar 11, 2026".
 * Returns null if the input is falsy or unparseable.
 */
export function formatDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return null;
  }
}
