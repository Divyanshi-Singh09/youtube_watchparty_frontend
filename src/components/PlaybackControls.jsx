/**
 * @file PlaybackControls.jsx
 * Custom video playback controls for Host and Moderator.
 * Emits play, pause, and seek WebSocket events.
 * Source of truth: docs/02-architecture.md §4 & docs/04-websocket-events.md
 */

import React, { useState } from 'react';
import { socket } from '../services/socket.js';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * @param {Object} props
 * @param {import('../../backend/src/domain/PlaybackState.js').SyncStateDTO | null} props.syncState
 * @param {number} props.currentTime
 * @param {number} props.duration
 * @param {boolean} props.canControl - True for Host and Moderator
 */
export function PlaybackControls({
  syncState,
  currentTime,
  duration,
  canControl,
  onRequestChange,
  onSuccess,
  onError,
}) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const isPlaying = syncState?.playState === 'playing';
  const displayTime = isScrubbing ? scrubValue : currentTime;

  const handleTogglePlayPause = () => {
    if (!canControl) return;

    if (isPlaying) {
      socket.emit('pause', { currentTime });
    } else {
      socket.emit('play', { currentTime });
    }
  };

  const handleSeekChange = (e) => {
    if (!canControl) return;
    setIsScrubbing(true);
    setScrubValue(parseFloat(e.target.value));
  };

  const handleSeekCommit = () => {
    if (!canControl) return;
    setIsScrubbing(false);
    socket.emit('seek', { time: scrubValue });
  };

  if (!canControl) {
    const handleRequestAction = (action) => {
      if (!onRequestChange) return;
      onRequestChange(action, (res) => {
        if (!res.ok) {
          if (onError) onError(res.error?.message || 'Failed to request action');
        } else {
          if (onSuccess) onSuccess('Action requested! Waiting for approval.');
        }
      });
    };

    return (
      <div className="controls-bar is-viewer">
        <div className="participant-request-controls">
          {isPlaying ? (
            <button
              type="button"
              className="request-btn"
              onClick={() => handleRequestAction({ type: 'pause' })}
              title="Request pause"
            >
              ⏸ Request Pause
            </button>
          ) : (
            <button
              type="button"
              className="request-btn"
              onClick={() => handleRequestAction({ type: 'play' })}
              title="Request play"
            >
              ▶ Request Play
            </button>
          )}
          <span className="viewer-notice">
            🔒 View-only mode. Use buttons to request changes.
          </span>
        </div>
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    );
  }


  return (
    <div className="controls-bar">
      <div className="controls-main-group">
        <button
          type="button"
          className="control-play-btn"
          onClick={handleTogglePlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <div className="time-display-mobile">
          <span className="time-current">{formatTime(displayTime)}</span> / <span className="time-duration">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="scrubber-container">
        <span className="time-current desktop-time">{formatTime(displayTime)}</span>
        <input
          type="range"
          className="seek-slider"
          min="0"
          max={duration || 100}
          step="0.5"
          value={displayTime}
          onChange={handleSeekChange}
          onMouseUp={handleSeekCommit}
          onTouchEnd={handleSeekCommit}
          disabled={!canControl}
          aria-label="Video seek slider"
        />
        <span className="time-duration desktop-time">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
