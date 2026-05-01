import React, { useRef, useState, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import { useMediaSync } from '../hooks/useMediaSync';
import { 
  Play, Pause, Maximize, Volume2, VolumeX, Upload, Zap,
  Link2, Monitor, X, PlayCircle, RotateCcw, RotateCw, SkipForward, List, Plus, FastForward, Trash2, Music
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Hls from 'hls.js';

const getYouTubeId = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : null;
};

interface MediaPlayerProps {
  streamToPeers?: (stream: MediaStream) => void;
  remoteStream?: MediaStream | null;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ streamToPeers, remoteStream }) => {
  const { room, userId, updateMedia, skipVideo, addToQueue, clearMedia } = useRoom();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHost = (userId && room?.participants?.[userId]) ? room.participants[userId].role === 'host' : false;
  
  useMediaSync({ videoRef, isHost });
  
  // 🔥 HLS Integration (m3u8 support)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !room.media.url) return;

    const isHLS = room.media.url.includes('.m3u8');
    let hls: Hls | null = null;

    if (isHLS) {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          autoStartLoad: true,
          startLevel: -1, // Auto quality
        });
        hls.loadSource(room.media.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (room.media.isPlaying) video.play().catch(() => {});
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native support (Safari)
        video.src = room.media.url;
      }
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [room.media.url, room.media.isPlaying]);

  // Stream local files to peers when the video element loads
  useEffect(() => {
    if (room?.media.type === 'local' && videoRef.current && isHost && streamToPeers) {
      const videoEl = videoRef.current;
      
      const captureAndStream = () => {
        try {
          // @ts-ignore - captureStream exists on HTMLMediaElement in modern browsers
          const stream = videoEl.captureStream ? videoEl.captureStream(30) : videoEl.mozCaptureStream ? videoEl.mozCaptureStream(30) : null;
          if (stream) {
            console.log("🎥 Captured local video stream (60 FPS), broadcasting to peers...");
            streamToPeers(stream);
          }
        } catch (err) {
          console.error("Failed to capture stream from local file", err);
        }
      };

      // If it's already playing or ready
      if (videoEl.readyState >= 3) {
        captureAndStream();
      } else {
        videoEl.addEventListener('canplay', captureAndStream, { once: true });
        return () => videoEl.removeEventListener('canplay', captureAndStream);
      }
    }

    // Clients play the remote stream for local files
    if (!isHost && room?.media.type === 'local' && remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(e => console.error("Auto-play blocked", e));
    }
  }, [room?.media.url, room?.media.type, isHost, streamToPeers, remoteStream]);

  // Track playback time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        // Update buffered ranges
        if (video.buffered.length > 0) {
            const lastBuffered = video.buffered.end(video.buffered.length - 1);
            setBuffered((lastBuffered / (video.duration || 1)) * 100);
        }
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [room?.media.url]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (!isHost || !videoRef.current) return;

      switch(e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          seek(-10);
          break;
        case 'ArrowRight':
          seek(10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, room?.media.isPlaying]);

  const seek = (seconds: number) => {
    if (!isHost || !videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHost || !videoRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || !videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    if (val > 0) setIsMuted(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = async (file: File) => {
    if (!file || isUploading) return;
    
    // For local host playback, we can use blob URL immediately for zero latency
    const localBlobUrl = URL.createObjectURL(file);
    updateMedia({ type: 'local', url: localBlobUrl, currentTime: 0, isPlaying: true });

    // Start background upload for others
    try {
      setIsUploading(true);
      setUploadProgress(0);
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/upload/${filename}`, true);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        setUploadProgress(null);
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          // 🛡️ Once uploaded, switch to the official streaming URL for everyone
          // Preserve current playback position for a seamless transition
          const currentPos = videoRef.current?.currentTime || 0;
          updateMedia({ type: 'url', url: res.url, currentTime: currentPos, isPlaying: true });
          console.log("✅ Movie ready for squad streaming:", res.url);
        }
      };

      xhr.onerror = () => {
        console.error("Upload failed");
        setIsUploading(false);
        setUploadProgress(null);
      };

      xhr.send(file);
    } catch (err) {
      console.error("Upload error", err);
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) {
      handleFileUpload(file);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      updateMedia({ type: 'url', url: urlInput.trim(), currentTime: 0, isPlaying: true });
      setUrlInput('');
    }
  };

  const isAudio = room.media.url?.match(/\.(mp3|wav|ogg|m4a|aac)$/i) || room.media.url?.includes('/audio/');

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isHost) return;

    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) {
      handleFileUpload(file);
    }
  };

  const togglePlay = () => {
    if (!isHost || !videoRef.current) return;
    updateMedia({ isPlaying: videoRef.current.paused });
  };

  if (!room) return null;

  return (
    <div 
        className={cn(
          "relative aspect-video bg-[#0d0d16] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl group transition-all duration-500"
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
    >
      {/* Cinema Mode Disabled */}
      {/* Interaction Guard moved to RoomPage for global coverage */}

      {/* Upload Progress Overlay */}
      <AnimatePresence>
        {uploadProgress !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-[100] p-12 text-center"
          >
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6" />
            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Syncing to Squad...</h3>
            <p className="text-sm text-slate-400 font-medium mb-8">Preparing high-fidelity stream for your friends</p>
            <div className="w-full max-w-md bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-400">{uploadProgress}% COMPLETE</span>
          </motion.div>
        )}
      </AnimatePresence>
      {!room.media.url && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
            <AnimatePresence>
                {isDragging && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-indigo-600/20 backdrop-blur-sm border-4 border-dashed border-indigo-500/50 rounded-[2.5rem] z-50 flex flex-col items-center justify-center"
                    >
                        <Upload size={48} className="text-white mb-4 animate-bounce" />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">Drop it here</h3>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-slate-700 mb-8 border border-white/5">
                <PlayCircle size={40} />
            </div>
            
            <h2 className="text-2xl font-black text-white tracking-tight uppercase mb-2">Host control panel</h2>
            <p className="text-slate-500 text-sm font-medium max-w-sm mb-10 leading-relaxed">
                {isHost 
                    ? "Drag an mp4/mp3 file or paste a URL to start the sync. Your squad is waiting." 
                    : "The host is currently picking the vibe. Chill out or chat with the squad."
                }
            </p>

            {isHost && (
                <div className="flex flex-col gap-4 w-full max-w-md">
                  <form onSubmit={handleUrlSubmit} className="relative w-full">
                      <input 
                          type="text"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="Paste YouTube or stream link..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-600 font-bold"
                      />
                      <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button 
                          type="button" 
                          onClick={() => { if(urlInput.trim()) { addToQueue(urlInput.trim()); setUrlInput(''); } }}
                          className="bg-white/5 text-white p-2 rounded-xl hover:bg-white/10 transition-all active:scale-95 border border-white/10"
                          title="Add to Queue"
                        >
                            <Plus size={14} />
                        </button>
                        <button className="bg-white text-black p-2 rounded-xl hover:bg-slate-200 transition-all shadow-lg active:scale-95" title="Play Now">
                            <Play size={14} fill="currentColor" />
                        </button>
                      </div>
                  </form>
                  
                  <div className="flex items-center gap-4 w-full">
                    <div className="flex-1 h-px bg-white/5"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">OR</span>
                    <div className="flex-1 h-px bg-white/5"></div>
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="video/*,audio/*" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Upload size={14} />
                    {isUploading ? 'SYNCING MEDIA...' : 'Browse Local Video or Audio'}
                  </button>
                </div>
            )}
        </div>
      )}

      {/* Video Content */}
      {room.media.url && (
        <>
            {getYouTubeId(room.media.url) ? (
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(room.media.url)}?autoplay=0&controls=1&rel=0&modestbranding=1&enablejsapi=1`}
                className="w-full h-full object-cover"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full relative bg-black">
                {isAudio && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0a16] to-[#120a1c] z-10 pointer-events-none">
                     <div className="w-40 h-40 rounded-full border border-indigo-500/20 flex items-center justify-center bg-indigo-500/5 shadow-[0_0_100px_rgba(99,102,241,0.1)] relative">
                        <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin-slow opacity-50" />
                        <div className="absolute inset-4 rounded-full border-b-2 border-purple-500 animate-spin-reverse opacity-50" />
                        <Music size={48} className={cn("text-indigo-400 transition-transform duration-100", !videoRef.current?.paused ? "animate-pulse scale-110" : "")} />
                     </div>
                     <h3 className="mt-8 text-xl font-black text-white uppercase tracking-[0.2em]">{room.media.title || 'VibeSync Audio'}</h3>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/5 shadow-lg">Synced in Real-Time</p>
                  </div>
                )}
                <video 
                    ref={videoRef}
                    src={room.media.url?.includes('.m3u8') ? undefined : ((!isHost && room.media.type === 'local') ? undefined : room.media.url)}
                    className="w-full h-full object-contain bg-black"
                    playsInline
                    controls={false}
                    preload="auto"
                    // @ts-ignore
                    disableRemotePlayback
                    webkit-playsinline="true"
                />
              </div>
            )}

            {/* Buffering Spinner */}
            <AnimatePresence>
              {isBuffering && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-40"
                >
                  <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Premium VLC/Netflix Controls */}
            <AnimatePresence>
                {isHovering && !getYouTubeId(room.media.url) && (
                  <>
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-0 inset-x-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col gap-4"
                    >
                        {/* Progress Bar */}
                        <div 
                          ref={progressRef}
                          className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer relative group/progress"
                          onClick={handleSeek}
                        >
                          {/* Buffered Progress */}
                          <div 
                            className="absolute inset-y-0 left-0 bg-white/10 rounded-full transition-all duration-300"
                            style={{ width: `${buffered}%` }}
                          />
                          {/* Play Progress */}
                          <div 
                            className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
                            style={{ width: `${((currentTime || 0) / (duration || 1)) * 100}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            {isHost && (
                              <div className="flex items-center gap-2">
                                <button onClick={() => seek(-10)} className="text-white/70 hover:text-white transition-colors">
                                  <RotateCcw size={20} />
                                </button>
                                <button onClick={togglePlay} className="w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95 shadow-xl">
                                    {room.media.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                                </button>
                                <button onClick={() => seek(10)} className="text-white/70 hover:text-white transition-colors">
                                  <RotateCw size={20} />
                                </button>
                                {room.queue?.length > 0 && (
                                  <button onClick={skipVideo} className="text-white/70 hover:text-white transition-colors ml-2">
                                    <SkipForward size={20} fill="currentColor" />
                                  </button>
                                )}
                                {/* 🔄 Change Video button */}
                                <button
                                  onClick={() => { if(confirm('Clear video for everyone and load something new?')) clearMedia(); }}
                                  className="ml-2 p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all active:scale-95"
                                  title="Change Video (clears for everyone)"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}

                            {!isHost && (
                              <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10">
                                {room.media.isPlaying ? <Volume2 size={20} /> : <Pause size={20} />}
                              </div>
                            )}

                            <div className="flex items-center gap-4">
                              {/* Volume Control */}
                              <div className="flex items-center gap-3 group/volume">
                                <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                </button>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.01"
                                  value={isMuted ? 0 : volume}
                                  onChange={handleVolumeChange}
                                  className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white overflow-hidden"
                                />
                              </div>

                              <div className="text-xs font-bold text-white/70 tracking-tight tabular-nums">
                                {formatTime(currentTime)} <span className="text-white/30 mx-1">/</span> {formatTime(duration)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  Synced
                              </div>
                              {room.queue?.length > 0 && (
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                                  <List size={12} />
                                  {room.queue.length} Next
                                </div>
                              )}

                              <div className="relative">
                                <button 
                                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                  className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-2"
                                >
                                  <FastForward size={12} />
                                  {playbackSpeed}x
                                </button>
                                
                                <AnimatePresence>
                                  {showSpeedMenu && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: -10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -10 }}
                                      className="absolute bottom-full right-0 mb-2 bg-[#0d0d16] border border-white/10 rounded-xl p-1 shadow-2xl z-[60] min-w-[80px]"
                                    >
                                      {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                                        <button 
                                          key={speed}
                                          onClick={() => {
                                            if (videoRef.current) {
                                              videoRef.current.playbackRate = speed;
                                              setPlaybackSpeed(speed);
                                              if (isHost || room.settings?.collaborativeControl) {
                                                updateMedia({ playbackRate: speed });
                                              }
                                            }
                                            setShowSpeedMenu(false);
                                          }}
                                          className={cn(
                                            "w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors",
                                            playbackSpeed === speed ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/5"
                                          )}
                                        >
                                          {speed}x
                                        </button>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>

                              <button className="text-white/70 hover:text-white transition-colors">
                                  <Maximize size={18} />
                              </button>
                          </div>
                        </div>
                    </motion.div>

                    {isHost && (
                      <motion.button 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => updateMedia({ url: null })}
                          className="absolute top-6 right-6 w-10 h-10 bg-black/50 text-red-400 hover:text-white hover:bg-red-500 rounded-xl flex items-center justify-center backdrop-blur-md transition-all z-50 border border-white/5"
                      >
                          <X size={20} />
                      </motion.button>
                    )}
                  </>
                )}
            </AnimatePresence>

            {/* Mode Indicator */}
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-indigo-600 px-3 py-1.5 rounded-xl shadow-lg">
                <Monitor size={12} className="text-white" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    {room.media.type === 'local' ? 'Local File' : 'Stream'}
                </span>
            </div>
        </>
      )}
    </div>
  );
};

export default MediaPlayer;
