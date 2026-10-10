/**
 * @file ParticipantList.jsx
 * Component displaying room participants, role badges, and Host moderation actions.
 * Source of truth: docs/01-requirements.md FR-3 & docs/04 §1, §4.8, §4.9
 */

import React from 'react';
import { RoleMenu } from './RoleMenu.jsx';

/**
 * @param {Object} props
 * @param {Array<{ userId: string, username: string, role: string }>} props.participants
 * @param {{ userId?: string, role?: string } | null} props.self
 * @param {(msg: string) => void} [props.onError]
 */
export function ParticipantList({ participants, self, onError = () => {} }) {
  const isHost = self?.role === 'host';

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'host':
        return 'badge-host';
      case 'moderator':
        return 'badge-moderator';
      default:
        return 'badge-participant';
    }
  };

  return (
    <div className="participant-card">
      <div className="participant-header">
        <h3>Participants</h3>
        <span className="count-pill">{participants.length}</span>
      </div>
      <ul className="participant-list">
        {participants.map((p) => {
          const isSelf = self && p.userId === self.userId;
          return (
            <li key={p.userId} className={`participant-item ${isSelf ? 'is-self' : ''}`}>
              <div className="participant-info">
                <span className="participant-name">
                  {p.username}
                  {isSelf && <span className="you-tag">(You)</span>}
                </span>
              </div>
              <div className="participant-actions">
                <span className={`role-badge ${getRoleBadgeClass(p.role)}`}>
                  {p.role}
                </span>
                {isHost && (
                  <RoleMenu
                    participant={p}
                    isHost={isHost}
                    isSelf={isSelf}
                    onError={onError}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
