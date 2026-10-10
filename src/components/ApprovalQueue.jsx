/**
 * @file ApprovalQueue.jsx
 * Component displaying pending participant change requests for Host and Moderators.
 * Source of truth: docs/01-requirements.md FR-11, docs/04-websocket-events.md §6.2
 */

import React, { useState } from 'react';

function formatAction(action) {
  if (!action) return 'Unknown action';
  switch (action.type) {
    case 'play':
      return '▶ Play Video';
    case 'pause':
      return '⏸ Pause Video';
    case 'seek': {
      const minutes = Math.floor(action.time / 60);
      const seconds = Math.floor(action.time % 60);
      const pad = (n) => String(n).padStart(2, '0');
      return `⏩ Seek to ${pad(minutes)}:${pad(seconds)} (${action.time}s)`;
    }
    case 'change_video':
      return `📺 Change Video (${action.videoId})`;
    default:
      return `${action.type}`;
  }
}

/**
 * @param {Object} props
 * @param {Array} props.requests - Array of pending change requests
 * @param {(requestId: string, decision: 'approve' | 'reject') => void} props.onResolve
 * @param {boolean} props.isStaff - True for Host and Moderator
 */
export function ApprovalQueue({ requests = [], onResolve, isStaff }) {
  const [resolvingId, setResolvingId] = useState(null);

  if (!isStaff) return null;

  const handleDecision = async (requestId, decision) => {
    setResolvingId(requestId);
    try {
      await onResolve(requestId, decision);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="approval-queue-card">
      <div className="queue-header">
        <div className="queue-title-group">
          <span className="queue-icon">📋</span>
          <h3>Approval Queue</h3>
        </div>
        <span className="queue-count-badge">
          {requests.length} {requests.length === 1 ? 'request' : 'requests'}
        </span>
      </div>

      {requests.length === 0 ? (
        <p className="empty-queue-msg">No pending requests from participants.</p>
      ) : (
        <ul className="queue-list">
          {requests.map((req) => (
            <li key={req.requestId} className="queue-item">
              <div className="queue-item-info">
                <span className="queue-requester">
                  <strong>{req.username}</strong> requested:
                </span>
                <span className="queue-action-label">{formatAction(req.action)}</span>
              </div>
              <div className="queue-action-btns">
                <button
                  type="button"
                  className="approve-btn"
                  disabled={resolvingId === req.requestId}
                  onClick={() => handleDecision(req.requestId, 'approve')}
                  title="Approve this request"
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  className="reject-btn"
                  disabled={resolvingId === req.requestId}
                  onClick={() => handleDecision(req.requestId, 'reject')}
                  title="Reject this request"
                >
                  ✕ Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
