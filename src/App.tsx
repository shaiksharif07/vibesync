import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RoomProvider } from './context/RoomContext';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';

export default function App() {
  return (
    <Router>
      <RoomProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/join/:roomId" element={<LandingPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RoomProvider>
    </Router>
  );
}
