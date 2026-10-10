/**
 * @file VideoPlayer.jsx
 * YouTube video player container component with click-shield and autoplay-blocked overlay.
 * Enforces role-based interaction: participants cannot pause/resume the video locally.
 * Source of truth: docs/02-architecture.md §8 & docs/07-rbac-matrix.md
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {React.RefObject<HTMLDivElement>} props.containerRef
 * @param {string|null} props.videoId
 * @param {boolean} props.isAutoplayBlocked
 * @param {() => void} props.onResumePlayback
 * @param {boolean} [props.canControl=false]
 * @param {() => void} [props.onTogglePlayPause]
 */
export function VideoPlayer({
  containerRef,
  videoId,
  isAutoplayBlocked,
  onResumePlayback,
  canControl = false,
  onTogglePlayPause,
}) {
  const handleShieldClick = () => {
    if (isAutoplayBlocked) {
      if (onResumePlayback) onResumePlayback();
    } else if (canControl && onTogglePlayPause) {
      onTogglePlayPause();
    }
  };

  return (
    <div className="player-wrapper">
      {/* Target DOM element where YouTube IFrame mounts */}
      <div className="iframe-box">
        <div ref={containerRef} className="youtube-container" />

        {/* Transparent click-shield: blocks direct mouse interaction with YouTube's iframe
            so participants cannot pause, play, or scrub locally. Host/Moderator clicks toggle playback. */}
        <div
          className="iframe-shield"
          onClick={handleShieldClick}
          style={{
            cursor: canControl || isAutoplayBlocked ? 'pointer' : 'default',
          }}
          title={!canControl ? 'View-only mode: playback is controlled by the Host/Moderator' : 'Click to Play/Pause'}
        />
      </div>

      {/* Placeholder when room has no video */}
      {!videoId && (
        <div className="player-empty-state">
          <span className="empty-icon">📺</span>
          <h3>No Video Loaded</h3>
          <p>The Host or a Moderator can paste a YouTube URL above to begin.</p>
        </div>
      )}

      {/* Autoplay-blocked user-gesture overlay */}
      {isAutoplayBlocked && (
        <div className="autoplay-overlay" onClick={onResumePlayback}>
          <div className="autoplay-modal" onClick={(e) => e.stopPropagation()}>
            <span className="autoplay-icon">🔊</span>
            <h4>Playback Paused / Muted by Browser</h4>
            <p>Your browser blocked unmuted autoplay. Click below to join the synchronized stream.</p>
            <button type="button" className="unblock-btn" onClick={onResumePlayback}>
              ▶ Unmute & Play
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
