/**
 * @file Toast.jsx
 * Transient notification toast banner for alerts and error messages.
 */

import React, { useEffect } from 'react';

/**
 * @param {Object} props
 * @param {string} props.message
 * @param {'error' | 'success' | 'info'} [props.type='error']
 * @param {() => void} props.onClose
 * @param {number} [props.duration=4000]
 */
export function Toast({ message, type = 'error', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast-container toast-${type}`}>
      <span className="toast-icon">
        {type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ️'}
      </span>
      <span className="toast-text">{message}</span>
      <button type="button" className="toast-close-btn" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
