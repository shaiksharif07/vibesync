import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { Vote as VoteType } from '../lib/types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ThumbsUp, Play, Trash2, Link2, ChevronDown, ChevronUp, Vote } from 'lucide-react';

const VotingPanel: React.FC = () => {
  const { room, userId, votes, castVote, removeVote, playVoted, updateMedia } = useRoom();
  const [urlInput, setUrlInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const isHost = room?.participants[userId!]?.role === 'host';

  const sortedVotes = (Object.values(votes) as VoteType[]).sort((a, b) => b.voters.length - a.voters.length);

  const handleSuggest = (e: React.FormEvent) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;

    // Try to extract YouTube title from URL for display
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=))([^&?]+)/);
    const title = ytMatch ? `YouTube: ${ytMatch[1]}` : url.split('/').pop() || url;

    castVote(url, title);
    setUrlInput('');
  };

  const hasVoted = (url: string) => votes[url]?.voters.includes(userId!) || false;

  return (
    <div className="bg-[#0d0d1a] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Vote size={14} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            What's Next
          </span>
          {sortedVotes.length > 0 && (
            <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {sortedVotes.length}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {/* Suggest URL input */}
              <form onSubmit={handleSuggest} className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <Link2 size={12} className="text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Suggest a YouTube link..."
                    className="bg-transparent text-[11px] text-white placeholder-slate-600 outline-none flex-1 min-w-0"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-all active:scale-95"
                >
                  <Plus size={14} className="text-white" />
                </button>
              </form>

              {/* Vote list */}
              {sortedVotes.length === 0 ? (
                <p className="text-center text-[10px] text-slate-600 py-3">
                  No suggestions yet. Be first!
                </p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {sortedVotes.map((item, i) => {
                    const voted = hasVoted(item.url);
                    const isTop = i === 0;
                    return (
                      <motion.div
                        key={item.url}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                          isTop
                            ? 'bg-indigo-600/10 border-indigo-500/30'
                            : 'bg-white/3 border-white/5'
                        }`}
                      >
                        {/* Vote count */}
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isTop ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'
                        }`}>
                          {item.voters.length}
                        </div>

                        {/* Title */}
                        <span className="flex-1 text-[11px] text-white/80 truncate min-w-0">
                          {item.title.length > 35 ? item.title.slice(0, 35) + '…' : item.title}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Vote toggle */}
                          <button
                            onClick={() => voted ? removeVote(item.url) : castVote(item.url, item.title)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                              voted
                                ? 'bg-indigo-500 text-white'
                                : 'bg-white/5 text-slate-400 hover:text-indigo-400'
                            }`}
                            title={voted ? 'Remove vote' : 'Vote'}
                          >
                            <ThumbsUp size={10} />
                          </button>

                          {/* Host: Play now */}
                          {isHost && (
                            <button
                              onClick={() => {
                                updateMedia({ url: item.url, isPlaying: true, currentTime: 0 });
                                playVoted(item.url);
                              }}
                              className="w-6 h-6 bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center justify-center transition-all active:scale-90"
                              title="Play this now"
                            >
                              <Play size={9} fill="white" className="text-white ml-0.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VotingPanel;
