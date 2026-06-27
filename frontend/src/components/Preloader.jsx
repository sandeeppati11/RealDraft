import React, { useState, useEffect } from 'react';

const HINTS = [
  'Opening Player Card Packs...',
  'Resolving Player Attributes...',
  'Loading Manager Draft Boards...',
  'Synchronizing Pitch Formations...',
  'Analyzing Team Lineups...',
  'Connecting to RealDraft Arena...'
];

export default function Preloader({ progress = 0 }) {
  const [hintIndex, setHintIndex] = useState(0);

  // Cycle through helpful game tips during load
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % HINTS.length);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#030712] z-50 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(5,46,22,0.15)_0%,rgba(3,7,18,1)_70%)] pointer-events-none" />

      {/* Arena Preview Grid */}
      <div className="flex flex-col gap-4 mb-12">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`h-${i}`} className="w-14 h-20 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-px bg-white/10 w-full" />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`o-${i}`} className="w-14 h-20 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      <div className="w-full max-w-xs space-y-3 text-center z-10">
        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-500">
          <span>Loading Round</span>
          <span className="text-yellow-400 font-mono text-glow-gold">{progress}%</span>
        </div>
        
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
          <div 
            style={{ width: `${progress}%` }} 
            className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all duration-75 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
          />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 animate-fadeIn min-h-[16px] transition-all duration-300">
          {HINTS[hintIndex]}
        </p>
      </div>
    </div>
  );
}
