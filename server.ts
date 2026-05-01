import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 🔥 Configure high-capacity body limits for large movie files
app.use(express.json({ limit: '10GB' }));
app.use(express.urlencoded({ limit: '10GB', extended: true }));

// ✅ Ensure media directory exists
const mediaDir = path.join(__dirname, "media");
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir);
}

// 🔥 Socket setup (stable for mobile + ngrok)
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // ✅ 100MB buffer for high-res avatars and sync data
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("🟢 NEW CLIENT:", socket.id);

  // 🔥 Global Time Sync (for perfect ngrok synchronization)
  socket.on("ping-server", (clientTimestamp) => {
    socket.emit("pong-server", {
      clientTimestamp,
      serverTimestamp: Date.now()
    });
  });

  socket.on("join-room", ({ roomId, code: roomCode, userName, avatar }) => {
    const code = roomId || roomCode;

    console.log("📩 JOIN REQUEST:", {
      code,
      userName,
      avatar: avatar ? "HAS_AVATAR" : "NO_AVATAR"
    });

    // Create room if not exists
    if (!rooms.has(code)) {
      rooms.set(code, {
        code,
        participants: {},
        media: {
          url: null,
          isPlaying: false,
          currentTime: 0,
          mediaMode: "video",
        },
        messages: [],
        queue: [],
        votes: {},
        settings: { collaborativeControl: false },
      });
      console.log("🆕 CREATED ROOM:", code);
    }

    const room = rooms.get(code)!;
    
    // Safety: Replace massive avatars to avoid system crashes (limit 100KB)
    let safeAvatar = avatar;
    if (avatar && avatar.length > 100000) {
       console.warn(`⚠️ REPLACING LARGE AVATAR (${avatar.length} chars) from ${userName} with placeholder`);
       // A tiny 1x1 transparent pixel or just null to trigger fallback UI
       safeAvatar = ""; 
    }

    socket.join(code);

    // Add participant
    room.participants[socket.id] = {
      id: socket.id,
      name: userName,
      avatar: safeAvatar,
      role:
        Object.keys(room.participants).length === 0 ? "host" : "member",
      status: "watching",
      isMuted: false,
      isDeafened: false,
    };

    console.log("👤 USER JOINED ROOM:", code);

    // 🔥 CRITICAL: deep copy for React updates
    const roomData = {
      code: room.code,
      participants: { ...room.participants },
      media: { ...room.media },
      messages: [...room.messages],
      queue: [...room.queue],
      votes: { ...room.votes },
      settings: { ...room.settings },
    };

    // Log summary instead of full data to avoid Base64 flooding
    console.log(`📡 EMITTING ROOM UPDATE for ${code} (${Object.keys(room.participants).length} participants)`);

    // 🔥 SEND DIRECTLY TO JOINING USER (CRITICAL FIX)
    socket.emit("room-update", roomData);

    // 🔥 ALSO BROADCAST TO OTHERS
    socket.to(code).emit("room-update", roomData);
  });

  // Check room status
  socket.on("check-room", ({ code }) => {
    if (rooms.has(code)) {
      socket.emit("room-status", { status: "ready" });
    } else {
      socket.emit("room-status", { status: "not-found" });
    }
  });

  // Chat messages
  socket.on("send-message", ({ code, content }) => {
    const room = rooms.get(code);
    if (room) {
      const newMessage = {
        id: Math.random().toString(36).slice(2),
        senderId: socket.id,
        content,
        timestamp: Date.now(),
      };
      room.messages.push(newMessage);

      io.to(code).emit("new-message", newMessage);
    }
  });

  // Typing indicators
  socket.on("typing", ({ code, isTyping }) => {
    socket.to(code).emit("user-typing", { userId: socket.id, isTyping });
  });

  // Media updates
  socket.on("update-media", ({ code, state }) => {
    const room = rooms.get(code);
    const participant = room?.participants[socket.id];
    const canControl = participant?.role === 'host' || room?.settings?.collaborativeControl;

    if (room && canControl) {
      room.media = { ...room.media, ...state };

      io.to(code).emit("room-update", {
        code: room.code,
        participants: { ...room.participants },
        media: { ...room.media },
        messages: [...room.messages],
        queue: [...room.queue],
        votes: { ...room.votes },
        settings: { ...room.settings },
      });
    }
  });

  // Participant updates
  socket.on("update-participant", ({ code, updates }) => {
    const room = rooms.get(code);
    if (room && room.participants[socket.id]) {
      room.participants[socket.id] = { ...room.participants[socket.id], ...updates };
      io.to(code).emit("room-update", {
        code: room.code,
        participants: { ...room.participants },
        media: { ...room.media },
        messages: [...room.messages],
        queue: [...room.queue],
        settings: { ...room.settings }
      });
    }
  });

  // Settings management
  socket.on("update-settings", ({ code, settings }) => {
    const room = rooms.get(code);
    if (room) {
      room.settings = { ...room.settings, ...settings };
      io.to(code).emit("room-update", {
        code: room.code,
        participants: { ...room.participants },
        media: { ...room.media },
        messages: [...room.messages],
        queue: [...room.queue],
        settings: { ...room.settings }
      });
    }
  });

  // Queue management
  socket.on("add-to-queue", ({ code, url }) => {
    const room = rooms.get(code);
    if (room) {
      room.queue.push(url);
      io.to(code).emit("room-update", {
        code: room.code,
        participants: { ...room.participants },
        media: { ...room.media },
        messages: [...room.messages],
        queue: [...room.queue],
        votes: { ...room.votes },
        settings: { ...room.settings },
      });
    }
  });

  socket.on("skip-video", ({ code }) => {
    const room = rooms.get(code);
    const participant = room?.participants[socket.id];
    const canControl = participant?.role === 'host' || room?.settings?.collaborativeControl;
    
    if (room && canControl && room.queue.length > 0) {
      const nextUrl = room.queue.shift();
      room.media.url = nextUrl;
      room.media.currentTime = 0;
      room.media.isPlaying = true;
      
      io.to(code).emit("room-update", {
        code: room.code,
        participants: { ...room.participants },
        media: { ...room.media },
        messages: [...room.messages],
        queue: [...room.queue],
        votes: { ...room.votes },
        settings: { ...room.settings },
      });
    }
  });
  socket.on("sync-video", ({ code, ...state }) => {
    const room = rooms.get(code);
    const participant = room?.participants[socket.id];
    const canControl = participant?.role === 'host' || room?.settings?.collaborativeControl;

    if (canControl) {
      room.media.currentTime = state.currentTime;
      room.media.isPlaying = state.isPlaying;
      socket.to(code).emit("video-sync", state);
    }
  });

  // ── Clear media (host resets the player) ────────────────────────────────
  socket.on("clear-media", ({ code }) => {
    const room = rooms.get(code);
    const participant = room?.participants[socket.id];
    if (room && participant?.role === 'host') {
      room.media = { url: null, isPlaying: false, currentTime: 0, mediaMode: 'video' };
      io.to(code).emit("room-update", {
        code: room.code,
        participants: { ...room.participants },
        media: { ...room.media },
        messages: [...room.messages],
        queue: [...room.queue],
        votes: { ...room.votes },
        settings: { ...room.settings },
      });
    }
  });

  // ── Voting system ─────────────────────────────────────────────────────────
  socket.on("cast-vote", ({ code, url, title }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (!room.votes[url]) room.votes[url] = { url, title: title || url, voters: [] };
    if (!room.votes[url].voters.includes(socket.id)) {
      room.votes[url].voters.push(socket.id);
    }
    io.to(code).emit("votes-update", { ...room.votes });
  });

  socket.on("remove-vote", ({ code, url }) => {
    const room = rooms.get(code);
    if (!room || !room.votes[url]) return;
    room.votes[url].voters = room.votes[url].voters.filter((id: string) => id !== socket.id);
    if (room.votes[url].voters.length === 0) delete room.votes[url];
    io.to(code).emit("votes-update", { ...room.votes });
  });

  socket.on("play-voted", ({ code, url }) => {
    const room = rooms.get(code);
    const participant = room?.participants[socket.id];
    if (room && participant?.role === 'host') {
      room.media = { ...room.media, url, isPlaying: true, currentTime: 0 };
      delete room.votes[url]; // Remove from votes once played
      io.to(code).emit("room-update", {
        code: room.code,
        participants: { ...room.participants },
        media: { ...room.media },
        messages: [...room.messages],
        queue: [...room.queue],
        votes: { ...room.votes },
        settings: { ...room.settings },
      });
      io.to(code).emit("votes-update", { ...room.votes });
    }
  });

  // Reactions
  socket.on("send-reaction", ({ code, emoji }) => {
    const reaction = { id: Math.random().toString(36).slice(2), emoji, senderId: socket.id };
    io.to(code).emit("receive-reaction", reaction);
  });

  // WebRTC Signaling
  socket.on("ready-for-webrtc", () => {
    for (const [code, room] of rooms.entries()) {
      if (room.participants[socket.id]) {
        socket.to(code).emit("initiate-webrtc", { peerId: socket.id });
      }
    }
  });

  socket.on("signal", ({ to, from, signal }) => {
    io.to(to).emit("signal", { from, signal });
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("🔴 DISCONNECTED:", socket.id);

    for (const [code, room] of rooms.entries()) {
      if (room.participants[socket.id]) {
        delete room.participants[socket.id];

        // 🔥 emit updated room
        io.to(code).emit("room-update", {
          code: room.code,
          participants: { ...room.participants },
          media: { ...room.media },
          messages: [...room.messages],
          queue: [...room.queue],
          votes: { ...room.votes },
          settings: { ...room.settings },
        });

        console.log(`📊 ROOM ${code} STATE: ${Object.keys(room.participants).length} participants`);

        // ✅ Delay deletion (IMPORTANT FIX)
        if (Object.keys(room.participants).length === 0) {
          setTimeout(() => {
            const currentRoom = rooms.get(code);

            if (currentRoom && Object.keys(currentRoom.participants).length === 0) {
              rooms.delete(code);
              console.log("🗑️ ROOM DELETED AFTER DELAY:", code);
            }
          }, 180000); // Wait 3 minutes before destroying the room to allow for network drops
        }
      }
    }
  });
});

// Serve frontend
const distPath = path.resolve(__dirname, "dist");
app.use(express.static(distPath));

// 🎬 Adaptive Bitrate Streaming (HLS)
const hlsDir = path.join(__dirname, "hls");
if (!fs.existsSync(hlsDir)) {
  fs.mkdirSync(hlsDir);
}
app.use("/stream", express.static(hlsDir));

// 🎬 Netflix-style Video Streaming Route (supports Range Requests)
app.post("/upload/:filename", (req, res) => {
  req.setTimeout(0); // Disable timeout for large movie uploads
  const filePath = path.join(__dirname, "media", req.params.filename);
  const stream = fs.createWriteStream(filePath);
  
  req.pipe(stream);
  
  req.on("end", () => {
    console.log(`✅ UPLOAD COMPLETE: ${req.params.filename}`);
    res.status(200).send({ url: `/media/${req.params.filename}` });
  });

  req.on("error", (err) => {
    console.error("❌ UPLOAD FAILED:", err);
    res.status(500).send("Upload failed");
  });
});

app.get("/media/:filename", (req, res) => {
  const filePath = path.join(__dirname, "media", req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  const chunkSize = end - start + 1;
  const stream = fs.createReadStream(filePath, { start, end });

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": "video/mp4",
  });

  res.setTimeout(0); // Disable timeout for long movie streams
  stream.pipe(res);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Start server
const PORT = parseInt(process.env.PORT || "3000", 10);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});