/**
 * @file RoomPage.jsx
 * Main watch party room container.
 * Integrates synchronized YouTube IFrame player, playback controls, URL form, participant list,
 * and live role-aware UI switching.
 * Source of truth: docs/02-architecture.md §4 & docs/07-rbac-matrix.md §6
 */

import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom.js';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer.js';
import { VideoPlayer } from '../components/VideoPlayer.jsx';
import { PlaybackControls } from '../components/PlaybackControls.jsx';
import { VideoUrlForm } from '../components/VideoUrlForm.jsx';
import { ParticipantList } from '../components/ParticipantList.jsx';
import { ApprovalQueue } from '../components/ApprovalQueue.jsx';
import { ChatBox } from '../components/ChatBox.jsx';
import { Toast } from '../components/Toast.jsx';
import { getSession, saveSession, clearSession } from '../utils/session.js';
import { socket } from '../services/socket.js';

export function RoomPage() {
  const { roomId } = useParams();
  const normalizedRoomId = roomId ? roomId.toUpperCase() : '';

  // Check if username was already stored from HomePage or previous session
  const [username, setUsername] = useState(() => {
    return getSession(normalizedRoomId)?.username || '';
  });
  const [promptUsername, setPromptUsername] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  // Activate useRoom hook
  const {
    participants,
    self,
    syncState,
    connectionStatus,
    error,
    pendingRequests,
    resolvedNotification,
    requestChange,
    resolveChange,
    messages,
    sendChatMessage,
  } = useRoom(username ? normalizedRoomId : '', username);

  // Tabbed sidebar state (Chat vs Participants)
  const [activeSidebarTab, setActiveSidebarTab] = useState('chat');
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesCountRef = useRef(messages?.length || 0);

  useEffect(() => {
    if (activeSidebarTab === 'people') {
      const diff = (messages?.length || 0) - prevMessagesCountRef.current;
      if (diff > 0) {
        setUnreadCount((prev) => prev + diff);
      }
    } else {
      setUnreadCount(0);
    }
    prevMessagesCountRef.current = messages?.length || 0;
  }, [messages?.length, activeSidebarTab]);

  // Video container DOM ref
  const playerContainerRef = useRef(null);

  // YouTube player controller hook
  const {
    currentTime,
    duration,
    isAutoplayBlocked,
    resumePlayback,
  } = useYouTubePlayer({
    syncState,
    containerRef: playerContainerRef,
  });

  // Role permissions check (Host and Moderator can control playback)
  // Updates dynamically on role_assigned without needing page refresh (RE-2)
  const canControl = self?.role === 'host' || self?.role === 'moderator';

  // Show notification banner when a request is resolved
  useEffect(() => {
    if (resolvedNotification) {
      const act = resolvedNotification.action?.type === 'change_video'
        ? 'change video'
        : resolvedNotification.action?.type || 'action';
      const msg = `${resolvedNotification.username}'s request to ${act} was ${resolvedNotification.decision} by ${resolvedNotification.resolvedBy?.username || 'staff'}.`;
      setToastMessage(msg);
      setToastType(resolvedNotification.decision === 'approved' ? 'success' : 'info');
    }
  }, [resolvedNotification]);

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!promptUsername.trim()) return;
    const cleanName = promptUsername.trim();
    saveSession(normalizedRoomId, { username: cleanName });
    setUsername(cleanName);
  };

  const handleResolveChange = (requestId, decision) => {
    return new Promise((resolve) => {
      resolveChange(requestId, decision, (res) => {
        if (!res.ok) {
          setToastMessage(res.error?.message || 'Failed to resolve request');
          setToastType('error');
        } else {
          setToastMessage(`Request ${decision === 'approve' ? 'approved' : 'rejected'}.`);
          setToastType('success');
        }
        resolve(res);
      });
    });
  };

  const navigate = useNavigate();

  const handleCopyLink = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    });
  };

  const handleLeaveRoom = () => {
    socket.emit('leave_room', { roomId: normalizedRoomId }, () => {
      clearSession(normalizedRoomId);
      navigate('/');
    });
  };

  // If user opened a share link without a username, prompt them first
  if (!username) {
    return (
      <div className="home-container">
        <div className="card-box">
          <h2>Join Room {normalizedRoomId}</h2>
          <p className="subtitle">Enter your name to join this watch party.</p>
          <form onSubmit={handleJoinSubmit} className="form-group">
            <label htmlFor="promptUsername">Your Display Name</label>
            <input
              id="promptUsername"
              type="text"
              placeholder="e.g. Priyanshu"
              value={promptUsername}
              onChange={(e) => setPromptUsername(e.target.value)}
              maxLength={30}
              required
              autoFocus
            />
            <button type="submit" className="primary-btn">
              Join Party
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="room-layout">
      {/* Toast Alert Popup */}
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage('')}
      />

      {/* Top Navigation Bar */}
      <header className="room-navbar">
        <div className="navbar-brand">
          <Link to="/" className="nav-logo">
            <span className="logo-icon">▶</span> WatchParty
          </Link>
          <div className="room-badge-group">
            <span className="room-code-tag">Room: <strong>{normalizedRoomId}</strong></span>
            <button type="button" className="copy-link-btn" onClick={handleCopyLink}>
              {copiedToast ? '✓ Copied Link!' : '🔗 Share Link'}
            </button>
            <button type="button" className="leave-room-btn" onClick={handleLeaveRoom} title="Leave watch party">
              🚪 Leave Room
            </button>
          </div>
        </div>

        <div className="navbar-status">
          <span className={`status-indicator status-${connectionStatus}`}>
            ● {connectionStatus.toUpperCase()}
          </span>
          {self && (
            <span className="user-greeting">
              Signed in as <strong>{self.username}</strong> ({self.role})
            </span>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <Link to="/" className="error-home-link">Return to Home</Link>
        </div>
      )}

      {/* Main Content Area */}
      <main className="room-content">
        <div className="media-section">
          {/* Change Video Form for Host/Moderator, or Request Form for Participant */}
          <VideoUrlForm
            canControl={canControl}
            onRequestChange={requestChange}
            onSuccess={(msg) => {
              setToastMessage(msg);
              setToastType('success');
            }}
            onError={(err) => {
              setToastMessage(err);
              setToastType('error');
            }}
          />

          {/* YouTube Player */}
          <VideoPlayer
            containerRef={playerContainerRef}
            videoId={syncState?.videoId || null}
            isAutoplayBlocked={isAutoplayBlocked}
            onResumePlayback={resumePlayback}
            canControl={canControl}
            onTogglePlayPause={() => {
              if (canControl) {
                if (syncState?.playState === 'playing') {
                  socket.emit('pause', { currentTime });
                } else {
                  socket.emit('play', { currentTime });
                }
              }
            }}
          />

          {/* Custom Playback Controls */}
          <PlaybackControls
            syncState={syncState}
            currentTime={currentTime}
            duration={duration}
            canControl={canControl}
            onRequestChange={requestChange}
            onSuccess={(msg) => {
              setToastMessage(msg);
              setToastType('success');
            }}
            onError={(err) => {
              setToastMessage(err);
              setToastType('error');
            }}
          />
        </div>

        {/* Sidebar: Staff Approval Queue + Tabbed Navigation (Chat vs People) */}
        <aside className="sidebar-section">
          <ApprovalQueue
            requests={pendingRequests}
            onResolve={handleResolveChange}
            isStaff={canControl}
          />

          <div className="sidebar-tabs-header">
            <button
              type="button"
              className={`sidebar-tab-btn ${activeSidebarTab === 'chat' ? 'active' : ''}`}
              onClick={() => {
                setActiveSidebarTab('chat');
                setUnreadCount(0);
              }}
            >
              <span>💬 Chat</span>
              {unreadCount > 0 && (
                <span className="tab-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            <button
              type="button"
              className={`sidebar-tab-btn ${activeSidebarTab === 'people' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('people')}
            >
              <span>👥 People</span>
              <span className="tab-count-pill">{participants.length}</span>
            </button>
          </div>

          {activeSidebarTab === 'chat' ? (
            <ChatBox
              messages={messages}
              onSendMessage={sendChatMessage}
              self={self}
            />
          ) : (
            <ParticipantList
              participants={participants}
              self={self}
              onError={(msg) => {
                setToastMessage(msg);
                setToastType('error');
              }}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

