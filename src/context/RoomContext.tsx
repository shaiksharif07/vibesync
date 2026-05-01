import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import { Room, MediaState, Vote } from '../lib/types';
import { useNavigate } from 'react-router-dom';

interface RoomContextType {
  socket: any;
  room: Room | null;
  setRoom: React.Dispatch<React.SetStateAction<Room | null>>;
  userId: string | null;
  username: string | null;
  joinRoom: (code: string, name: string, password?: string) => void;
  createRoom: (name: string, password?: string) => void;
  checkRoom: (code: string) => void;
  sendReaction: (emoji: string) => void;
  roomStatus: 'idle' | 'checking' | 'not-found' | 'password-required' | 'ready';
  sendTyping: (isTyping: boolean) => void;
  sendMessage: (content: string) => void;
  updateMedia: (update: Partial<MediaState>) => void;
  setMediaMode: (mode: 'video' | 'screen', hostStreamId?: string) => void;
  shareFile: (fileName: string, size: number) => void;
  reactions: Array<{ id: string; emoji: string; senderId: string }>;
  typingUsers: string[];
  addToQueue: (url: string) => void;
  skipVideo: () => void;
  updateSettings: (settings: any) => void;
  updateParticipant: (updates: any) => void;
  clearMedia: () => void;
  castVote: (url: string, title?: string) => void;
  removeVote: (url: string) => void;
  playVoted: (url: string) => void;
  votes: Record<string, Vote>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used within a RoomProvider');
  return context;
};

export const RoomProvider = ({ children }: any) => {
  const [room, setRoom] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
  const [roomStatus, setRoomStatus] = useState<'idle' | 'checking' | 'not-found' | 'password-required' | 'ready'>('idle');
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; senderId: string }>>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  
  useEffect(() => {
    console.log("🧠 Context mounted");

    // ✅ ALWAYS listen BEFORE anything
    const handleRoomUpdate = (data: any) => {
      console.log("🔥 ROOM UPDATE RECEIVED:", data);
      setRoom({ ...data });
    };

    socket.on("room-update", handleRoomUpdate);

    socket.on("connect", () => {
      console.log("✅ CONNECTED:", socket.id);
      setUserId(socket.id);
    });

    // 🔥 CRITICAL: If already connected, set ID immediately
    if (socket.connected) {
      setUserId(socket.id);
    }

    socket.on('room-status', ({ status }) => setRoomStatus(status));
    socket.on('room-error', (err) => alert(err));

    const handleReaction = (reaction: any) => {
      setReactions(prev => [...prev, reaction]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 3000);
    };
    socket.on('receive-reaction', handleReaction);

    const handleTyping = ({ userId, isTyping }: { userId: string, isTyping: boolean }) => {
      setTypingUsers(prev => 
        isTyping && !prev.includes(userId) ? [...prev, userId] 
        : !isTyping ? prev.filter(id => id !== userId) : prev
      );
    };
    socket.on('user-typing', handleTyping);

    const handleVotes = (data: any) => setVotes({ ...data });
    socket.on('votes-update', handleVotes);

    const handleNewMessage = (message: any) => {
      setRoom(prev => {
        if (!prev) return prev;
        return { ...prev, messages: [...prev.messages, message] };
      });
    };
    socket.on('new-message', handleNewMessage);

    return () => {
      socket.off("room-update", handleRoomUpdate);
      socket.off("connect");
      socket.off('room-status');
      socket.off('room-error');
      socket.off('receive-reaction', handleReaction);
      socket.off('user-typing', handleTyping);
      socket.off('votes-update', handleVotes);
      socket.off('new-message', handleNewMessage);
    };
  }, []);

  // ✅ FIXED JOIN (WAIT FOR CONNECT)
  const joinRoom = useCallback((code: string, name: string) => {
    localStorage.setItem('username', name);

    const join = () => {
      console.log("📩 JOINING ROOM:", code);

      socket.emit('join-room', {
        roomId: code,
        userName: name,
        avatar: localStorage.getItem('userAvatar'),
      });
    };

    if (socket.connected) {
      join();
    } else {
      socket.connect();
      socket.once("connect", join);
    }
  }, []);

  // ✅ FIXED CREATE
  const createRoom = useCallback((name: string) => {
    localStorage.setItem('username', name);

    const create = () => {
      console.log("📩 CREATING ROOM for:", name);
      socket.emit('create-room', { 
        userName: name,
        avatar: localStorage.getItem('userAvatar')
      });
    };

    if (socket.connected) {
      create();
    } else {
      socket.connect();
      socket.once("connect", create);
    }
  }, []);

  const checkRoom = useCallback((code: string) => {
    setRoomStatus('checking');
    
    // Safety timeout for ngrok latency
    const checkTimeout = setTimeout(() => {
      setRoomStatus('not-found');
    }, 8000);

    const check = () => {
      socket.emit('check-room', { code });
      socket.once('room-status', () => clearTimeout(checkTimeout));
    };

    if (socket.connected) {
      check();
    } else {
      socket.connect();
      socket.once("connect", check);
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (room) socket.emit('send-message', { code: room.code, content });
  }, [room]);

  const updateMedia = useCallback((update: Partial<MediaState>) => {
    socket.emit('update-media', { code: room?.code, state: update });
  }, [room?.code]);

  const setMediaMode = useCallback((mode: 'video' | 'screen', hostStreamId?: string) => {
    if (room) socket.emit('update-media', { code: room.code, state: { mediaMode: mode, hostStreamId } });
  }, [room]);

  const shareFile = useCallback((fileName: string, size: number) => {
    if (room) socket.emit('share-file', { code: room.code, file: { name: fileName, size } });
  }, [room]);

  const addToQueue = useCallback((url: string) => {
    if (room) socket.emit('add-to-queue', { code: room.code, url });
  }, [room]);

  const skipVideo = useCallback(() => {
    if (room) socket.emit('skip-video', { code: room.code });
  }, [room]);

  const updateSettings = useCallback((settings: any) => {
    if (room) socket.emit('update-settings', { code: room.code, settings });
  }, [room]);

  const updateParticipant = useCallback((updates: any) => {
    if (room) socket.emit('update-participant', { code: room.code, updates });
    if (updates.name) {
      localStorage.setItem('username', updates.name);
      setUsername(updates.name);
    }
    if (updates.avatar) {
      localStorage.setItem('userAvatar', updates.avatar);
    }
  }, [room]);

  const clearMedia = useCallback(() => {
    if (room) socket.emit('clear-media', { code: room.code });
  }, [room]);

  const castVote = useCallback((url: string, title?: string) => {
    if (room) socket.emit('cast-vote', { code: room.code, url, title });
  }, [room]);

  const removeVote = useCallback((url: string) => {
    if (room) socket.emit('remove-vote', { code: room.code, url });
  }, [room]);

  const playVoted = useCallback((url: string) => {
    if (room) socket.emit('play-voted', { code: room.code, url });
  }, [room]);

  return (
    <RoomContext.Provider value={{
      socket, room, setRoom, userId, username, joinRoom, createRoom, checkRoom,
      sendReaction: (emoji) => room && socket.emit('send-reaction', { code: room.code, emoji }),
      sendTyping: (isTyping) => room && socket.emit('typing', { code: room.code, isTyping }),
      roomStatus, sendMessage, updateMedia, setMediaMode, shareFile, reactions, typingUsers,
      addToQueue, skipVideo, updateSettings, updateParticipant,
      clearMedia, castVote, removeVote, playVoted, votes,
    }}>
      {children}
    </RoomContext.Provider>
  );
};
