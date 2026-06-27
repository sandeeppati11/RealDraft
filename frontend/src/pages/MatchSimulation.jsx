import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import FootballPitch from '../components/FootballPitch';

// ──────────────────────────────────────────────
// Animated Loading Screen (adapted for modal viewport)
// ──────────────────────────────────────────────
function MatchLoadingScreen({ hostName, opponentName, onReady }) {
  const [phase, setPhase] = useState(0); 
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Loading squads...');

  const phases = [
    { text: 'Loading squads...', icon: '🏟️', duration: 700 },
    { text: 'Analyzing formations...', icon: '📊', duration: 800 },
    { text: 'Running AI simulation...', icon: '⚡', duration: 900 },
    { text: 'Calculating final score...', icon: '⚽', duration: 600 },
  ];

  useEffect(() => {
    let elapsed = 0;
    const totalDuration = phases.reduce((s, p) => s + p.duration, 0);

    const progressInterval = setInterval(() => {
      elapsed += 30;
      setProgress(Math.min(100, Math.floor((elapsed / totalDuration) * 100)));
    }, 30);

    let delay = 0;
    phases.forEach((p, i) => {
      setTimeout(() => {
        setPhase(i);
        setStatusText(p.text);
      }, delay);
      delay += p.duration;
    });

    const readyTimer = setTimeout(() => {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(onReady, 300);
    }, totalDuration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(readyTimer);
    };
  }, []);

  return (
    <div className="w-full flex flex-col items-center justify-center py-8 text-white">
      {/* Stadium pulse rings */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="absolute w-32 h-32 rounded-full border border-yellow-400/10 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute w-44 h-44 rounded-full border border-yellow-400/5 animate-ping" style={{ animationDuration: '2.6s', animationDelay: '0.3s' }} />

        {/* Central icon */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-700/20 border border-yellow-400/30 flex items-center justify-center shadow-2xl backdrop-blur-sm">
          <span
            className="text-4xl transition-all duration-500 select-none animate-pulse"
            style={{ filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.5))' }}
          >
            {phases[phase]?.icon}
          </span>
        </div>
      </div>

      {/* VS header */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-base font-black truncate max-w-[110px] text-right">{hostName}</span>
        <div className="px-2.5 py-0.5 bg-yellow-500/20 border border-yellow-400/30 rounded-full">
          <span className="text-yellow-400 font-black text-xs tracking-widest">VS</span>
        </div>
        <span className="text-base font-black truncate max-w-[110px]">{opponentName}</span>
      </div>

      {/* Status text */}
      <p
        key={statusText}
        className="text-yellow-300 text-xs font-bold uppercase tracking-widest mb-6 animate-fadeIn"
      >
        {statusText}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs px-4">
        <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
          <span>Simulation</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const getVisibleScorers = (scorers = [], min) => {
  return (scorers || []).filter(s => s.minute <= min);
};

const POSITION_ORDER = [
  'GK', 'LWB', 'RWB', 'LB', 'RB', 'CB', 'CB1', 'CB2', 'CB3', 
  'CDM', 'CDM1', 'CDM2', 'CM', 'CM1', 'CM2', 'CM3', 'LM', 'RM', 
  'CAM', 'CAM1', 'CAM2', 'LW', 'RW', 'CF', 'ST', 'ST1', 'ST2'
];

const sortPlayersByPosition = (players = []) => {
  return [...players].sort((a, b) => {
    const idxA = POSITION_ORDER.indexOf(a.position);
    const idxB = POSITION_ORDER.indexOf(b.position);
    return (idxA > -1 ? idxA : 999) - (idxB > -1 ? idxB : 999);
  });
};

// ──────────────────────────────────────────────
// Main MatchSimulation Page
// ──────────────────────────────────────────────
export default function MatchSimulation() {
  const { room, matchResult, fetchMatchResult, resetGame } = useGame();
  const [currentMinute, setCurrentMinute] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(150);
  const [events, setEvents] = useState([]);
  const [scores, setScores] = useState({ host: 0, opponent: 0 });
  const [hasStartedLoader, setHasStartedLoader] = useState(false);
  const [loadingDone, setLoadingDone] = useState(false);
  const highlightsEndRef = useRef(null);

  // Trigger match result fetch
  useEffect(() => {
    if (room?.code && !matchResult) {
      fetchMatchResult(room.code);
    }
  }, [room, matchResult]);

  // Parse commentary events
  useEffect(() => {
    if (!matchResult) return;
    const parsed = [];
    matchResult.commentary.forEach((line) => {
      const match = line.match(/^(\d+)'/);
      if (match) {
        const minute = parseInt(match[1]);
        const isGoal = line.includes('GOAL!');
        let team = '';
        if (isGoal) {
          if (line.includes(`for ${matchResult.hostName}`)) team = 'host';
          else if (line.includes(`for ${matchResult.opponentName}`)) team = 'opponent';
        }
        parsed.push({ minute, text: line, isGoal, team });
      }
    });
    setEvents(parsed);
  }, [matchResult]);

  // Match clock simulation
  useEffect(() => {
    if (!isPlaying || !matchResult || currentMinute >= 90) return;
    const interval = setInterval(() => {
      setCurrentMinute((prev) => {
        const nextMin = prev + 1;
        const hostGoals = events.filter(e => e.isGoal && e.team === 'host' && e.minute <= nextMin).length;
        const oppGoals  = events.filter(e => e.isGoal && e.team === 'opponent' && e.minute <= nextMin).length;
        setScores({ host: hostGoals, opponent: oppGoals });
        if (nextMin >= 90) { clearInterval(interval); setIsPlaying(false); return 90; }
        return nextMin;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [isPlaying, currentMinute, events, speed, matchResult]);

  // Scroll highlights
  useEffect(() => {
    if (highlightsEndRef.current) {
      highlightsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMinute]);

  const handleStartMatchSimulation = () => {
    setHasStartedLoader(true);
  };

  const handleReplay = () => {
    setCurrentMinute(0);
    setScores({ host: 0, opponent: 0 });
    setLoadingDone(false);
  };

  const hostName = room?.host?.name || 'Host';
  const opponentName = room?.opponent?.name || 'Opponent';
  const hostRatings = matchResult?.hostRatings || { attack: 75, midfield: 75, defense: 75 };
  const opponentRatings = matchResult?.opponentRatings || { attack: 75, midfield: 75, defense: 75 };

  const visibleHighlights = events.filter((e) => e.minute <= currentMinute);
  const hostWinner = (matchResult?.hostScore || 0) > (matchResult?.opponentScore || 0);
  const isDraw      = (matchResult?.hostScore || 0) === (matchResult?.opponentScore || 0);

  return (
    <div className="min-h-screen bg-gradient-animate text-white p-4 flex flex-col items-center relative">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Background Lineups Screen (Always rendered underneath modal) */}
      {/* ───────────────────────────────────────────────────────────── */}
      
      {/* Scoreboard showing Pre-match state */}
      <div className="w-full max-w-4xl glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl space-y-6 mb-6">
        <div className="flex justify-between items-center text-center px-6 py-4 bg-black/40 border border-white/10 rounded-2xl">
          <div className="flex-1">
            <h3 className="text-xl font-extrabold truncate">{hostName}</h3>
          </div>
          
          <div className="flex flex-col items-center px-8 border-x border-white/10">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
              Prematch
            </span>
            <div className="text-5xl font-black font-mono tracking-wider flex items-center gap-4">
              <span>0</span>
              <span className="text-gray-600 text-3xl">:</span>
              <span>0</span>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-xl font-extrabold truncate">{opponentName}</h3>
          </div>
        </div>

        {/* Large Proceed to Play Button */}
        <button
          onClick={handleStartMatchSimulation}
          className="w-full py-5 bg-gradient-to-r from-yellow-500 via-amber-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black rounded-2xl uppercase tracking-widest text-sm transition-all duration-300 shadow-2xl scale-[1.01] hover:scale-[1.02]"
        >
          ⚽ PROCEED TO PLAY MATCH
        </button>
      </div>

      {/* Tactical Lineups Grid */}
      <div className="w-full max-w-6xl mt-2 space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight uppercase">Tactical Lineups</h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Compare selected formations before kickoff</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start pb-10">
          {/* Host Pitch Card */}
          <div className="glass-panel rounded-3xl p-5 border border-white/10 flex flex-col items-center space-y-4">
            <div className="text-center">
              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                Formation: {room?.host?.formation}
              </span>
              <h3 className="text-lg font-black mt-2 text-white/90">{hostName} XI</h3>
            </div>
            <div className="w-full max-w-[420px]">
              <FootballPitch 
                formation={room?.host?.formation} 
                selectedPlayers={room?.host?.selectedPlayers} 
              />
            </div>

            {/* List Lineup */}
            <div className="w-full bg-black/25 border border-white/5 rounded-2xl p-4 space-y-2">
              <span className="block text-[9px] font-black text-gray-500 uppercase tracking-widest text-left pl-1">Starting Lineup</span>
              <div className="grid grid-cols-1 gap-1 text-xs text-gray-300">
                {sortPlayersByPosition(room?.host?.selectedPlayers || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-white/5 last:border-b-0">
                    <span className="font-mono text-yellow-400 font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded text-[10px] w-12 text-center shrink-0">
                      {item.position}
                    </span>
                    <span className="flex-1 truncate pl-3 font-bold text-left text-white/90">{item.player.name}</span>
                    <span className="font-extrabold text-gray-400 shrink-0 text-[10px]">{item.player.overall} OVR</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Opponent Pitch Card */}
          <div className="glass-panel rounded-3xl p-5 border border-white/10 flex flex-col items-center space-y-4">
            <div className="text-center">
              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                Formation: {room?.opponent?.formation}
              </span>
              <h3 className="text-lg font-black mt-2 text-white/90">{opponentName} XI</h3>
            </div>
            <div className="w-full max-w-[420px]">
              <FootballPitch 
                formation={room?.opponent?.formation} 
                selectedPlayers={room?.opponent?.selectedPlayers} 
              />
            </div>

            {/* List Lineup */}
            <div className="w-full bg-black/25 border border-white/5 rounded-2xl p-4 space-y-2">
              <span className="block text-[9px] font-black text-gray-500 uppercase tracking-widest text-left pl-1">Starting Lineup</span>
              <div className="grid grid-cols-1 gap-1 text-xs text-gray-300">
                {sortPlayersByPosition(room?.opponent?.selectedPlayers || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-white/5 last:border-b-0">
                    <span className="font-mono text-yellow-400 font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded text-[10px] w-12 text-center shrink-0">
                      {item.position}
                    </span>
                    <span className="flex-1 truncate pl-3 font-bold text-left text-white/90">{item.player.name}</span>
                    <span className="font-extrabold text-gray-400 shrink-0 text-[10px]">{item.player.overall} OVR</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Modal Popup Overlay (HUD Simulation Window)                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {hasStartedLoader && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl glass-panel rounded-3xl border border-white/15 shadow-2xl p-6 overflow-y-auto max-h-[92vh] flex flex-col items-center justify-between animate-fade-in-up">
            
            {/* Modal Screen Type Selector */}
            {!loadingDone || !matchResult ? (
              // 1. Modal Sub-Screen: Pre-loading Transition Screen
              <MatchLoadingScreen
                hostName={hostName}
                opponentName={opponentName}
                onReady={() => {
                  setLoadingDone(true);
                  setIsPlaying(true);
                }}
              />
            ) : (
              // 2. Modal Sub-Screen: Active Simulation HUD & Celebration Results
              <div className="w-full space-y-6">
                
                {/* HUD Scoreboard */}
                <div className="flex justify-between items-start text-center px-4 py-4 bg-black/40 border border-white/10 rounded-2xl">
                  {/* Host Info & Dynamic Scorers */}
                  <div className="flex-1 min-w-0 flex flex-col items-center lg:items-start text-center lg:text-left">
                    <h3 className="text-lg font-extrabold truncate text-white">{hostName}</h3>
                    <div className="flex justify-center gap-2 mt-1 text-[8px] text-gray-400 font-semibold uppercase">
                      <span>ATK: {hostRatings.attack}</span>
                      <span>MID: {hostRatings.midfield}</span>
                      <span>DEF: {hostRatings.defense}</span>
                    </div>
                    {/* Dynamic scorers list ticking in real-time */}
                    <div className="mt-2 space-y-0.5 max-h-[70px] overflow-y-auto w-full">
                      {getVisibleScorers(matchResult?.hostScorers, currentMinute).map((s, idx) => (
                        <div key={idx} className="text-[9px] text-gray-400 font-bold flex items-center justify-center lg:justify-start gap-1">
                          <span>⚽</span>
                          <span>{s.name} ({s.minute}')</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Score Timer Card */}
                  <div className="flex flex-col items-center px-6 border-x border-white/10 shrink-0">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                      {currentMinute === 90 ? 'Full Time' : `${currentMinute}'`}
                    </span>
                    <div className="text-4xl font-black font-mono tracking-wider flex items-center gap-3">
                      <span>{scores.host}</span>
                      <span className="text-gray-600 text-2xl">:</span>
                      <span>{scores.opponent}</span>
                    </div>
                  </div>

                  {/* Opponent Info & Dynamic Scorers */}
                  <div className="flex-1 min-w-0 flex flex-col items-center lg:items-end text-center lg:text-right">
                    <h3 className="text-lg font-extrabold truncate text-white">{opponentName}</h3>
                    <div className="flex justify-center gap-2 mt-1 text-[8px] text-gray-400 font-semibold uppercase">
                      <span>ATK: {opponentRatings.attack}</span>
                      <span>MID: {opponentRatings.midfield}</span>
                      <span>DEF: {opponentRatings.defense}</span>
                    </div>
                    {/* Dynamic scorers list ticking in real-time */}
                    <div className="mt-2 space-y-0.5 max-h-[70px] overflow-y-auto w-full">
                      {getVisibleScorers(matchResult?.opponentScorers, currentMinute).map((s, idx) => (
                        <div key={idx} className="text-[9px] text-gray-400 font-bold flex items-center justify-center lg:justify-end gap-1">
                          <span>{s.name} ({s.minute}')</span>
                          <span>⚽</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Simulation Speed Toggles */}
                {isPlaying && currentMinute < 90 && (
                  <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-gray-400 uppercase">
                    <span>Speed:</span>
                    {[
                      { label: '1x', val: 250 },
                      { label: '2x Fast', val: 100 },
                      { label: '5x Turbo', val: 40 },
                    ].map(({ label, val }) => (
                      <button
                        key={val}
                        onClick={() => setSpeed(val)}
                        className={`px-2.5 py-1 rounded border transition-colors ${speed === val ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400' : 'border-white/10 hover:border-white/30'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Commentary Logs */}
                {currentMinute > 0 && currentMinute < 90 && (
                  <div className="space-y-2">
                    <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                      Live Commentary
                    </span>
                    <div className="h-48 overflow-y-auto bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2 scrollbar-thin">
                      {visibleHighlights.map((event, idx) => (
                        <div
                          key={idx}
                          className={`text-xs font-semibold py-1 border-b border-white/5 last:border-b-0 flex items-start gap-2.5 animate-fadeIn
                            ${event.isGoal ? 'text-green-400 font-extrabold text-glow-gold' : 'text-gray-300'}
                          `}
                        >
                          <span className="text-[10px] font-black text-gray-500 font-mono tracking-wider w-8 shrink-0">
                            {event.minute}'
                          </span>
                          <div>
                            {event.isGoal && <span className="mr-1">⚽</span>}
                            {event.text.split(" ' ").pop()}
                          </div>
                        </div>
                      ))}
                      <div ref={highlightsEndRef} />
                    </div>
                  </div>
                )}

                {/* Celebration Result Overlay Inside Modal */}
                {currentMinute === 90 && (
                  <div className="space-y-6 text-center animate-fade-in-up">
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-400/30 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce">
                        <span className="text-3xl filter drop-shadow-md">🏆</span>
                      </div>
                      <h2 className="text-3xl font-black tracking-tight text-white uppercase">
                        {isDraw ? (
                          "It's a Stalemate!"
                        ) : (
                          <>
                            <span className="text-yellow-400 text-glow-gold">
                              {hostWinner ? hostName : opponentName}
                            </span>{' '}
                            Wins!
                          </>
                        )}
                      </h2>
                      <p className="text-gray-400 text-xs font-semibold">
                        Final scoreline: {scores.host} - {scores.opponent}
                      </p>
                    </div>

                    {/* MVP Award Card */}
                    <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⭐</span>
                        <div className="text-left">
                          <span className="block text-[8px] font-black text-yellow-400 uppercase tracking-widest">Match MVP</span>
                          <span className="text-sm font-black text-white">{matchResult?.mvp}</span>
                        </div>
                      </div>
                      <span className="text-xs bg-yellow-500 text-black px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">MVP</span>
                    </div>

                    {/* Full Match Statistics Table */}
                    <div className="space-y-3">
                      <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider text-left pl-1">
                        Match Statistics
                      </span>
                      <div className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-3.5 shadow-inner">
                        {[
                          { label: 'Possession', host: `${matchResult?.stats?.hostPossession}%`, opp: `${matchResult?.stats?.opponentPossession}%` },
                          { label: 'Shots', host: matchResult?.stats?.hostShots || 0, opp: matchResult?.stats?.opponentShots || 0 },
                          { label: 'Shots on Target', host: matchResult?.stats?.hostShotsOnTarget || 0, opp: matchResult?.stats?.opponentShotsOnTarget || 0 },
                          { label: 'Passes Completed', host: matchResult?.stats?.hostPasses || 0, opp: matchResult?.stats?.opponentPasses || 0 },
                          { label: 'Pass Accuracy', host: `${matchResult?.stats?.hostPassAccuracy || 0}%`, opp: `${matchResult?.stats?.opponentPassAccuracy || 0}%` },
                          { label: 'Corners', host: matchResult?.stats?.hostCorners || 0, opp: matchResult?.stats?.opponentCorners || 0 },
                          { label: 'Fouls Committed', host: matchResult?.stats?.hostFouls || 0, opp: matchResult?.stats?.opponentFouls || 0 },
                          { label: 'Yellow Cards', host: matchResult?.stats?.hostYellowCards || 0, opp: matchResult?.stats?.opponentYellowCards || 0 },
                          { label: 'Goalkeeper Saves', host: matchResult?.stats?.hostSaves || 0, opp: matchResult?.stats?.opponentSaves || 0 }
                        ].map((stat, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                            <span className="w-16 text-left font-extrabold text-white">{stat.host}</span>
                            <span className="flex-1 text-center text-gray-400 font-bold uppercase tracking-wider text-[9px]">{stat.label}</span>
                            <span className="w-16 text-right font-extrabold text-white">{stat.opp}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={handleReplay}
                        className="flex-1 py-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black rounded-xl uppercase tracking-wider text-sm transition-all duration-200 shadow-lg"
                      >
                        🔄 Replay Match
                      </button>
                      <button
                        onClick={resetGame}
                        className="flex-1 py-4 bg-white/10 hover:bg-white/15 text-white font-black rounded-xl border border-white/10 uppercase tracking-wider text-sm transition-all duration-200 shadow-lg"
                      >
                        🚪 Exit to Lobby
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
