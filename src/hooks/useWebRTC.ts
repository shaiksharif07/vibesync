import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import { useRoom } from '../context/RoomContext';
import { socket } from '../socket';

export interface PeerConnection {
  peer: Peer.Instance;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  dataChannel: boolean;
}

// TURN servers are required for cross-network (ngrok ↔ mobile) connections
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
};

// ─── SDP Optimization Helper ───────────────────────────────────────────────
const optimizeSDP = (sdp: string) => {
  let modifiedSdp = sdp;

  // 1. Audio Quality (Opus)
  if (modifiedSdp.includes('opus/48000')) {
    modifiedSdp = modifiedSdp.replace(
      /a=fmtp:(\d+) (.*)useinbandfec=1/g,
      'a=fmtp:$1 $2useinbandfec=1;maxaveragebitrate=128000;sprop-maxcapturerate=48000;stereo=1;cbr=0'
    );
  }

  // 2. Video Quality & Bitrate
  // Prioritize H264 if available (better for mobile hardware acceleration)
  if (modifiedSdp.includes('m=video')) {
    // Increase bitrate to 3.5Mbps for HD screen sharing
    modifiedSdp = modifiedSdp.replace('a=mid:video\r\n', 'a=mid:video\r\nb=AS:3500\r\n');
    
    // Force higher framerate and quality settings in SDP (mostly for Chrome)
    modifiedSdp = modifiedSdp.replace(
      'a=mid:video',
      'a=mid:video\r\na=x-google-min-bitrate=1000\r\na=x-google-max-bitrate=5000'
    );
  }
  
  return modifiedSdp;
};

export const useWebRTC = () => {
  const { room, setMediaMode } = useRoom();
  const [peers, setPeers] = useState<Record<string, PeerConnection>>({});
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);

  // ─── Signaling listeners at mount (NOT inside initVoiceChat) ─────────────
  useEffect(() => {
    const handleInitiateWebRTC = ({ peerId }: { peerId: string }) => {
      const streams = [localStreamRef.current, localScreenStreamRef.current].filter(Boolean) as MediaStream[];
      if (peersRef.current[peerId]) return; // already connected
      console.log('🔗 Creating peer to:', peerId);
      const peer = makePeer(peerId, true, undefined, streams);
      peersRef.current[peerId] = peer;
    };

    const handleSignal = ({ from, signal }: { from: string; signal: any }) => {
      const streams = [localStreamRef.current, localScreenStreamRef.current].filter(Boolean) as MediaStream[];
      if (peersRef.current[from]) {
        // Existing peer — feed signal
        peersRef.current[from].signal(signal);
      } else {
        // Incoming call from someone new — answer
        console.log('📞 Answering peer from:', from);
        const peer = makePeer(from, false, signal, streams);
        peersRef.current[from] = peer;
      }
    };

    socket.on('initiate-webrtc', handleInitiateWebRTC);
    socket.on('signal', handleSignal);

    return () => {
      socket.off('initiate-webrtc', handleInitiateWebRTC);
      socket.off('signal', handleSignal);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ─── Core peer factory ───────────────────────────────────────────────────
  const makePeer = (
    targetId: string,
    initiator: boolean,
    incomingSignal: any,
    streams: MediaStream[],
  ): Peer.Instance => {
    const peer = new Peer({
      initiator,
      trickle: true,
      streams,
      config: ICE_CONFIG,
      sdpTransform: optimizeSDP,
    });

    peer.on('signal', (sig) => {
      socket.emit('signal', { to: targetId, from: socket.id, signal: sig });
    });

    if (!initiator && incomingSignal) {
      peer.signal(incomingSignal);
    }

    peer.on('stream', (remoteStream) => {
      const videoTracks = remoteStream.getVideoTracks();
      const hasVideo = videoTracks.length > 0;
      const label = videoTracks[0]?.label.toLowerCase() || '';
      
      // Improved screen detection: labels are not always reliable on mobile/forwarded streams
      const isScreenLabel = label.includes('screen') || label.includes('window') || label.includes('display') || label.includes('monitor');
      
      console.log(`🎙️ Stream from ${targetId}:`, {
        hasVideo,
        label,
        isScreenLabel,
        streamId: remoteStream.id
      });

      setPeers(prev => {
        const existing = prev[targetId];
        
        // Heuristic: If we already have a stream with video, and this one also has video,
        // it's likely a screen share. Or if it has the screen label.
        const isActuallyScreen = isScreenLabel || (hasVideo && existing?.stream?.getVideoTracks().length! > 0);
        
        return {
          ...prev,
          [targetId]: {
            ...existing,
            peer,
            // Assign based on detection, but preserve existing if not overwriting
            stream: !isActuallyScreen ? remoteStream : (existing?.stream ?? null),
            screenStream: isActuallyScreen ? remoteStream : (existing?.screenStream ?? null),
            dataChannel: true,
          },
        };
      });
    });

    peer.on('close', () => {
      console.log('❌ Peer closed:', targetId);
      setPeers(prev => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      delete peersRef.current[targetId];
    });

    peer.on('error', (err) => console.warn('Peer error:', err.message));

    return peer;
  };

  // ─── Voice Chat ──────────────────────────────────────────────────────────
  const initVoiceChat = async () => {
    if (isVoiceChatActive) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, 
          sampleRate: 48000,
          // @ts-ignore
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVoiceChatActive(true);
      console.log('🎤 Voice chat started');
      socket.emit('ready-for-webrtc');
    } catch (err: any) {
      console.error('Mic error:', err);
      alert('Could not start voice chat: ' + err.message);
    }
  };

  // ─── Video Chat ──────────────────────────────────────────────────────────
  const initVideoChat = async () => {
    if (isVoiceChatActive && localStreamRef.current?.getVideoTracks().length! > 0) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          // @ts-ignore
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user', // Better for mobile
        },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVoiceChatActive(true);
      console.log('📹 Video chat started');

      // Add to existing peers
      Object.values(peersRef.current).forEach(peer => {
        try { (peer as any).addStream(stream); } catch (_) {}
      });

      socket.emit('ready-for-webrtc');
    } catch (err: any) {
      console.error('Camera error:', err);
      alert('Could not start video chat: ' + err.message);
    }
  };

  // ─── Call Controls ───────────────────────────────────────────────────────
  const endCall = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    
    Object.values(peersRef.current).forEach(peer => (peer as any).destroy());
    peersRef.current = {};
    setPeers({});
    
    setIsVoiceChatActive(false);
  };

  const toggleAudio = (enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = enabled);
    }
  };

  const toggleVideo = async (enabled: boolean) => {
    if (enabled) {
      await initVideoChat();
    } else {
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach(t => {
          t.stop();
          localStreamRef.current?.removeTrack(t);
        });
      }
    }
  };

  // ─── Screen Share ────────────────────────────────────────────────────────
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      // Optimize for text/detail (Discord-like sharpness)
      stream.getVideoTracks().forEach(track => {
        if ('contentHint' in track) {
          // @ts-ignore
          track.contentHint = 'detail';
        }
      });

      localScreenStreamRef.current = stream;
      setLocalScreenStream(stream);

      // Notify others and add stream
      socket.emit('ready-for-webrtc'); // Refresh signaling
      Object.values(peersRef.current).forEach(peer => {
        try { 
          // @ts-ignore
          peer.addStream(stream); 
        } catch (err) {
          console.warn('Error adding stream to peer during screen share:', err);
        }
      });

      setMediaMode('screen', socket.id!);
      stream.getVideoTracks()[0].onended = stopScreenShare;
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') console.error('Screen share error:', err);
    }
  };

  const stopScreenShare = useCallback(() => {
    const stream = localScreenStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach(t => t.stop());
    Object.values(peersRef.current).forEach(peer => {
      try { (peer as any).removeStream(stream); } catch (_) {}
    });
    localScreenStreamRef.current = null;
    setLocalScreenStream(null);
    setMediaMode('video');
  }, [setMediaMode]);

  // ─── Stream local file to peers (for host sharing local video) ───────────
  const streamToPeers = (stream: MediaStream) => {
    localScreenStreamRef.current = stream;
    Object.values(peersRef.current).forEach(peer => {
      try { (peer as any).addStream(stream); } catch (_) {}
    });
  };

  return {
    peers,
    startScreenShare,
    stopScreenShare,
    streamToPeers,
    initVoiceChat,
    initVideoChat,
    endCall,
    toggleAudio,
    toggleVideo,
    isVoiceChatActive,
    localStream,
    localScreenStream,
    signalReady: () => socket.emit('ready-for-webrtc'),
    sendFile: () => {},
  };
};
