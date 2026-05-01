import React, { useEffect, useState, useRef } from 'react';
import { useRoom } from '../context/RoomContext';
import { useWebRTC, PeerConnection } from '../hooks/useWebRTC';
import { useParams, Navigate } from 'react-router-dom';
import {
  LogOut, Share2, Disc, Play, Monitor,
  MessageSquare, Users, Sparkles, Settings, Check,
  Mic, MicOff, Video, VideoOff, PhoneOff, Film
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// Subcomponents
import ParticipantList, { VideoPeer } from '../components/ParticipantList';
import ChatPanel from '../components/ChatPanel';
import MediaPlayer from '../components/MediaPlayer';
import ScreenShare from '../components/ScreenShare';
import ReactionOverlay from '../components/ReactionOverlay';
import QRCodePanel from '../components/QRCodePanel';
import VotingPanel from '../components/VotingPanel';
import FloatingCallWidget from '../components/FloatingCallWidget';
import { socket } from '../socket';

const RoomPage: React.FC = () => {
  const { roomId } = useParams();
  const { room, userId, reactions, sendReaction, updateSettings, updateParticipant } = useRoom();
  const { peers, startScreenShare, stopScreenShare, streamToPeers, localScreenStream, localStream, initVoiceChat, initVideoChat, endCall, toggleAudio, toggleVideo, isVoiceChatActive, signalReady } = useWebRTC();
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const loadingRef = useRef(true);

  useEffect(() => {
    if (!roomId) return;

    const handleRoomUpdate = (data: any) => {
      console.log("✅ ROOM UPDATE RECEIVED");
      loadingRef.current = false;
      setLoading(false);
      setError(null);
    };

    const handleConnectError = () => {
      console.error("❌ Socket connection error");
      setError("Connection failed. Retrying...");
    };

    socket.on("room-update", handleRoomUpdate);
    socket.on("connect_error", handleConnectError);

    const doJoin = () => {
      const name = localStorage.getItem("username") || `Guest_${Math.random().toString(36).slice(2, 6)}`;
      const avatar = localStorage.getItem("userAvatar") || "";
      console.log("📩 EMITTING join-room for:", roomId, "as:", name);
      socket.emit("join-room", { roomId: roomId.toUpperCase(), userName: name, avatar });
    };

    if (!socket.connected && !socket.active) socket.connect();
    socket.on("connect", doJoin);
    if (socket.connected) doJoin();

    const timeout = setTimeout(() => {
      if (loadingRef.current) {
        console.warn("⚠️ Still loading, retrying join...");
        if (socket.connected) doJoin();
      }
    }, 8000);

    return () => {
      socket.off("room-update", handleRoomUpdate);
      socket.off("connect_error", handleConnectError);
      socket.off("connect", doJoin);
      clearTimeout(timeout);
    };
  }, [roomId]);

  // Handle socket disconnection status
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  useEffect(() => {
    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => {
      setIsSocketConnected(false);
      setLoading(true); // Show loading when disconnected
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    if (localStream?.getVideoTracks().length) {
      setIsVideoOn(true);
    }
  }, [localStream]);

  // 🔥 Prevent device sleep during movies (Screen Wake Lock API)
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (room?.media.isPlaying || room?.media.mediaMode === 'screen')) {
          // @ts-ignore
          wakeLock = await navigator.wakeLock.request('screen');
          console.log("🕯️ Screen Wake Lock Active");
        }
      } catch (err) {
        console.warn("Wake Lock failed:", err);
      }
    };

    if (hasInteracted) {
      requestWakeLock();
    }

    return () => {
      if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
    };
  }, [hasInteracted, room?.media.isPlaying, room?.media.mediaMode]);

  if (loading || !room || !isSocketConnected) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white p-6 text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          {!isSocketConnected && (
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
             </div>
          )}
        </div>
        <div className="mt-8 space-y-2">
          <p className="text-sm font-black uppercase tracking-[0.4em] text-indigo-400 animate-pulse">
            {isSocketConnected ? "Syncing Vibe..." : "Reconnecting to Vibe..."}
          </p>
          <p className="text-[10px] text-slate-500 font-medium max-w-xs uppercase tracking-widest">
            {error || (isSocketConnected ? "Wait a sec, we're fetching the room state" : "Check your internet connection")}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-12 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all active:scale-95"
        >
          Abandon Vibe
        </button>
      </div>
    );
  }

  const isHost = userId && room.participants?.[userId]?.role === 'host';

  const handleToggleMute = () => {
    toggleAudio(isMuted); 
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    if (isVideoOn) {
      toggleVideo(false);
      setIsVideoOn(false);
    } else {
      toggleVideo(true);
      setIsVideoOn(true);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] overflow-hidden text-slate-200 selection:bg-indigo-500/30">
      {/* Sleek Header */}
      <header className="h-14 border-b border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <span className="text-white font-black text-xl">V</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1">
            Vibe<span className="text-indigo-500 underline decoration-indigo-500/30 underline-offset-4">Sync</span>
          </h1>
          <div className="h-4 w-[1px] bg-white/20 mx-2"></div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">ID</span>
            <span className="text-xs font-mono text-indigo-400 font-bold tracking-widest cursor-pointer hover:text-indigo-300" onClick={() => navigator.clipboard.writeText(roomId!)}>{roomId}</span>
          </div>
          {room.media.mediaMode === 'screen' && (
            <div className="ml-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Broadcasting Screen</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {!isVoiceChatActive ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <button
                    onClick={initVoiceChat}
                    className="flex items-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg border border-indigo-500/30 transition-all active:scale-95 animate-pulse"
                    title="Voice Chat"
                  >
                    <Sparkles size={12} />
                    Voice
                  </button>
                  <button
                    onClick={initVideoChat}
                    className="flex items-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg border border-emerald-500/30 transition-all active:scale-95 animate-pulse"
                    title="Video Call"
                  >
                    <Monitor size={12} />
                    Video
                  </button>
                </div>
                {window.self !== window.top && (
                  <span className="text-[8px] font-black uppercase text-amber-500/50 mt-1 mr-1">New Tab recommended</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1.5 rounded-xl backdrop-blur-md shadow-xl">
                <button
                  onClick={handleToggleMute}
                  className={cn(
                    "p-2 rounded-lg transition-all active:scale-95",
                    isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <button
                  onClick={handleToggleVideo}
                  className={cn(
                    "p-2 rounded-lg transition-all active:scale-95",
                    !isVideoOn ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                  title={isVideoOn ? "Turn off camera" : "Turn on camera"}
                >
                  {!isVideoOn ? <VideoOff size={14} /> : <Video size={14} />}
                </button>
                <div className="w-[1px] h-4 bg-white/20 mx-1"></div>
                <button
                  onClick={() => {
                    endCall();
                    setIsVideoOn(false);
                    setIsMuted(false);
                  }}
                  className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 ml-1 active:scale-95"
                  title="Disconnect"
                >
                  <PhoneOff size={14} />
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="group flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all border border-white/5 active:scale-95"
          >
            <Share2 size={12} className="group-hover:rotate-12 transition-transform" />
            Invite
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-lg transition-all active:scale-95 border",
                showSettings ? "bg-indigo-600 text-white border-indigo-500" : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
              )}
            >
              <Settings size={16} className={cn(showSettings && "animate-spin-slow")} />
            </button>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-4 w-72 bg-[#0d0d16] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 backdrop-blur-xl max-h-[80vh] overflow-y-auto"
                >
                  {isHost && (
                    <div className="mb-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 px-1">Room Control</h4>
                      <button
                        onClick={() => updateSettings({ collaborativeControl: !room.settings?.collaborativeControl })}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                      >
                        <div className="text-left">
                          <p className="text-xs font-bold text-white tracking-tight">Collaborative Control</p>
                          <p className="text-[9px] text-slate-500 font-medium">Allow anyone to pause/play</p>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                          room.settings?.collaborativeControl ? "bg-indigo-600 border-indigo-500 text-white" : "border-white/10 text-transparent"
                        )}>
                          <Check size={12} />
                        </div>
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Your Profile</h4>
                    <div className="flex flex-wrap gap-2 p-1">
                      {[
                        'Felix', 'Buddy', 'Willow', 'Leo', 'Milo', 'Luna', 'Oscar'
                      ].map(seed => {
                        const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                        return (
                          <button
                            key={seed}
                            onClick={() => updateParticipant({ avatar: url })}
                            className={cn(
                              "w-10 h-10 rounded-lg border-2 transition-all overflow-hidden",
                              room.participants[userId!]?.avatar === url ? "border-indigo-500 scale-110" : "border-transparent opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
                            )}
                          >
                            <img src={url} alt="avatar" className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                      <label className="w-10 h-10 rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-indigo-500 transition-all opacity-50 hover:opacity-100">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => updateParticipant({ avatar: event.target?.result });
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <span className="text-lg">+</span>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden p-2 lg:p-4 gap-4 relative">
        {/* Left Sidebar: Participants & Controls */}
        <div className="w-full lg:w-64 flex flex-col gap-4 shrink-0 order-2 lg:order-1">
          <ParticipantList peers={peers} localStream={localStream} isMuted={isMuted} onToggleMute={handleToggleMute} />

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-xl">
            <h3 className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] mb-4">Host Shortcuts</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={startScreenShare}
                disabled={!isHost || room.media.mediaMode === 'screen'}
                className={cn(
                  "flex items-center gap-3 w-full p-2.5 rounded-xl transition-all border text-[10px] font-black uppercase tracking-widest group",
                  room.media.mediaMode === 'screen' ? "bg-indigo-500 text-white border-indigo-400" : "bg-white/5 border-white/5 text-slate-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:text-indigo-400"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded bg-slate-800 flex items-center justify-center transition-colors",
                  room.media.mediaMode === 'screen' ? "bg-white/20 text-white" : "group-hover:bg-indigo-500/20 group-hover:text-indigo-400"
                )}>
                  <Monitor size={14} />
                </div>
                Share Screen
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all group text-[10px] font-black uppercase tracking-widest"
              >
                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center group-hover:bg-red-500/20 group-hover:text-red-400 transition-colors">
                  <LogOut size={14} />
                </div>
                <span className="group-hover:text-red-400">Exit Vibe</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center: Media Area */}
        <div className="flex-1 flex flex-col gap-4 min-h-[60vh] lg:min-h-0 order-1 lg:order-2">
          <div className="flex-1 relative bg-black rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
            <ReactionOverlay />

            <div className="w-full h-full relative">
              <div className={cn("absolute inset-0 transition-opacity duration-500", room.media.mediaMode === 'video' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                <MediaPlayer
                  streamToPeers={streamToPeers}
                  remoteStream={(Object.values(peers) as PeerConnection[]).find(p => p.screenStream)?.screenStream || null}
                />
              </div>

              <AnimatePresence>
                {room.media.mediaMode === 'screen' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="absolute inset-0 z-20 bg-black"
                  >
                    {/* 🔴 LIVE Badge for Screen Share */}
                    <div className="absolute top-6 left-6 z-50 flex items-center gap-2">
                      <div className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        LIVE
                      </div>
                    </div>
                    <ScreenShare
                      stream={
                        localScreenStream || 
                        (room.media.hostStreamId ? peers[room.media.hostStreamId]?.screenStream : null) || 
                        (room.media.hostStreamId ? (peers[room.media.hostStreamId]?.stream?.getVideoTracks().length ? peers[room.media.hostStreamId]?.stream : null) : null) ||
                        (Object.values(peers) as PeerConnection[]).find(p => p.screenStream)?.screenStream || 
                        null
                      }
                      userName={room.participants[room.media.hostStreamId || '']?.name || 'Host'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Hidden Audio Renderers for WebRTC Peers (Mic and Screen Audio) */}
            <div id="remote-audio-streams" className="hidden">
              {(Object.entries(peers) as [string, PeerConnection][]).map(([id, peerConn]) => (
                <React.Fragment key={id}>
                  {peerConn.stream && <AudioPeer stream={peerConn.stream} />}
                  {peerConn.screenStream && <AudioPeer stream={peerConn.screenStream} />}
                </React.Fragment>
              ))}
            </div>

            {/* Global Interaction Guard */}
            <AnimatePresence>
              {!hasInteracted && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl z-[150] p-12 text-center rounded-[2.5rem]"
                >
                  <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-600/40 animate-pulse mb-8 cursor-pointer" 
                       onClick={() => { setHasInteracted(true); signalReady(); }}>
                    <Play size={32} fill="white" className="text-white ml-1" />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter">Ready to Vibe?</h3>
                  <p className="text-slate-400 font-medium mb-12 max-w-sm">Tap to sync audio and enter the theater with the squad</p>
                  <button 
                    onClick={() => { setHasInteracted(true); signalReady(); }}
                    className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Enter Theater
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Now Playing Bar */}
          <div className="h-24 bg-indigo-950/20 border border-indigo-500/30 rounded-2xl flex items-center px-6 gap-6 overflow-hidden relative shadow-lg">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-600/5 rounded-full blur-3xl"></div>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-xl shrink-0 flex items-center justify-center border border-white/10 group overflow-hidden">
              <Disc className="text-white animate-spin-slow group-hover:scale-110 transition-transform" size={24} />
            </div>
            <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase font-black text-indigo-400 tracking-[0.2em]">Live Sync Active</span>
                <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate">
                  {room.media.mediaMode === 'screen' ? 'Broadcasting Screen' : 'Streaming Video'}
                </span>
              </div>
              <h4 className="text-base font-bold text-white leading-tight truncate">
                {room.media.mediaMode === 'video' ? (room.media.title || room.media.url?.split('/').pop() || 'Waiting for content') : 'Interactive Screen Stream'}
              </h4>
              <p className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-widest opacity-60">Synced for all {Object.keys(room.participants).length} participants</p>
            </div>

            {/* Quick Reactions Bar */}
            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              {['🔥', '❤️', '👏', '😂', '😮', '⚡'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="w-10 h-10 flex items-center justify-center text-lg hover:bg-white/10 rounded-lg transition-all hover:scale-110 active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Chat & Voting */}
        <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 h-[400px] lg:h-auto order-3 lg:order-3">
          <VotingPanel />
          <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden border border-white/5 bg-[#0d0d1a]">
            <ChatPanel />
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showInvite && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full relative"
            >
              <button
                onClick={() => setShowInvite(false)}
                className="absolute -top-12 right-0 text-white/50 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all"
              >
                Close ✕
              </button>
              <QRCodePanel roomCode={roomId!} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Call Widget */}
      {isVoiceChatActive && (
        <FloatingCallWidget
          peers={peers}
          localStream={localStream}
          userId={userId!}
          room={room}
          isMuted={isMuted}
          isVideoOn={isVideoOn}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onEndCall={() => {
            endCall();
            setIsVideoOn(false);
            setIsMuted(false);
          }}
        />
      )}
    </div>
  );
};

const AudioPeer: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const audioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

export default RoomPage;
