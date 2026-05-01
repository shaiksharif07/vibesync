import React, { useRef, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import { Monitor, User, Maximize } from 'lucide-react';
import { motion } from 'motion/react';

interface ScreenShareProps {
  stream: MediaStream | null;
  userName: string;
}

const ScreenShare: React.FC<ScreenShareProps> = ({ stream, userName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.log("Screen share play error:", err));
    }
  }, [stream]);

  return (
    <div className="relative aspect-video bg-[#0d0d16] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl group">
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      
      <div className="absolute top-6 left-6 flex items-center gap-2 bg-indigo-600 px-3 py-1.5 rounded-xl shadow-lg">
        <Monitor size={12} className="text-white" />
        <span className="text-[10px] font-black text-white uppercase tracking-widest">Screen Broadcast</span>
      </div>

      <div className="absolute bottom-6 left-6 flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl">
         <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <User size={12} />
         </div>
         <span className="text-xs font-bold text-white tracking-tight">{userName}'s Screen</span>
      </div>

      <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};

export default ScreenShare;
