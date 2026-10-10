/**
 * @file useRoom.js
 * Custom React hook for watch party room lifecycle, synchronization, and event listeners.
 * Source of truth: docs/02-architecture.md §4 & docs/04-websocket-events.md §4, §5
 */

import { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socket.js';
import { getSession, saveSession, clearSession } from '../utils/session.js';

/**
 * Manages WebSocket room lifecycle.
 * Registers all socket listeners BEFORE emitting join_room to prevent race conditions.
 * Replaces the participant list idempotently on every event carrying participants.
 *
 * @param {string} roomId
 * @param {string} username
 */
export function useRoom(roomId, username) {
  const [participants, setParticipants] = useState([]);
  const [self, setSelf] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [error, setError] = useState(null);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [resolvedNotification, setResolvedNotification] = useState(null);

  // Keep a ref to self to access current userId inside event closures
  const selfRef = useRef(self);
  useEffect(() => {
    selfRef.current = self;
  }, [self]);

  useEffect(() => {
    if (!roomId || !username) return;

    // Connect socket if not currently connected
    if (!socket.connected) {
      socket.connect();
    }

    const doJoinRoom = () => {
      // 3. Check for existing session token (Host creator or reconnect)
      const session = getSession(roomId);
      const sessionToken = session?.sessionToken;

      // 4. Emit join_room with acknowledgement callback
      socket.emit(
        'join_room',
        {
          roomId,
          username,
          sessionToken,
        },
        (response) => {
          if (!response.ok) {
            setError(response.error?.message || 'Failed to join room');
            setConnectionStatus('disconnected');
            return;
          }

          const { userId, role, sessionToken: activeToken, participants: initialList } = response.data;

          // Persist session token for reconnects
          saveSession(roomId, { userId, sessionToken: activeToken, username });

          setSelf({ userId, username, role });
          setParticipants(initialList);
          setConnectionStatus('connected');
        }
      );
    };

    const handleConnect = () => {
      setConnectionStatus('connected');
      doJoinRoom();
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');
    };


    const handleSyncState = (state) => {
      setSyncState(state);
    };

    const handleUserJoined = (data) => {
      if (data.participants) {
        setParticipants(data.participants);
      }
    };

    const handleUserLeft = (data) => {
      if (data.participants) {
        setParticipants(data.participants);
      }
    };

    const handleRoleAssigned = (data) => {
      if (data.participants) {
        setParticipants(data.participants);
      }
      // If the role change is for this client, update self.role immediately (RE-2)
      if (selfRef.current && data.userId === selfRef.current.userId) {
        setSelf((prev) => (prev ? { ...prev, role: data.role } : prev));
      }
    };

    const handleParticipantRemoved = (data) => {
      if (data.participants) {
        setParticipants(data.participants);
      }
      // If this client was kicked, clear credentials and record removal
      if (selfRef.current && data.userId === selfRef.current.userId) {
        clearSession(roomId);
        setError('You were removed from the room by the host.');
        setConnectionStatus('disconnected');
      }
    };

    const handleChangeRequested = (data) => {
      setPendingRequests((prev) => {
        // Prevent duplicate entries
        if (prev.some((r) => r.requestId === data.requestId)) return prev;
        return [...prev, data];
      });
    };

    const handleChangeResolved = (data) => {
      setPendingRequests((prev) => prev.filter((r) => r.requestId !== data.requestId));
      setResolvedNotification(data);
    };

    // 2. REGISTER ALL LISTENERS BEFORE EMITTING join_room (prevents dropped events)
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('sync_state', handleSyncState);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('role_assigned', handleRoleAssigned);
    socket.on('participant_removed', handleParticipantRemoved);
    socket.on('change_requested', handleChangeRequested);
    socket.on('change_resolved', handleChangeResolved);

    // 3. If socket is already connected, emit join_room now; otherwise handleConnect will trigger it
    if (socket.connected) {
      doJoinRoom();
    }


    // 5. CLEANUP ON UNMOUNT (prevents memory leaks and duplicate listeners)
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('sync_state', handleSyncState);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('participant_removed', handleParticipantRemoved);
      socket.off('change_requested', handleChangeRequested);
      socket.off('change_resolved', handleChangeResolved);
    };
  }, [roomId, username]);

  const requestChange = (action, callback) => {
    socket.emit('request_change', { action }, (response) => {
      if (callback) callback(response);
    });
  };

  const resolveChange = (requestId, decision, callback) => {
    socket.emit('resolve_change', { requestId, decision }, (response) => {
      if (callback) callback(response);
    });
  };

  return {
    participants,
    self,
    syncState,
    connectionStatus,
    error,
    pendingRequests,
    resolvedNotification,
    requestChange,
    resolveChange,
  };
}

