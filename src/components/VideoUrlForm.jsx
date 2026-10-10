/**
 * @file VideoUrlForm.jsx
 * Form component allowing Host and Moderator to change the room video.
 * Source of truth: docs/04-websocket-events.md §4.7
 */

import React, { useState } from 'react';
import { socket } from '../services/socket.js';
import { extractVideoId } from '../utils/youtube.js';

/**
 * @param {Object} props
 * @param {boolean} props.canControl - True for Host and Moderator
 * @param {(action: Object, cb: Function) => void} [props.onRequestChange]
 * @param {(msg: string) => void} [props.onSuccess]
 * @param {(msg: string) => void} [props.onError]
 */
export function VideoUrlForm({ canControl, onRequestChange, onSuccess, onError }) {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      setError('Invalid YouTube URL or Video ID');
      return;
    }

    setLoading(true);

    if (canControl) {
      socket.emit('change_video', { videoId }, (response) => {
        setLoading(false);
        if (!response.ok) {
          const err = response.error?.message || 'Failed to change video';
          setError(err);
          if (onError) onError(err);
        } else {
          setUrlInput('');
          if (onSuccess) onSuccess('Video changed successfully!');
        }
      });
    } else {
      // Participant request change flow (FR-11)
      if (onRequestChange) {
        onRequestChange({ type: 'change_video', videoId }, (response) => {
          setLoading(false);
          if (!response.ok) {
            const err = response.error?.message || 'Failed to submit request';
            setError(err);
            if (onError) onError(err);
          } else {
            setUrlInput('');
            if (onSuccess) onSuccess('Change requested! Waiting for Host/Moderator approval.');
          }
        });
      }
    }
  };

  return (
    <div className={`video-url-card ${!canControl ? 'is-participant' : ''}`}>
      <form onSubmit={handleSubmit} className="video-url-form">
        <input
          type="text"
          placeholder={
            canControl
              ? 'Paste YouTube URL or Video ID (e.g. https://www.youtube.com/watch?v=...)'
              : 'Suggest a video: Paste YouTube URL or Video ID'
          }
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className={canControl ? 'change-video-btn' : 'request-video-btn'}
          disabled={loading || !urlInput.trim()}
        >
          {loading
            ? 'Submitting...'
            : canControl
            ? 'Load Video'
            : '🙋 Request Video Change'}
        </button>
      </form>
      {error && <div className="url-error">{error}</div>}
    </div>
  );
}

