/**
 * @file useYouTubePlayer.js
 * Custom hook wrapping the YouTube IFrame Player API.
 * Enforces controls: 0, prevents echo loops via isApplyingRemote, and handles drift correction & browser autoplay policies.
 * Source of truth: docs/02-architecture.md §4, §8, §9
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const DRIFT_THRESHOLD = 1.0; // Seconds of deviation before triggering seek correction
const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Loads the YouTube IFrame Player API script if not already on the page.
 * @returns {Promise<void>}
 */
function loadYouTubeIframeApi() {
  return new Promise((resolve) => {
    if (window.YT && typeof window.YT.Player === 'function') {
      resolve();
      return;
    }

    const existingTag = document.getElementById('yt-iframe-api');
    if (!existingTag) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const interval = setInterval(() => {
      if (window.YT && typeof window.YT.Player === 'function') {
        clearInterval(interval);
        resolve();
      }
    }, 50);

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearInterval(interval);
      if (typeof previousCallback === 'function') previousCallback();
      resolve();
    };
  });
}

/**
 * @param {Object} params
 * @param {import('../../backend/src/domain/PlaybackState.js').SyncStateDTO | null} params.syncState
 * @param {React.RefObject<HTMLDivElement>} params.containerRef
 */
export function useYouTubePlayer({ syncState, containerRef }) {
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);

  // Guard flag preventing remote sync updates from triggering local echo events
  const isApplyingRemote = useRef(false);
  const currentVideoIdRef = useRef(null);
  const isInitializingRef = useRef(false);

  // Keep a ref to the latest syncState so asynchronous onReady and callbacks can read the newest values
  const syncStateRef = useRef(syncState);
  useEffect(() => {
    syncStateRef.current = syncState;
  }, [syncState]);

  // Helper to safely play with muted fallback if browser blocks unmuted playback
  const attemptPlay = useCallback((player) => {
    if (!player || typeof player.playVideo !== 'function') return;

    try {
      player.playVideo();
    } catch (e) {
      console.warn('Direct playVideo error:', e);
    }

    // Check after 600ms if playback was blocked by browser
    setTimeout(() => {
      if (!playerRef.current) return;
      try {
        const state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
        // State 1 = PLAYING, State 3 = BUFFERING
        if (state !== 1 && state !== 3 && syncStateRef.current?.playState === 'playing') {
          console.info('Unmuted autoplay blocked by browser policy. Falling back to muted playback with unmute prompt.');
          if (typeof player.mute === 'function') {
            player.mute();
          }
          player.playVideo();
          setIsAutoplayBlocked(true);
        }
      } catch {
        // Ignore player state errors
      }
    }, 600);
  }, []);

  // 1. Manage Player instantiation and video switching
  useEffect(() => {
    let isCancelled = false;
    const currentVideoId = syncState?.videoId;
    const isValidId = Boolean(currentVideoId && VIDEO_ID_REGEX.test(currentVideoId));

    // If no video or invalid ID, tear down player if it exists
    if (!isValidId) {
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch {
          // Ignore destroy errors
        }
        playerRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      currentVideoIdRef.current = null;
      setIsReady(false);
      setCurrentTime(0);
      setDuration(0);
      isInitializingRef.current = false;
      return;
    }

    // If player does not exist yet and isn't currently initializing, instantiate it
    if (!playerRef.current && !isInitializingRef.current) {
      if (!containerRef.current) return;

      isInitializingRef.current = true;

      loadYouTubeIframeApi().then(() => {
        if (isCancelled || !containerRef.current || playerRef.current) {
          isInitializingRef.current = false;
          return;
        }

        // Mount to a dedicated child element to avoid removing containerRef from React's DOM tree
        containerRef.current.innerHTML = '';
        const mountElem = document.createElement('div');
        mountElem.style.width = '100%';
        mountElem.style.height = '100%';
        containerRef.current.appendChild(mountElem);

        currentVideoIdRef.current = currentVideoId;

        const initialTargetTime = Math.floor(syncStateRef.current?.currentTime || 0);

        playerRef.current = new window.YT.Player(mountElem, {
          width: '100%',
          height: '100%',
          videoId: currentVideoId,
          playerVars: {
            controls: 0, // Avoid native controls (no seek detection, avoids unauthorized scrubbing)
            disablekb: 1, // Disable keyboard shortcuts
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
            start: initialTargetTime,
          },
          events: {
            onReady: (event) => {
              isInitializingRef.current = false;
              if (isCancelled) return;

              setIsReady(true);
              const dur = event.target.getDuration ? (event.target.getDuration() || 0) : 0;
              setDuration(dur);

              const latest = syncStateRef.current;
              if (latest) {
                if (latest.currentTime && latest.currentTime > 0) {
                  event.target.seekTo(latest.currentTime, true);
                }

                if (latest.playState === 'playing') {
                  attemptPlay(event.target);
                } else {
                  if (typeof event.target.pauseVideo === 'function') {
                    event.target.pauseVideo();
                  }
                  setIsAutoplayBlocked(false);
                }
              }
            },
            onStateChange: (event) => {
              // event.data: 1 = PLAYING, 2 = PAUSED
              if (event.data === 1) {
                // If playing and unmuted, clear any autoplay blocked overlay
                const isMuted = event.target.isMuted ? event.target.isMuted() : false;
                if (!isMuted) {
                  setIsAutoplayBlocked(false);
                }
              } else if (event.data === 2) {
                // If server is playing but player unexpectedly paused (e.g. browser autoplay block)
                if (syncStateRef.current?.playState === 'playing') {
                  const isMuted = event.target.isMuted ? event.target.isMuted() : false;
                  if (!isMuted) {
                    // Try muted playback fallback
                    if (typeof event.target.mute === 'function') {
                      event.target.mute();
                    }
                    event.target.playVideo();
                    setIsAutoplayBlocked(true);
                  }
                }
              }
            },
            onError: (err) => {
              isInitializingRef.current = false;
              console.warn('YouTube Player Error:', err?.data);
            },
          },
        });
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [syncState?.videoId, containerRef, attemptPlay]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch {
          // Ignore destroy errors
        }
        playerRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      setIsReady(false);
      currentVideoIdRef.current = null;
    };
  }, [containerRef]);

  // 2. Synchronize Player whenever server syncState updates while player is ready
  useEffect(() => {
    const player = playerRef.current;
    if (!isReady || !player || !syncState || !syncState.videoId) return;

    isApplyingRemote.current = true;

    try {
      // Step A: Video changed on an active player?
      if (syncState.videoId !== currentVideoIdRef.current) {
        currentVideoIdRef.current = syncState.videoId;
        if (syncState.playState === 'playing') {
          if (typeof player.loadVideoById === 'function') {
            player.loadVideoById({
              videoId: syncState.videoId,
              startSeconds: syncState.currentTime || 0,
            });
          }
        } else {
          if (typeof player.loadVideoById === 'function') {
            player.loadVideoById({
              videoId: syncState.videoId,
              startSeconds: syncState.currentTime || 0,
            });
            if (typeof player.pauseVideo === 'function') {
              player.pauseVideo();
            }
          }
        }
      }

      // Step B: Seek drift check
      if (typeof player.seekTo === 'function') {
        const currentPos = player.getCurrentTime ? (player.getCurrentTime() || 0) : 0;
        const targetPos = syncState.currentTime || 0;
        if (Math.abs(currentPos - targetPos) > DRIFT_THRESHOLD) {
          player.seekTo(targetPos, true);
        }
      }

      // Step C: Play / Pause alignment
      if (syncState.playState === 'playing') {
        attemptPlay(player);
      } else {
        if (typeof player.pauseVideo === 'function') {
          player.pauseVideo();
        }
        setIsAutoplayBlocked(false);
      }
    } catch (err) {
      console.warn('Error synchronizing YouTube player:', err);
    } finally {
      // Release echo-guard
      isApplyingRemote.current = false;
    }
  }, [syncState, isReady, attemptPlay]);

  // 3. Polling timer for scrubber UI and drift correction
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      try {
        const currentSec = player.getCurrentTime() || 0;
        setCurrentTime(currentSec);
        if (typeof player.getDuration === 'function') {
          setDuration(player.getDuration() || 0);
        }

        // Periodic drift correction every ~5 seconds when playing
        if (syncState?.playState === 'playing' && syncState.updatedAt) {
          const elapsedSinceUpdate = (Date.now() - syncState.updatedAt) / 1000;
          const expectedTime = syncState.currentTime + elapsedSinceUpdate;

          if (Math.abs(currentSec - expectedTime) > DRIFT_THRESHOLD && typeof player.seekTo === 'function') {
            player.seekTo(expectedTime, true);
          }
        }
      } catch {
        // Player might be in between video transitions
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isReady, syncState]);

  // User gesture handler to unblock and unmute playback
  const resumePlayback = useCallback(() => {
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.unMute === 'function') {
          playerRef.current.unMute();
        }
        if (typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
      } catch (e) {
        console.warn('Error unblocking playback:', e);
      }
      setIsAutoplayBlocked(false);
    }
  }, []);

  return {
    player: playerRef.current,
    isReady,
    currentTime,
    duration,
    isAutoplayBlocked,
    resumePlayback,
  };
}
