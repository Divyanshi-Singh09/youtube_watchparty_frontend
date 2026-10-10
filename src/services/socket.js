/**
 * @file socket.js
 * Socket.IO client singleton configured for real-time WebSocket communication.
 * Source of truth: docs/02-architecture.md §6
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

/**
 * Global Socket.IO client instance.
 * transports: ['websocket'] avoids HTTP polling and stickiness requirements.
 * autoConnect: false allows explicit connection lifecycle management.
 */
export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false,
});
