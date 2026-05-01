import React from 'react';
import { useRoom } from '../context/RoomContext';
import { Crown, Mic, MicOff, User } from 'lucide-react';
import { motion } from 'motion/react';
import { Participant } from '../lib/types';
import { cn } from '../lib/utils';

interface ParticipantListProps {
  peers: any;
  localStream: MediaStream | null;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const VideoPeer: React.FC<{ stream: MediaStream; muted?: boolean }> = ({ stream, muted = false }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />;
};

export const AudioPlayer: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const audioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    if (audioRef.current && stream && stream.getAudioTracks().length > 0) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay />;
};

const ParticipantList: React.FC<ParticipantListProps> = ({ peers, localStream, isMuted, onToggleMute }) => {
  const { room, userId } = useRoom();

  if (!room) return null;

  return (
    <div className="flex flex-col h-full bg-black/20 rounded-[2rem] lg:rounded-3xl border border-white/5 overflow-hidden backdrop-blur-md">
      <div className="p-4 lg:p-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <h3 className="text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] text-slate-500">Squad</h3>
        <span className="bg-indigo-600/20 text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-500/20">
          {Object.keys(room.participants).length}
        </span>
      </div>
      
      <div className="flex-1 overflow-x-auto lg:overflow-y-auto p-3 lg:p-4 flex flex-row lg:flex-col gap-2 no-scrollbar">
        {Object.values(room.participants).map((p: Participant) => (
          <motion.div 
            layout
            key={p.id}
            className="flex items-center gap-3 p-2.5 lg:p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group shrink-0 min-w-[160px] lg:min-w-0"
          >
            <div className="relative">
              <div className={cn(
                "w-12 h-12 rounded-full overflow-hidden border-2",
                (p.id === userId ? !isMuted : (peers[p.id]?.audioTrack?.enabled)) 
                  ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" 
                  : "border-transparent"
              )}>
                {/* Show local or remote video if available */}
                {(p.id === userId && localStream?.getVideoTracks().length) ? (
                   <VideoPeer stream={localStream} muted />
                ) : (p.id !== userId && peers[p.id]?.stream?.getVideoTracks().length) ? (
                   <VideoPeer stream={peers[p.id].stream} />
                ) : (
                  <>
                    <img src={p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} alt={p.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`; }} />
                    {p.id !== userId && peers[p.id]?.stream && <AudioPlayer stream={peers[p.id].stream} />}
                  </>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-lg bg-[#0d0d16] border border-white/10 flex items-center justify-center">
                <div className={`w-1.5 h-1.5 rounded-full ${p.role === 'host' ? 'bg-indigo-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-white truncate tracking-tight">{p.name}</p>
                {p.role === 'host' && <Crown size={12} className="text-amber-400" />}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-400/70 transition-colors">
                {p.role === 'host' ? 'Host' : 'Chilling'}
              </p>
            </div>

             <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
               <button 
                  onClick={p.id === userId ? onToggleMute : undefined}
                  className={cn(
                    "p-1.5 rounded-lg border transition-colors",
                    isMuted && p.id === userId
                      ? "bg-red-500/20 text-red-500 border-red-500/30" 
                      : "bg-white/5 border-white/5 text-slate-500"
                  )}
               >
                  {isMuted && p.id === userId ? <MicOff size={12} /> : <Mic size={12} />}
               </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ParticipantList;
