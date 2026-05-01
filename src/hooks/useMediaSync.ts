import React, { useEffect, useRef, useState } from 'react';
import { useRoom } from '../context/RoomContext';

interface MediaSyncProps {
  videoRef: React.RefObject<HTMLVideoElement | HTMLAudioElement>;
  isHost: boolean;
}

export const useMediaSync = ({ videoRef, isHost }: MediaSyncProps) => {
  const { socket, room } = useRoom();
  const timeOffsetRef = useRef(0); // Use ref to avoid stale closures
  const lastSyncRef = useRef(0);

  // ─── STEP 1: NTP-style Clock Sync for ngrok latency correction ───────────
  useEffect(() => {
    if (!socket) return;

    const pingBuffer: number[] = [];

    const doPing = () => {
      const start = Date.now();
      socket.emit('ping-server', start);
    };

    const handlePong = ({
      clientTimestamp,
      serverTimestamp,
    }: {
      clientTimestamp: number;
      serverTimestamp: number;
    }) => {
      const now = Date.now();
      const rtt = now - clientTimestamp;
      const offset = serverTimestamp - clientTimestamp - rtt / 2;
      pingBuffer.push(offset);
      if (pingBuffer.length > 8) pingBuffer.shift();
      // Use median for stability (outlier resistant)
      const sorted = [...pingBuffer].sort((a, b) => a - b);
      timeOffsetRef.current = sorted[Math.floor(sorted.length / 2)];
    };

    socket.on('pong-server', handlePong);
    doPing(); // immediate first ping
    const interval = setInterval(doPing, 4000);

    return () => {
      clearInterval(interval);
      socket.off('pong-server', handlePong);
    };
  }, [socket]);

  // ─── STEP 2: Main Sync Logic ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !room || !videoRef.current) return;

    if (isHost) {
      // ── HOST: Emit state on events + periodic heartbeat ──────────────────
      const emitState = (isInterrupt = false) => {
        const video = videoRef.current;
        if (!video) return;
        socket.emit('sync-video', {
          code: room.code,
          currentTime: video.currentTime,
          isPlaying: !video.paused,
          timestamp: Date.now() + timeOffsetRef.current,
          isInterrupt,
        });
      };

      // Instant signals on user action
      const onSeek = () => emitState(true);
      const onPlay = () => emitState(true);
      const onPause = () => emitState(true);

      const videoEl = videoRef.current;
      videoEl.addEventListener('seeked', onSeek);
      videoEl.addEventListener('play', onPlay);
      videoEl.addEventListener('pause', onPause);

      // Background heartbeat every 250ms for ultra-smooth synchronization
      const heartbeat = setInterval(() => emitState(false), 250);

      return () => {
        clearInterval(heartbeat);
        videoEl.removeEventListener('seeked', onSeek);
        videoEl.removeEventListener('play', onPlay);
        videoEl.removeEventListener('pause', onPause);
      };
    } else {
      // ── GUEST: React to host signals ───────────────────────────────────
      const handleSync = ({
        currentTime,
        isPlaying,
        timestamp,
        isInterrupt,
      }: {
        currentTime: number;
        isPlaying: boolean;
        timestamp: number;
        isInterrupt?: boolean;
      }) => {
        const video = videoRef.current;
        if (!video) return;

        // Debounce rapid non-interrupt signals
        const now = Date.now();
        if (!isInterrupt && now - lastSyncRef.current < 400) return;
        lastSyncRef.current = now;

        // Correct for ngrok tunnel latency using synchronized clock
        const trueNow = Date.now() + timeOffsetRef.current;
        const networkDelay = (trueNow - timestamp) / 1000;
        const targetTime = currentTime + (isPlaying ? networkDelay : 0);
        const drift = Math.abs(video.currentTime - targetTime);

        // ── SYNC ENGINE v6: Discord-Level Precision ──────────────────────
        if (isInterrupt && drift > 0.1) {
          // Host seeked/paused/played → snap immediately
          video.currentTime = targetTime;
        } else if (drift > 0.5) {
          // Large drift (buffering lag) → hard sync
          video.currentTime = targetTime;
        } else if (drift > 0.08) {
          // Small drift → gentle rate nudge (invisible to viewer)
          video.playbackRate = video.currentTime < targetTime ? 1.07 : 0.93;
        } else {
          // Perfect sync
          video.playbackRate = 1.0;
        }

        // Sync play/pause state
        if (isPlaying && video.paused) {
          video.play().catch(() => {});
        } else if (!isPlaying && !video.paused) {
          video.pause();
        }
      };

      socket.on('video-sync', handleSync);
      return () => {
        socket.off('video-sync', handleSync);
      };
    }
  }, [socket, isHost, room?.code, room?.media?.url]);

  return null;
};
