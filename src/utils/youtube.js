/**
 * @file youtube.js
 * YouTube URL parser extracting canonical 11-character video IDs.
 * Source of truth: docs/02-architecture.md §4 & docs/08-testing-plan.md CV-02, CV-03
 */

/**
 * Extracts an 11-character YouTube video ID from a URL or raw ID string.
 * Supports:
 * - Raw 11-char ID: dQw4w9WgXcQ
 * - Standard watch URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - Short URL: https://youtu.be/dQw4w9WgXcQ
 * - Embed URL: https://www.youtube.com/embed/dQw4w9WgXcQ
 * - Shorts URL: https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - URLs with additional query parameters (e.g. ?t=10s, &feature=share)
 *
 * @param {string} input - YouTube URL or raw ID
 * @returns {string|null} 11-character video ID, or null if invalid
 */
export function extractVideoId(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Check if raw 11-character ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Extract from standard URL patterns
  const urlRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;
  const match = trimmed.match(urlRegex);

  if (match && match[1]) {
    return match[1];
  }

  // 3. Fallback: Parse URL if valid to handle params like ?si=..., ?feature=..., or mobile (m.youtube.com)
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) {
        return v;
      }
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const last = pathParts[pathParts.length - 1];
        if (/^[A-Za-z0-9_-]{11}$/.test(last)) {
          return last;
        }
      }
    } else if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0 && /^[A-Za-z0-9_-]{11}$/.test(pathParts[0])) {
        return pathParts[0];
      }
    }
  } catch {
    // Malformed URL
  }

  return null;
}
