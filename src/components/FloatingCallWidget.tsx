import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize2, Minimize2, MicOff, VideoOff, PhoneOff, Mic, Video, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { VideoPeer } from './ParticipantList';
import { PeerConnection } from '../hooks/useWebRTC';

interface FloatingCallWidgetProps {
  peers: Record<string, PeerConnection>;
  localStream: MediaStream | null;
  userId: string;
  room: any;
  isMuted: boolean;
  isVideoOn: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

const FloatingCallWidget: React.FC<FloatingCallWidgetProps> = ({
  peers, localStream, userId, room, isMuted, isVideoOn, onToggleMute, onToggleVideo, onEndCall
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activePeersCount = Object.keys(peers).length + (localStream ? 1 : 0);
  if (activePeersCount === 0 && !localStream) return null;

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: 0,
          ...(isFullscreen ? { top: 12, left: 12, right: 12, bottom: 12, width: 'auto', maxWidth: 'none', height: 'auto', zIndex: 100 } : 
              isMinimized ? { bottom: 20, right: 20, width: 280, height: 64, zIndex: 50 } : 
              { bottom: 20, right: 20, width: 440, height: 320, zIndex: 50 })
        }}
        className={cn(
          "fixed flex flex-col bg-[#0d0d16]/90 backdrop-blur-2xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-500",
          isFullscreen ? "rounded-3xl" : "rounded-[2rem]"
        )}
      >
        {/* Header - Discord Style */}
        <div className="h-10 px-4 flex items-center justify-between shrink-0 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/80">Voice Connected</span>
          </div>
          <div className="flex items-center gap-1">
             <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 text-slate-500 hover:text-white transition-colors">
                {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
             </button>
             <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1 text-slate-500 hover:text-white transition-colors">
                <Maximize2 size={12} />
             </button>
          </div>
        </div>

        {/* Content Grid */}
        {!isMinimized && (
          <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 gap-3 content-center">
            {/* Local Stream */}
            <div className="relative aspect-video bg-black/40 rounded-2xl overflow-hidden border border-white/10 group">
              {localStream && localStream.getVideoTracks().length > 0 ? (
                <VideoPeer stream={localStream} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-black">
                  <div className="relative">
                     <img 
                       src={room.participants[userId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} 
                       className="w-14 h-14 rounded-full border-2 border-indigo-500/30 shadow-2xl" 
                       alt="You" 
                       onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`; }}
                     />
                     {isMuted && (
                       <div className="absolute -bottom-1 -right-1 bg-red-500 p-1 rounded-full border-2 border-[#0d0d16]">
                         <MicOff size={10} className="text-white" />
                       </div>
                     )}
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg text-[8px] font-black text-white uppercase tracking-widest border border-white/5">
                You (Host)
              </div>
            </div>

            {/* Remote Peers */}
            {(Object.entries(peers) as [string, PeerConnection][]).map(([id, peerConn]) => (
              <div key={id} className="relative aspect-video bg-black/40 rounded-2xl overflow-hidden border border-white/10 group">
                {peerConn.stream && peerConn.stream.getVideoTracks().length > 0 ? (
                  <VideoPeer stream={peerConn.stream} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-black">
                     <img 
                       src={room.participants[id]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} 
                       className="w-14 h-14 rounded-full border-2 border-white/5 shadow-2xl" 
                       alt={id} 
                       onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`; }}
                     />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg text-[8px] font-black text-white uppercase tracking-widest border border-white/5">
                  {room.participants[id]?.name || 'Guest'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Minimal View */}
        {isMinimized && (
           <div className="flex-1 flex items-center px-4 gap-4">
              <div className="flex -space-x-2">
                 <img src={room.participants[userId]?.avatar || ''} className="w-8 h-8 rounded-full border-2 border-[#0d0d16]" alt="" />
                 {Object.keys(peers).slice(0, 2).map(id => (
                    <img key={id} src={room.participants[id]?.avatar || ''} className="w-8 h-8 rounded-full border-2 border-[#0d0d16]" alt="" />
                 ))}
              </div>
              <div className="flex-1 min-w-0">
                 <p className="text-[10px] font-black text-white uppercase tracking-widest truncate">Call Active</p>
                 <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{Object.keys(peers).length + 1} users connected</p>
              </div>
           </div>
        )}

        {/* Controls Bar - Floating Style */}
        <div className={cn(
          "shrink-0 flex items-center justify-center gap-3 bg-white/5",
          isMinimized ? "px-2" : "h-16 border-t border-white/5"
        )}>
          <button 
            onClick={onToggleMute} 
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-2xl transition-all",
              isMuted ? "bg-red-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
            )}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          
          <button 
            onClick={onToggleVideo} 
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-2xl transition-all",
              !isVideoOn ? "bg-white/5 text-slate-500" : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
            )}
          >
            {isVideoOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>

          <button 
            onClick={onEndCall} 
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-red-600 text-white hover:bg-red-500 transition-all shadow-xl shadow-red-600/20"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingCallWidget;
