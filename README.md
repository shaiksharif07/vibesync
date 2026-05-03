# VibeSync 🚀

VibeSync is a premium, real-time social platform designed for long-distance friends to connect through synchronized media playback, high-fidelity voice communication, and interactive theater experiences.

![VibeSync Preview](https://api.dicebear.com/7.x/shapes/svg?seed=VibeSync)

## ✨ Key Features

- **🎬 Extreme Media Sync**: Watch movies together with sub-100ms synchronization. Supports YouTube links and massive local file uploads (up to 10GB).
- **📡 Discord-Level Voice & Video**: Low-latency P2P communication powered by WebRTC, optimized for high-quality audio (128kbps Opus) and sharp screen sharing.
- **🖥️ Ultra-Smooth Screen Sharing**: Broadcast your window or entire display at 30 FPS with text-sharpening hints, perfect for coding or gaming.
- **📱 True Cross-Platform**: Fully responsive design with a dedicated mobile "Theater Mode" and horizontal squad layouts.
- **🕯️ Theater Experience**: Screen Wake Lock API prevents mobile devices from sleeping during movies.
- **🗳️ Real-time Voting & Chat**: Deciding what to watch? Use the integrated voting system and interactive reactions.
- **🛡️ Secure & Private**: Peer-to-peer media transmission with optional room passwords.

## 🛠️ Tech Stack

- **Frontend**: React.js, Vite, Tailwind CSS v4, Motion (Framer Motion).
- **Backend**: Node.js, Express, Socket.IO.
- **Real-time**: WebRTC (Simple-Peer), NTP-style Clock Sync.
- **Streaming**: HLS (Adaptive Bitrate) & Range Request Support.

## 🚀 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Development
```bash
# Start both client and server
npm run dev
```

### 3. Production Build
```bash
npm run build
npm start
```

## 🌐 Deployment
VibeSync is optimized for **ngrok** and other tunneling services. The built-in NTP sync automatically corrects for tunnel latency, ensuring a perfectly synchronized experience across the globe.

## 🤝 Contributing
Contributions are welcome! Feel free to open issues or pull requests.

