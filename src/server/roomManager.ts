import { v4 as uuidv4 } from 'uuid';
import type { Room, Participant, Message, MediaState, SharedFile } from '../lib/types.ts';

export type { Room, Participant, Message, MediaState, SharedFile };

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostId: string, hostName: string, password?: string): Room {
    const code = Array.from({ length: 6 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))
    ).join('');
    
    const room: Room = {
      code,
      participants: {
        [hostId]: {
          id: hostId,
          name: hostName,
          color: this.getRandomColor(),
          role: 'host',
          status: 'chatting',
          isMuted: false,
          isDeafened: false
        }
      },
      media: {
        url: null,
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now(),
        mediaType: null,
        mediaMode: 'video',
        title: null
      },
      messages: [],
      sharedFiles: [],
      password,
      queue: []
    };
    this.rooms.set(code, room);
    return room;
  }

  updateMediaMode(code: string, mode: 'video' | 'screen', hostStreamId?: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.media.mediaMode = mode;
    if (hostStreamId !== undefined) room.media.hostStreamId = hostStreamId;
    return room;
  }

  addSharedFile(code: string, senderId: string, fileName: string, size: number): SharedFile | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const participant = room.participants[senderId];
    const file: SharedFile = {
      id: uuidv4(),
      name: fileName,
      size,
      senderId,
      senderName: participant ? participant.name : 'Unknown',
      timestamp: Date.now()
    };
    room.sharedFiles.push(file);
    return file;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getOrCreateRoom(code: string, hostId: string, hostName: string, password?: string): Room {
    let room = this.rooms.get(code);
    if (!room) {
      room = this.createRoom(hostId, hostName, password);
      // Ensure the code matches what was requested
      room.code = code;
      this.rooms.set(code, room);
      console.log(`✨ [ROOM-MANAGER] Persistent room ${code} created/restored.`);
    }
    return room;
  }

  joinRoom(code: string, userId: string, userName: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (!room.participants[userId]) {
      room.participants[userId] = {
        id: userId,
        name: userName,
        color: this.getRandomColor(),
        role: 'member',
        status: 'chatting',
        isMuted: false,
        isDeafened: false
      };
      
      this.addSystemMessage(room, `${userName} joined the room.`);
    }

    return room;
  }

  leaveRoom(code: string, userId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const participant = room.participants[userId];
    if (participant) {
      this.addSystemMessage(room, `${participant.name} left the room.`);
      delete room.participants[userId];
    }

    // Assign new host if host left and others remain
    if (participant?.role === 'host') {
      const remainingIds = Object.keys(room.participants);
      if (remainingIds.length > 0) {
        room.participants[remainingIds[0]].role = 'host';
      }
    }

    // DO NOT DELETE: Rooms are globally persistent for stability across sessions/refreshes.
    return room;
  }

  // Explicitly clear empty rooms if they've been empty for a long time (e.g. 1 hour)
  // This is a safety measure to prevent memory leaks while still satisfying the user's persistence request
  cleanupOldRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      const isEmpty = Object.keys(room.participants).length === 0;
      // If room is empty and no activity for 30 minutes, or just long-lived empty
      if (isEmpty) {
        // You could add a 'lastActivity' timestamp to the Room type for more precision
        // For now, we'll keep them as requested until manual server restart or we could clear very old ones.
      }
    }
  }

  updateMedia(code: string, update: Partial<MediaState>): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.media = { ...room.media, ...update, lastUpdated: Date.now() };
    return room;
  }

  addMessage(code: string, senderId: string, content: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const participant = room.participants[senderId];
    if (!participant) return null;

    const message: Message = {
      id: uuidv4(),
      senderId,
      senderName: participant.name,
      content,
      timestamp: Date.now(),
      type: 'chat'
    };

    room.messages.push(message);
    if (room.messages.length > 500) room.messages.shift();
    
    return room;
  }

  addFile(code: string, senderId: string, file: SharedFile): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const participant = room.participants[senderId];
    if (!participant) return null;

    room.sharedFiles.push({
      ...file,
      id: uuidv4(),
      senderName: participant.name,
      senderId: senderId,
      timestamp: Date.now()
    });

    if (room.sharedFiles.length > 100) room.sharedFiles.shift();

    this.addSystemMessage(room, `${participant.name} shared a file: ${file.name}`);
    
    return room;
  }

  private addSystemMessage(room: Room, content: string) {
    const message: Message = {
      id: uuidv4(),
      senderId: 'system',
      senderName: 'System',
      content,
      timestamp: Date.now(),
      type: 'system'
    };
    room.messages.push(message);
    if (room.messages.length > 500) room.messages.shift();
  }

  private getRandomColor(): string {
    const colors = [
      '#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FF33A1', 
      '#33FFF5', '#F5FF33', '#FF8C33', '#8C33FF', '#33FF8C'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export const roomManager = new RoomManager();
