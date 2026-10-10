/**
 * @file api.js
 * REST client for room creation and room status checks.
 * Source of truth: docs/05-api-documentation.md
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Creates a new watch party room.
 * @param {Object} data
 * @param {string} data.username
 * @param {string} [data.videoId]
 * @returns {Promise<{ roomId: string, userId: string, sessionToken: string, role: string, shareUrl: string }>}
 */
export async function createRoom({ username, videoId }) {
  const response = await fetch(`${API_BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, videoId }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || 'Failed to create room');
  }
  return body;
}

/**
 * Checks whether a room exists and retrieves metadata.
 * @param {string} roomId
 * @returns {Promise<{ roomId: string, participantCount: number, hasVideo: boolean, isFull: boolean, createdAt: string }>}
 */
export async function getRoom(roomId) {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`);
  const body = await response.json();

  if (!response.ok) {
    const error = new Error(body.error?.message || 'Room not found');
    error.code = body.error?.code || 'ROOM_NOT_FOUND';
    throw error;
  }
  return body;
}
