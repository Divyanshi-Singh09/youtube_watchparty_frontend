/**
 * @file HomePage.jsx
 * Landing page allowing users to create a new watch party or join an existing room by code.
 * Source of truth: docs/06-user-flows.md Flow 1 & Flow 4
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../services/api.js';
import { saveSession } from '../utils/session.js';
import { extractVideoId } from '../utils/youtube.js';

export function HomePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'

  // Create form state
  const [createUsername, setCreateUsername] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join form state
  const [joinUsername, setJoinUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!createUsername.trim()) {
      setCreateError('Please enter a username');
      return;
    }

    let parsedVideoId = null;
    if (videoUrl.trim()) {
      parsedVideoId = extractVideoId(videoUrl);
      if (!parsedVideoId) {
        setCreateError('Invalid YouTube URL or Video ID');
        return;
      }
    }

    setCreateLoading(true);
    try {
      const data = await createRoom({
        username: createUsername.trim(),
        videoId: parsedVideoId || undefined,
      });

      // Save Host credentials to session storage
      saveSession(data.roomId, {
        userId: data.userId,
        sessionToken: data.sessionToken,
        username: createUsername.trim(),
      });

      navigate(`/room/${data.roomId}`);
    } catch (err) {
      setCreateError(err.message || 'Failed to create room');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    setJoinError('');

    if (!joinUsername.trim()) {
      setJoinError('Please enter a username');
      return;
    }

    const cleanCode = roomCode.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(cleanCode)) {
      setJoinError('Room code must be 8 characters (letters and numbers)');
      return;
    }

    // Save intended username to session storage
    saveSession(cleanCode, {
      username: joinUsername.trim(),
    });

    navigate(`/room/${cleanCode}`);
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="brand-logo">
          <span className="logo-icon">▶</span>
          <h1>YouTube Watch Party</h1>
        </div>
        <p className="subtitle">Watch synchronized videos together with friends in real time.</p>
      </header>

      <div className="card-box">
        <div className="tab-switcher">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Room
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            Join by Code
          </button>
        </div>

        {activeTab === 'create' ? (
          <form onSubmit={handleCreateRoom} className="form-group">
            {createError && <div className="alert-error">{createError}</div>}

            <label htmlFor="createUsername">Your Display Name</label>
            <input
              id="createUsername"
              type="text"
              placeholder="e.g. Rahul"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              maxLength={30}
              required
            />

            <label htmlFor="videoUrl">YouTube URL or Video ID (Optional)</label>
            <input
              id="videoUrl"
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />

            <button type="submit" className="primary-btn" disabled={createLoading}>
              {createLoading ? 'Creating Room...' : 'Create Watch Party (Become Host)'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinByCode} className="form-group">
            {joinError && <div className="alert-error">{joinError}</div>}

            <label htmlFor="joinUsername">Your Display Name</label>
            <input
              id="joinUsername"
              type="text"
              placeholder="e.g. Asha"
              value={joinUsername}
              onChange={(e) => setJoinUsername(e.target.value)}
              maxLength={30}
              required
            />

            <label htmlFor="roomCode">8-Character Room Code</label>
            <input
              id="roomCode"
              type="text"
              placeholder="e.g. K7F9QX2M"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={8}
              required
            />

            <button type="submit" className="primary-btn">
              Join Party as Participant
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
