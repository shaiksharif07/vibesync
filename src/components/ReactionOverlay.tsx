import React from 'react';
import { useRoom } from '../context/RoomContext';
import { motion, AnimatePresence } from 'motion/react';

const ReactionOverlay: React.FC = () => {
  const { reactions } = useRoom();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ y: '100vh', x: `${Math.random() * 80 + 10}%`, opacity: 0, scale: 0.5 }}
            animate={{ 
                y: '-20vh', 
                opacity: [0, 1, 1, 0], 
                scale: [0.5, 1.2, 1.2, 0.8],
                rotate: Math.random() * 40 - 20 
            }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute text-4xl"
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ReactionOverlay;
