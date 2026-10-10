/**
 * @file session.js
 * Session storage utility for persisting room session tokens and user identity.
 * Key convention: watchparty:<roomId> (per docs/04 §5.10 and docs/06 Flow 1)
 */

function getStorageKey(roomId) {
  return `watchparty:${roomId.toUpperCase()}`;
}

/**
 * Saves room session credentials to sessionStorage.
 * @param {string} roomId
 * @param {{ userId?: string, sessionToken?: string, username?: string }} data
 */
export function saveSession(roomId, data) {
  if (!roomId) return;
  const existing = getSession(roomId) || {};
  const merged = { ...existing, ...data };
  sessionStorage.setItem(getStorageKey(roomId), JSON.stringify(merged));
}

/**
 * Retrieves stored session credentials for a room.
 * @param {string} roomId
 * @returns {{ userId?: string, sessionToken?: string, username?: string } | null}
 */
export function getSession(roomId) {
  if (!roomId) return null;
  const raw = sessionStorage.getItem(getStorageKey(roomId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clears stored session credentials for a room.
 * @param {string} roomId
 */
export function clearSession(roomId) {
  if (!roomId) return;
  sessionStorage.removeItem(getStorageKey(roomId));
}
