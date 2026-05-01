export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  role: 'host' | 'member';
  status: 'watching' | 'listening' | 'chatting' | 'away' | 'speaking';
  isMuted: boolean;
  isDeafened: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: 'chat' | 'system';
}

export interface MediaState {
  url: string | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
  mediaType: 'video' | 'audio' | null;
  type?: 'url' | 'local';
  mediaMode: 'video' | 'screen';
  title: string | null;
  hostStreamId?: string | null;
}

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export interface Room {
  code: string;
  participants: Record<string, Participant>;
  media: MediaState;
  messages: Message[];
  sharedFiles: SharedFile[];
  password?: string;
  queue: string[];
}

export interface Vote {
  url: string;
  title: string;
  voters: string[];
}
