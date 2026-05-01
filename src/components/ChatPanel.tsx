import React, { useState, useRef, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import { Send, Hash, MessageSquare, Paperclip, File as FileIcon, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const ChatPanel: React.FC = () => {
  const { room, userId, sendMessage, sendTyping, typingUsers } = useRoom();
  const [msg, setMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STICKERS = ['🔥', '😂', '💯', '🚀', '💀', '🤡', '🎉', '💜', '👑', '✨'];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [room?.messages]);

  useEffect(() => {
    if (msg.length > 0) {
      sendTyping(true);
      const timeout = setTimeout(() => sendTyping(false), 2000);
      return () => clearTimeout(timeout);
    } else {
      sendTyping(false);
    }
  }, [msg, sendTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (msg.trim()) {
      sendMessage(msg.trim());
      setMsg('');
      sendTyping(false);
      setShowStickers(false);
    }
  };

  const sendSticker = (sticker: string) => {
    sendMessage(`[STICKER:${sticker}]`);
    setShowStickers(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Maximum size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      // Send the file as a special formatted string or just directly
      sendMessage(`[FILE:${file.name}]${base64}`);
    };
    reader.readAsDataURL(file);
  };

  if (!room) return null;

  return (
    <div className="flex flex-col h-full bg-black/20 rounded-3xl border border-white/5 overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400">
                <MessageSquare size={14} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Live Feed</h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            Live
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        <AnimatePresence initial={false}>
          {room.messages.map((m, i) => {
            const isMe = m.senderId === userId;
            const sender = room.participants[m.senderId];
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={m.id || i}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && sender && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                    {sender.name}
                  </span>
                )}
                <div className={cn(
                  "max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed",
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10' 
                    : 'bg-white/5 text-slate-300 border border-white/5 rounded-tl-none hover:border-white/10 transition-colors',
                  m.content.startsWith('[STICKER:') && 'bg-transparent border-none p-0 shadow-none'
                )}>
                  {m.content.startsWith('[FILE:') ? (
                    (() => {
                      const nameEnd = m.content.indexOf(']');
                      const fileName = m.content.substring(6, nameEnd);
                      const dataUrl = m.content.substring(nameEnd + 1);
                      if (dataUrl.startsWith('data:image/')) {
                        return <img src={dataUrl} alt={fileName} className="max-w-full rounded-lg" />;
                      }
                      return (
                        <a href={dataUrl} download={fileName} className="flex items-center gap-2 hover:underline">
                          <FileIcon size={16} />
                          <span className="truncate">{fileName}</span>
                        </a>
                      );
                    })()
                  ) : m.content.startsWith('[STICKER:') ? (
                    <span className="text-6xl animate-bounce-slow inline-block">
                      {m.content.substring(9, m.content.length - 1)}
                    </span>
                  ) : (
                    <span className="break-words">{m.content}</span>
                  )}
                </div>
                <span className="text-[9px] font-black text-slate-700 mt-2 uppercase tracking-widest">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-white/5 border-t border-white/5 relative">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute left-2 p-2.5 text-slate-400 hover:text-white transition-colors"
          >
            <Paperclip size={18} />
          </button>
          
          <button 
            type="button"
            onClick={() => setShowStickers(!showStickers)}
            className={cn(
              "absolute left-10 p-2.5 transition-colors",
              showStickers ? "text-indigo-400" : "text-slate-400 hover:text-white"
            )}
          >
            <Smile size={18} />
          </button>
          
          <input 
            type="text"
            value={msg}
            onChange={(e) => {
              setMsg(e.target.value);
            }}
            placeholder="Drop a vibe..."
            className="w-full bg-[#0d0d16] border border-white/10 rounded-2xl pl-20 pr-14 py-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-600 font-medium"
          />

          <AnimatePresence>
            {showStickers && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="absolute bottom-full mb-4 left-0 right-0 p-4 bg-[#0d0d16]/95 backdrop-blur-xl border border-white/10 rounded-3xl grid grid-cols-5 gap-2 shadow-2xl z-50"
              >
                {STICKERS.map(s => (
                  <button 
                    key={s}
                    onClick={() => sendSticker(s)}
                    className="text-2xl hover:scale-125 transition-transform p-2 grayscale hover:grayscale-0"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            type="submit"
            disabled={!msg.trim()}
            className="absolute right-2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-30 disabled:grayscale active:scale-95"
          >
            <Send size={16} />
          </button>
        </form>
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full mb-2 left-6 flex items-center gap-2 bg-[#0d0d16]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg z-10"
            >
              <div className="flex -space-x-1.5">
                {typingUsers.slice(0, 3).map(id => {
                  const p = room.participants[id];
                  return p?.avatar ? (
                    <img key={id} src={p.avatar} alt="avatar" className="w-5 h-5 rounded-full border border-[#0d0d16] object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p?.name || id}`; }} />
                  ) : (
                    <div key={id} className="w-5 h-5 rounded-full bg-indigo-500 border border-[#0d0d16]" />
                  );
                })}
              </div>
              <div className="flex gap-0.5 items-center bg-white/10 px-2 py-1.5 rounded-full">
                <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                {typingUsers.length === 1 ? `${room.participants[typingUsers[0]]?.name?.split(' ')[0] || 'Someone'} is typing` : 'Several are typing'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ChatPanel;
