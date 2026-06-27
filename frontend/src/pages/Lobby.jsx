import React, { useState } from 'react';
import { useGame } from '../context/GameContext';

export default function Lobby() {
  const { roomCode, room, resetGame } = useGame();
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hostName = room?.host?.name || 'Host';

  return (
    <div className="min-h-screen bg-gradient-animate flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl text-center space-y-8">
        
        {/* Header */}
        <div>
          <span className="inline-block px-3 py-1 bg-yellow-500/10 border border-yellow-400/20 text-yellow-400 text-[10px] font-black tracking-widest rounded-full uppercase mb-2">
            Game Lobby
          </span>
          <h2 className="text-3xl font-extrabold text-white">
            Waiting for Opponent
          </h2>
          <p className="text-gray-400 text-xs mt-2">
            Share this room code with your opponent to start the draft
          </p>
        </div>

        {/* Room Code Box */}
        <div className="p-4 bg-black/40 border border-white/10 rounded-2xl relative">
          <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Room Code
          </span>
          <span className="text-4xl font-black tracking-widest text-white block select-all font-mono">
            {roomCode}
          </span>
          
          <button
            onClick={copyCode}
            className={`mt-3 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 border
              ${copied 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
              }
            `}
          >
            {copied ? '✓ Copied' : 'Copy Code'}
          </button>
        </div>

        {/* Player Status List */}
        <div className="space-y-3 text-left">
          <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            Managers Joined
          </span>
          
          {/* Host */}
          <div className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-extrabold text-sm text-white">{hostName}</span>
            </div>
            <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
              Host / Player 1
            </span>
          </div>

          {/* Opponent placeholder */}
          <div className="flex justify-between items-center p-3 bg-black/20 border border-dashed border-white/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-600 animate-ping" />
              <span className="font-bold text-sm text-gray-500">Searching...</span>
            </div>
            <span className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">
              Waiting for Player 2
            </span>
          </div>
        </div>

        {/* Leave Button */}
        <div className="pt-2">
          <button
            onClick={resetGame}
            className="w-full py-3 px-4 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/40 text-red-300 font-bold rounded-xl transition-all duration-200 uppercase tracking-wider text-xs"
          >
            Leave Lobby
          </button>
        </div>

      </div>
    </div>
  );
}
