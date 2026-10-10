/**
 * @file RoleMenu.jsx
 * Host-only contextual action menu for promoting, demoting, or removing room members.
 * Source of truth: docs/04 §4.8, §4.9 & docs/07 §6
 */

import React, { useState } from 'react';
import { socket } from '../services/socket.js';

/**
 * @param {Object} props
 * @param {import('../components/ParticipantList.jsx').ParticipantItem} props.participant
 * @param {boolean} props.isHost - True if active user is Host
 * @param {boolean} props.isSelf - True if this item is the active user
 * @param {(msg: string) => void} props.onError
 */
export function RoleMenu({ participant, isHost, isSelf, onError }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only the Host can manage roles, and the Host cannot manage themselves or other hosts
  if (!isHost || isSelf || participant.role === 'host') {
    return null;
  }

  const handleToggleRole = () => {
    const nextRole = participant.role === 'moderator' ? 'participant' : 'moderator';
    setLoading(true);
    socket.emit('assign_role', { userId: participant.userId, role: nextRole }, (res) => {
      setLoading(false);
      setIsOpen(false);
      if (!res.ok) {
        onError(res.error?.message || 'Failed to update role');
      }
    });
  };

  const handleRemove = () => {
    if (!window.confirm(`Are you sure you want to remove "${participant.username}" from the room?`)) {
      return;
    }
    setLoading(true);
    socket.emit('remove_participant', { userId: participant.userId }, (res) => {
      setLoading(false);
      setIsOpen(false);
      if (!res.ok) {
        onError(res.error?.message || 'Failed to remove participant');
      }
    });
  };

  return (
    <div className="role-menu-wrapper">
      <button
        type="button"
        className="menu-trigger-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Manage participant"
      >
        ⋮
      </button>

      {isOpen && (
        <div className="role-dropdown">
          <button
            type="button"
            className="dropdown-item"
            onClick={handleToggleRole}
            disabled={loading}
          >
            {participant.role === 'moderator' ? 'Demote to Participant' : 'Promote to Moderator'}
          </button>
          <button
            type="button"
            className="dropdown-item item-danger"
            onClick={handleRemove}
            disabled={loading}
          >
            Kick from Room
          </button>
        </div>
      )}
    </div>
  );
}
