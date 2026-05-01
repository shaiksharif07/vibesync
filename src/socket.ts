import { io } from "socket.io-client";

const URL = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin)
  : 'http://localhost:3000';

export const socket = io(URL, {
  autoConnect: false,
  transports: ["polling", "websocket"], // ✅ Polling first for ngrok stability
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 30000,
});
