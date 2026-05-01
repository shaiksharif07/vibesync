import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRCodePanelProps {
  roomCode: string;
}

const QRCodePanel: React.FC<QRCodePanelProps> = ({ roomCode }) => {
  const [copied, setCopied] = React.useState(false);
  const inviteLink = `${window.location.origin}/join/${roomCode}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my VibeSync Room',
          text: `Join my virtual hangout! Room Code: ${roomCode}`,
          url: inviteLink,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-white/5 rounded-3xl border border-white/10">
      <div className="p-4 bg-white rounded-2xl">
        <QRCodeSVG 
          value={inviteLink} 
          size={160}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: "/vite.svg", // Or a custom logo if available
            x: undefined,
            y: undefined,
            height: 24,
            width: 24,
            excavate: true,
          }}
        />
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-white font-bold tracking-tight">Invite the Squad</h3>
        <p className="text-slate-400 text-xs font-medium">Scan QR or share the link to join instantly</p>
      </div>

      <div className="w-full space-y-3">
        <button 
          onClick={copyToClipboard}
          className="w-full flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 rounded-xl transition-all group"
        >
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Invite Link</span>
            <span className="text-xs text-white truncate max-w-full font-mono">{inviteLink}</span>
          </div>
          <div className="shrink-0 p-2 bg-indigo-500/20 text-indigo-400 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-all">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </div>
        </button>

        <button 
          onClick={shareInvite}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
        >
          <Share2 size={14} />
          Share Invite
        </button>
      </div>
    </div>
  );
};

export default QRCodePanel;
