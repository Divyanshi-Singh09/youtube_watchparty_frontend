/**
 * @file ChatBox.jsx
 * Real-time live room chat component.
 * Features auto-scrolling, quick reaction emojis, character counting,
 * role badge indicators, and responsive message layout.
 */

import React, { useState, useRef, useEffect } from 'react';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🍿', '👏', '🎉', '😮'];

/**
 * Formats unix timestamp into a readable time string (e.g., 4:32 PM).
 * @param {number} timestamp
 * @returns {string}
 */
function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ChatBox({ messages = [], onSendMessage, self }) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages if user is already near bottom
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setShowScrollBottom(!isAtBottom);
  };

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  // Initial scroll to bottom on mount
  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    if (trimmed.length > 500) {
      setErrorNotice('Message exceeds 500 characters.');
      setTimeout(() => setErrorNotice(null), 3500);
      return;
    }

    setIsSending(true);
    setErrorNotice(null);

    onSendMessage(trimmed, (res) => {
      setIsSending(false);
      if (res && !res.ok) {
        setErrorNotice(res.error?.message || 'Failed to send message');
        setTimeout(() => setErrorNotice(null), 3500);
      } else {
        setInputText('');
        if (inputRef.current) {
          inputRef.current.focus();
        }
        scrollToBottom('smooth');
      }
    });
  };

  const handleEmojiClick = (emoji) => {
    setInputText((prev) => {
      const updated = prev ? `${prev} ${emoji}` : emoji;
      return updated.slice(0, 500);
    });
    inputRef.current?.focus();
  };

  return (
    <div className="chat-card">
      {/* Live Chat Header */}
      <div className="chat-header">
        <div className="chat-header-title">
          <span className="live-status-dot" title="Live connection active" />
          <h3>Live Chat</h3>
        </div>
        <span className="chat-count-pill">
          {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
        </span>
      </div>

      {/* Error / Rate Limit Notice */}
      {errorNotice && (
        <div className="chat-error-banner" role="alert">
          <span>⚠️ {errorNotice}</span>
        </div>
      )}

      {/* Messages Scroll Container */}
      <div
        className="chat-messages-container"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <span className="chat-empty-icon">💬</span>
            <p>No messages yet.</p>
            <span className="chat-empty-hint">Say hi to everyone in the party!</span>
          </div>
        ) : (
          messages.map((msg, idx) => {
            // Check if system notice
            if (msg.type === 'system' || msg.system) {
              return (
                <div key={msg.messageId || `sys-${idx}`} className="chat-system-notice">
                  <span className="system-pill">
                    {msg.text || msg.message}
                  </span>
                </div>
              );
            }

            const isSelf = self && msg.userId === self.userId;

            return (
              <div
                key={msg.messageId || `msg-${idx}`}
                className={`chat-bubble-wrapper ${isSelf ? 'wrapper-self' : 'wrapper-other'}`}
              >
                {!isSelf && (
                  <div className="chat-sender-header">
                    <span className="chat-sender-name">{msg.username}</span>
                    {msg.role && (
                      <span className={`role-badge badge-${msg.role}`}>
                        {msg.role}
                      </span>
                    )}
                  </div>
                )}

                <div className={`chat-bubble ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
                  <p className="chat-message-text">{msg.message}</p>
                  <span className="chat-timestamp">
                    {formatMessageTime(msg.sentAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          className="chat-scroll-bottom-btn"
          onClick={() => scrollToBottom('smooth')}
          aria-label="Scroll to newest messages"
        >
          ↓ New messages
        </button>
      )}

      {/* Quick Emoji Reaction Bar */}
      <div className="quick-emoji-row">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="quick-emoji-btn"
            onClick={() => handleEmojiClick(emoji)}
            title={`Add ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Chat Input Controls */}
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="chat-input-field"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={500}
            disabled={isSending}
          />
          {inputText.length > 350 && (
            <span className={`char-counter ${inputText.length >= 480 ? 'counter-danger' : ''}`}>
              {inputText.length}/500
            </span>
          )}
        </div>
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!inputText.trim() || isSending}
          title="Send message (Enter)"
        >
          {isSending ? '...' : '➤'}
        </button>
      </form>
    </div>
  );
}
