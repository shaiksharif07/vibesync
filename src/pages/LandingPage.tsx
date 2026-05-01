import React, { useState, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import { Sparkles, Users, Tv, Zap, Shield, ArrowRight, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

const LandingPage: React.FC = () => {
    const { joinRoom, createRoom, checkRoom, roomStatus, username: savedName } = useRoom();
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [name, setName] = useState(localStorage.getItem('username') || '');
    const [roomCode, setRoomCode] = useState('');
    const [password, setPassword] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [error, setError] = useState('');
    const [avatar, setAvatar] = useState(localStorage.getItem('userAvatar') || '');
    const [avatarPreview, setAvatarPreview] = useState(() => {
        const saved = localStorage.getItem('userAvatar') || '';
        if (saved.length > 100000) {
            console.warn("🧹 Wiping oversized avatar from storage");
            localStorage.removeItem('userAvatar');
            return '';
        }
        return saved;
    });

    const AVATAR_PRESETS = [
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Buddy',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Willow',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo'
    ];

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const queryRoom = params.get('room');
        const queryName = params.get('name');
        
        const effectiveCode = (roomId || queryRoom || '').toUpperCase();
        if (effectiveCode) {
            setRoomCode(effectiveCode);
            checkRoom(effectiveCode);
        }

        if (queryName) {
            setName(queryName);
        }
    }, [roomId, location.search]);

    // Auto redirect if roomId and name are present
    useEffect(() => {
        if (roomId && name && roomStatus === 'ready') {
            console.log('⚡ Auto-redirecting to room:', roomId);
            localStorage.setItem("username", name.trim());
            navigate(`/room/${roomId}`);
        }
    }, [roomId, name, roomStatus, navigate]);



    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Please enter your alias first!');
            return;
        }
        
        // Generate a random 6-character room code
        const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log("🚀 CREATING ROOM:", generatedCode);
        
        localStorage.setItem('username', name);
        localStorage.setItem('userAvatar', avatarPreview);
        navigate(`/room/${generatedCode}`);
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 128; // Small but sharp
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, size, size);
            const optimized = canvas.toDataURL('image/jpeg', 0.7);
            setAvatarPreview(optimized);
          };
        };
        reader.readAsDataURL(file);
      }
    };

    const handleJoin = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (!roomCode) {
            setError('Please enter a room code!');
            return;
        }

        const username = name.trim() || `Guest_${Math.random().toString(36).slice(2, 6)}`;
        localStorage.setItem('username', username);
        localStorage.setItem('userAvatar', avatarPreview);
        
        console.log("📍 Navigating to room:", roomCode);
        navigate(`/room/${roomCode.trim().toUpperCase()}`);
    };

    const handleRoomCodeChange = (val: string) => {
        const code = val.toUpperCase();
        setRoomCode(code);
        if (code.length === 6) {
            checkRoom(code);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-slate-200 overflow-hidden relative selection:bg-indigo-500/30">
            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-2xl backdrop-blur-xl flex items-center gap-3 shadow-2xl"
                    >
                        <Shield size={16} className="text-red-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-red-400">{error}</span>
                        <button onClick={() => setError('')} className="ml-4 text-red-400/50 hover:text-red-400">×</button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-purple-600/10 rounded-full blur-[100px]" />
                <div className="absolute -bottom-[10%] left-[20%] w-[35%] h-[35%] bg-indigo-600/10 rounded-full blur-[120px]" />
            </div>

            <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24">
                <div className="grid lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-8">
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-full"
                        >
                            <Sparkles size={14} className="text-indigo-400" />
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Next-Gen Virtual Socializing</span>
                        </motion.div>

                        {window.self !== window.top && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3"
                            >
                                <Shield size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Preview Mode Detected</p>
                                    <p className="text-xs text-amber-500/70 font-medium leading-relaxed">
                                        For best results with Screen Sync and Voice, please click the <span className="font-bold underline">"Open in new tab"</span> button in the top-right. Browser security often blocks media inside previews.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                        
                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-6xl md:text-8xl font-black tracking-tight text-white leading-[0.9]"
                        >
                            SYNC. CHAT. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">VIBE TOGETHER.</span>
                        </motion.h1>
                        
                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-slate-400 max-w-lg leading-relaxed font-medium"
                        >
                            The ultimate virtual hangout for friends. Watch synced movies, broadcast your screen, and stay connected with crystal clear voice and chat.
                        </motion.p>

                        <div className="flex flex-wrap gap-12 pt-4">
                            {[
                                { label: 'Real-time Sync', icon: Zap },
                                { label: 'P2P Privacy', icon: Shield },
                                { label: '4K Display', icon: Tv }
                            ].map((item, i) => (
                                <motion.div 
                                    key={i} 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 + i * 0.1 }}
                                    className="flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400">
                                        <item.icon size={16} />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">{item.label}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-100 transition duration-1000"></div>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                            className="relative bg-[#0d0d16] border border-white/10 p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black text-white tracking-tight">
                                    {showCreate ? 'Start a New Vibe' : 'Enter the Vibe'}
                                </h2>
                                <button 
                                    onClick={() => { setShowCreate(!showCreate); setError(''); }}
                                    className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    {showCreate ? 'Already have a code?' : 'Create a room'}
                                </button>
                            </div>
                            
                            <form className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Your Alias</label>
                                    <input 
                                        type="text" 
                                        placeholder="Type your username..."
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-600 font-bold"
                                    />
                                </div>

                                <div className="space-y-4">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Choose Avatar</label>
                                  <div className="flex flex-wrap gap-3">
                                    {AVATAR_PRESETS.map(preset => (
                                      <button 
                                        key={preset}
                                        type="button"
                                        onClick={() => setAvatarPreview(preset)}
                                        className={cn(
                                          "w-12 h-12 rounded-xl bg-white/5 border-2 transition-all overflow-hidden",
                                          avatarPreview === preset ? "border-indigo-500 scale-110" : "border-transparent opacity-50 grayscale"
                                        )}
                                      >
                                        <img src={preset} alt="avatar" className="w-full h-full object-cover" />
                                      </button>
                                    ))}
                                    <label className={cn(
                                      "w-12 h-12 rounded-xl bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-indigo-500 transition-all",
                                      avatarPreview && !AVATAR_PRESETS.includes(avatarPreview) && "border-indigo-500 border-solid opacity-100 grayscale-0 scale-110"
                                    )}>
                                      <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                      {avatarPreview && !AVATAR_PRESETS.includes(avatarPreview) ? (
                                        <img src={avatarPreview} alt="custom" className="w-full h-full object-cover rounded-lg" />
                                      ) : (
                                        <span className="text-xl">+</span>
                                      )}
                                    </label>
                                  </div>
                                </div>

                                <AnimatePresence mode="wait">
                                    {showCreate ? (
                                        <motion.div 
                                            key="create"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between ml-1">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Security Password</label>
                                                    <span className="text-[9px] font-black uppercase text-slate-600 italic">Optional</span>
                                                </div>
                                                <div className="relative">
                                                    <input 
                                                        type="password" 
                                                        placeholder="Create a password..."
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-600 font-bold"
                                                    />
                                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600">
                                                        <Lock size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleCreate}
                                                className="w-full h-16 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all active:scale-95 shadow-xl shadow-white/5 flex items-center justify-center gap-2"
                                            >
                                                Launch Room
                                                <Sparkles size={16} />
                                            </button>
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key="join"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Room Code</label>
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        placeholder="6-DIGIT CODE"
                                                        value={roomCode}
                                                        maxLength={6}
                                                        onChange={(e) => handleRoomCodeChange(e.target.value)}
                                                        className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-600 font-bold text-center uppercase tracking-widest"
                                                    />
                                                    {roomStatus === 'checking' && (
                                                        <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                                            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    )}
                                                    {roomStatus === 'ready' && roomCode.length === 6 && (
                                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-500">
                                                            <Unlock size={16} />
                                                        </div>
                                                    )}
                                                    {roomStatus === 'password-required' && (
                                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-amber-500">
                                                            <Lock size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {roomStatus === 'password-required' && (
                                                <motion.div 
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="space-y-2"
                                                >
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Verification Required</label>
                                                    <input 
                                                        type="password" 
                                                        placeholder="Enter room password..."
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="w-full bg-white/5 border border-amber-500/20 rounded-2xl px-6 py-4 focus:outline-none focus:border-amber-500/50 transition-all text-white placeholder:text-slate-600 font-bold"
                                                    />
                                                </motion.div>
                                            )}

                                            <button 
                                                onClick={() => handleJoin()}
                                                disabled={!roomCode || roomStatus === 'checking'}
                                                className="w-full h-16 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-500 transition-all active:scale-95 shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-30 disabled:grayscale transition-all"
                                            >
                                                {roomStatus === 'checking' ? 'Establishing Vibe Link...' : (roomStatus === 'not-found' ? 'Room Not Found' : 'Join Room')}
                                                <ArrowRight size={16} />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </form>

                            <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0d0d16] bg-slate-800 flex items-center justify-center overflow-hidden">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 123}`} alt="user" />
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">12k+ Vibes synced daily</span>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </main>

            <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 space-y-12">
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-black">1</div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">Pick an Alias</h3>
                        <p className="text-sm text-slate-500 font-medium">Enter your display name. This is how your squad will see you in the chat and on voice.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 font-black">2</div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">Allow Permissions</h3>
                        <p className="text-sm text-slate-500 font-medium">Inside the room, click "Connect Voice" and allow microphone access. We use manual activation to ensure your browser grants high-fidelity sync.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-pink-600/20 flex items-center justify-center text-pink-400 font-black">3</div>
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">Share the Vibe</h3>
                        <p className="text-sm text-slate-500 font-medium">Copy your unique room link or show the QR code to your friends. They join instantly—no accounts needed.</p>
                    </div>
                </div>

                <div className="pt-12 border-t border-white/5 flex flex-col md:row items-center justify-between gap-6 opacity-40">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center">
                            <span className="text-white font-black text-xs">V</span>
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">VibeSync v2.0</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest">Built for connection • Low Latency WebRTC</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
