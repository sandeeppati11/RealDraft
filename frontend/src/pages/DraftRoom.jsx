import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import PlayerCard from '../components/PlayerCard';
import FootballPitch from '../components/FootballPitch';

const FORMATION_POSITIONS = {
  '433': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM1', 'CM2', 'CAM', 'LW', 'RW', 'ST'],
  '442': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'LM', 'CM1', 'CM2', 'RM', 'ST1', 'ST2'],
  '4231': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CDM1', 'CDM2', 'CAM', 'LM', 'RM', 'ST'],
  '352': ['GK', 'CB1', 'CB2', 'CB3', 'LM', 'CDM1', 'CDM2', 'RM', 'CAM', 'ST1', 'ST2'],
  '532': ['GK', 'LWB', 'CB1', 'CB2', 'CB3', 'RWB', 'CM1', 'CM2', 'CM3', 'ST1', 'ST2'],
  '4141': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CDM', 'LM', 'CM1', 'CM2', 'RM', 'ST'],
  '451': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM', 'LM', 'CAM1', 'CAM2', 'RM', 'ST'],
  '343': ['GK', 'CB1', 'CB2', 'CB3', 'LM', 'CM1', 'CM2', 'RM', 'LW', 'RW', 'ST'],
  '451 Flat': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'LM', 'CM1', 'CM2', 'CM3', 'RM', 'ST']
};

export default function DraftRoom() {
  const { room, playerName, timer, pickPlayer } = useGame();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isRevealingCards, setIsRevealingCards] = useState(true);
  const prevRoundRef = React.useRef(-1);

  const isHost = room?.host?.name === playerName;
  const self = isHost ? room?.host : room?.opponent;
  const opponent = isHost ? room?.opponent : room?.host;

  const currentRound = room?.currentPositionIndex || 0;
  const expectedCount = currentRound + 1;

  // Check if self and opponent locked for this round
  const selfLocked = self?.selectedPlayers?.length >= expectedCount;
  const opponentLocked = opponent?.selectedPlayers?.length >= expectedCount;

  // Options for this round
  const myOptions = isHost ? room?.hostOptions : room?.opponentOptions;
  const opponentOptions = isHost ? room?.opponentOptions : room?.hostOptions;

  // Active position node name
  // Round 0 = Captain Pick (position determined by who is picked, shown after selection)
  // Round 1-10 = remaining formation slots after skipping the captain's taken slot
  const getActiveNodeName = () => {
    if (currentRound === 0) return '★ Captain Pick';
    const formationList = FORMATION_POSITIONS[self?.formation] || FORMATION_POSITIONS['433'];
    // Find which slot the captain occupies
    const captainEntry = self?.selectedPlayers?.find(p => p.isCaptain);
    const captainSlotIdx = captainEntry ? formationList.indexOf(captainEntry.position) : -1;
    // Remaining slots = all formation slots except the captain's
    const remainingSlots = formationList.filter((_, i) => i !== captainSlotIdx);
    return remainingSlots[currentRound - 1] || 'Draft Complete';
  };

  const activeNode = getActiveNodeName();

  const optionIdsStr = myOptions ? myOptions.map(p => p.id).join(',') : '';

  // Reset state and preload images when new options are received
  useEffect(() => {
    if (!optionIdsStr) return;

    setSelectedPlayer(null);
    setHasConfirmed(false);
    setIsRevealingCards(true);

    const urls = (myOptions || []).map(p => {
      const idStr = String(p.id).padStart(6, '0');
      const part1 = idStr.substring(0, 3);
      const part2 = idStr.substring(3, 6);
      return `https://cdn.sofifa.net/players/${part1}/${part2}/23_120.png`;
    });

    const startTime = Date.now();
    let active = true;

    const loadImg = (url) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
      });
    };

    Promise.all(urls.map(loadImg)).then(() => {
      if (!active) return;
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1000 - elapsed); // Show at least 1s for style
      setTimeout(() => {
        if (active) setIsRevealingCards(false);
      }, remaining);
    });

    return () => {
      active = false;
    };
  }, [optionIdsStr]);

  const handleConfirm = () => {
    if (!selectedPlayer || selfLocked) return;
    setHasConfirmed(true);
    pickPlayer(selectedPlayer.id);
  };

  // Get opponent's locked pick for the current round (if they locked it)
  const getOpponentCurrentPick = () => {
    if (!opponentLocked || !opponent?.selectedPlayers) return null;
    // The selection index corresponds to the current round
    const pickObj = opponent.selectedPlayers[currentRound];
    return pickObj ? pickObj.player : null;
  };

  const oppCurrentPick = getOpponentCurrentPick();

  // Timer alert styles
  let timerColor = 'text-green-400 border-green-500/30 bg-green-500/10';
  if (timer <= 5) {
    timerColor = 'text-red-500 border-red-500/50 bg-red-500/10 animate-pulse';
  } else if (timer <= 15) {
    timerColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  }

  return (
    <div className="min-h-screen bg-gradient-animate text-white flex flex-col p-4">
      {/* Top Header Panel */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4 mb-6 border border-white/10">
        <div>
          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
            RealDraft Round {currentRound + 1}/11
          </span>
          <h2 className="text-xl font-black mt-1">
            Active Selection:{' '}
            <span className="text-yellow-400">
              {currentRound === 0
                ? '★ Captain Pick'
                : activeNode.replace(/\d+$/, '')}
            </span>
          </h2>
        </div>
        
        {/* Sync draft timer */}
        <div className={`flex items-center gap-3 px-4 py-2 border rounded-xl ${timerColor} transition-all duration-300`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xl font-black font-mono tracking-widest">{timer}s</span>
        </div>

        <div className="text-right">
          <span className="text-xs text-gray-400 font-bold block">Room Code</span>
          <span className="text-sm font-black font-mono text-gray-300">{room?.code}</span>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-grow">
        
        {/* Left Column: Tactical Field Pitch */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-3">
            Your Tactical Board
          </h3>
          <FootballPitch 
            formation={self?.formation} 
            selectedPlayers={self?.selectedPlayers} 
            activeNode={activeNode} 
          />
        </div>

        {/* Right Column: Active Card Selection Board */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main selection board */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col justify-between min-h-[380px]">
            
            {selfLocked || hasConfirmed ? (
              // Locked Picking Screen waiting for opponent
              <div className="flex flex-col items-center justify-center flex-grow py-12 space-y-4">
                <div className="w-12 h-12 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
                <h3 className="text-xl font-black">Selection Locked</h3>
                <p className="text-xs text-gray-400">
                  Waiting for your opponent to complete their pick...
                </p>
                {/* Show locked player */}
                {self?.selectedPlayers && self.selectedPlayers[currentRound] && (
                  <div className="mt-4 scale-95 opacity-90">
                    <PlayerCard player={self.selectedPlayers[currentRound].player} showStats={true} disabled={true} />
                  </div>
                )}
              </div>
            ) : (
              // Active picking screen
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-black uppercase tracking-wider text-white">
                    Select Your Player
                  </h3>
                  <p className="text-gray-400 text-xs mt-1 block lg:hidden">
                    👈 Swipe left/right to view options, tap to select
                  </p>
                  <p className="text-gray-400 text-xs mt-1 hidden lg:block">
                    Choose one player to lock into your squad. Unselected cards return to the shared pool.
                  </p>
                </div>

                {/* ── Card Reveal Loader ── */}
                {isRevealingCards ? (
                  <div className="flex flex-col items-center justify-center flex-grow py-10 space-y-5">
                    {/* Scanning bar animation */}
                    <div className="relative w-48 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full h-full animate-scan-bar" />
                    </div>

                    {/* Pulsing card silhouettes */}
                    <div className="flex gap-2 items-end">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className="rounded-lg bg-white/5 border border-white/8 animate-card-pulse"
                          style={{
                            width: i === 4 ? 36 : 40,
                            height: i % 2 === 0 ? 60 : 52,
                            animationDelay: `${i * 0.12}s`,
                          }}
                        />
                      ))}
                    </div>

                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400/70">
                      Revealing Players
                      <span className="inline-flex gap-0.5 ml-1">
                        {[0,1,2].map(i => (
                          <span key={i} className="animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>.</span>
                        ))}
                      </span>
                    </p>
                  </div>
                ) : (
                  /* ── Cards grid (fades in after loader) ── */
                  <div className="flex flex-row overflow-x-auto lg:overflow-x-visible lg:justify-center lg:items-start gap-4 py-3 px-2 w-full snap-x snap-mandatory scrollbar-none scroll-smooth animate-fade-in-up">
                    {myOptions && myOptions.map((player, idx) => (
                      <div
                        key={player.id}
                        className="flex justify-center shrink-0 snap-center w-[145px] sm:w-[170px] lg:w-[180px] xl:w-[192px]"
                        style={{ animationDelay: `${idx * 0.07}s` }}
                      >
                        <div className="w-full flex justify-center">
                          <PlayerCard
                            player={player}
                            selected={selectedPlayer?.id === player.id}
                            onSelect={(p) => setSelectedPlayer(p)}
                            disabled={false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4">
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedPlayer}
                    className={`w-full py-4 px-4 font-black rounded-xl uppercase tracking-wider text-sm transition-all duration-300
                      ${selectedPlayer 
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg hover:from-yellow-400 hover:to-amber-500 scale-[1.01]' 
                        : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      }
                    `}
                  >
                    {selectedPlayer ? `Lock ${selectedPlayer.name} into Squad` : 'Select a Player Card'}
                  </button>
                </div>
              </>
            )}
          </div>


        </div>

      </div>
    </div>
  );
}
