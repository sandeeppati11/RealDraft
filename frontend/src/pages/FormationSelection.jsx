import React, { useState } from 'react';
import { useGame } from '../context/GameContext';

const FORMATIONS = [
  { name: '433', label: '4-3-3 Attack', desc: 'Classic winger-heavy attacking formation' },
  { name: '442', label: '4-4-2 Flat', desc: 'Solid, balanced traditional British layout' },
  { name: '4231', label: '4-2-3-1 Wide', desc: 'Modern tactical system with dual CDMs' },
  { name: '352', label: '3-5-2', desc: 'Midfield dominance with three CBs and dual STs' },
  { name: '532', label: '5-3-2', desc: 'Ultra-defensive with wingbacks and a solid spine' },
  { name: '343', label: '3-4-3', desc: 'High-risk high-reward hyper-attacking system' }
];

export default function FormationSelection() {
  const { room, playerName, selectFormation } = useGame();
  const [selected, setSelected] = useState('');
  const [locked, setLocked] = useState(false);

  const isHost = room?.host?.name === playerName;
  const self = isHost ? room?.host : room?.opponent;
  const opponent = isHost ? room?.opponent : room?.host;

  const handleConfirm = () => {
    if (!selected) return;
    setLocked(true);
    selectFormation(selected);
  };

  const getPositionSummary = (name) => {
    switch (name) {
      case '433': return 'GK | LB - CB - CB - RB | CM - CM - CAM | LW - ST - RW';
      case '442': return 'GK | LB - CB - CB - RB | LM - CM - CM - RM | ST - ST';
      case '4231': return 'GK | LB - CB - CB - RB | CDM - CDM | LM - CAM - RM | ST';
      case '352': return 'GK | CB - CB - CB | LM - CDM - CDM - RM - CAM | ST - ST';
      case '532': return 'GK | LWB - CB - CB - CB - RWB | CM - CM - CM | ST - ST';
      case '343': return 'GK | CB - CB - CB | LM - CM - CM - RM | LW - ST - RW';
      default: return '';
    }
  };

  // If the user already confirmed in socket room state
  const hasLocked = self?.ready || locked;

  return (
    <div className="min-h-screen bg-gradient-animate flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <span className="inline-block px-3 py-1 bg-yellow-500/10 border border-yellow-400/20 text-yellow-400 text-[10px] font-black tracking-widest rounded-full uppercase mb-2">
            Tactical Meeting
          </span>
          <h2 className="text-3xl font-extrabold text-white">
            Choose Your Formation
          </h2>
          <p className="text-gray-400 text-xs mt-2">
            Select a system that fits your playstyle. This will determine your draft options.
          </p>
        </div>

        {hasLocked ? (
          /* Waiting Screen after locking */
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center font-black text-xs text-yellow-400">
                Ready
              </span>
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white">
                Formation Locked: {self?.formation?.replace(/(\d)/g, '$1-')}
              </h3>
              <p className="text-gray-400 text-xs">
                {getPositionSummary(self?.formation)}
              </p>
              <div className="pt-4 flex items-center justify-center gap-2">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Opponent Status:
                </span>
                {opponent?.ready ? (
                  <span className="text-xs text-green-400 font-black uppercase tracking-wider">
                    Ready
                  </span>
                ) : (
                  <span className="text-xs text-amber-400 font-black uppercase tracking-wider animate-pulse">
                    Choosing...
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Selection Grid */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FORMATIONS.map((f) => (
                <div
                  key={f.name}
                  onClick={() => setSelected(f.name)}
                  className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer text-left
                    ${selected === f.name 
                      ? 'bg-yellow-400/10 border-yellow-400/80 shadow-lg shadow-yellow-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                    }
                  `}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-lg font-black text-white">
                      {f.name.replace(/(\d)/g, '$1-')}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      {f.label}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs leading-normal">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Selection Preview & Actions */}
            {selected && (
              <div className="p-4 bg-black/40 border border-white/10 rounded-2xl animate-fadeIn">
                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Tactical Layout Preview
                </span>
                <span className="text-sm font-black text-yellow-400 font-mono tracking-wide">
                  {getPositionSummary(selected)}
                </span>
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!selected}
              className={`w-full py-4 px-4 font-black rounded-xl uppercase tracking-wider text-sm transition-all duration-300
                ${selected 
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg hover:from-yellow-400 hover:to-amber-500' 
                  : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                }
              `}
            >
              Confirm & Lock Formation
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
