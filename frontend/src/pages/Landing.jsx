import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import Leaderboard from './Leaderboard';

export default function Landing() {
  const { createRoom, joinRoom, errorMessage, loading, setErrorMessage } = useGame();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    // Clear errors on load
    setErrorMessage('');
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter your name first');
      return;
    }
    createRoom(name.trim());
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter your name first');
      return;
    }
    if (!code.trim() || code.length !== 6) {
      setErrorMessage('Please enter a valid 6-character room code');
      return;
    }
    joinRoom(code.trim(), name.trim());
  };

  if (showLeaderboard) {
    return (
      <div className="min-h-screen bg-gradient-animate flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl glass-panel rounded-3xl p-8 relative">
          <button 
            onClick={() => setShowLeaderboard(false)}
            className="absolute top-6 left-6 text-sm text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            ← Back to Lobby
          </button>
          <div className="pt-6">
            <Leaderboard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-animate flex flex-col items-center justify-center p-4">
      {/* Title Header */}
      <div className="text-center mb-8">
        <h1 className="text-6xl font-black tracking-tight text-white uppercase select-none">
          Real<span className="text-yellow-400 text-glow-gold">Draft</span>
        </h1>
        <p className="text-gray-400 text-sm mt-2 font-medium tracking-wide">
          Real-Time Multiplayer FIFA Drafting Game
        </p>
      </div>

      {/* Main Form Panel */}
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-center text-white mb-6">
          Enter the Draft Arena
        </h2>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold text-center">
            {errorMessage}
          </div>
        )}

        <div className="space-y-6">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Manager Name
            </label>
            <input
              type="text"
              maxLength={15}
              placeholder="e.g. Guardiola"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/80 transition-all font-semibold"
              disabled={loading}
            />
          </div>

          {!isJoining ? (
            /* Host options */
            <div className="space-y-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black rounded-xl shadow-lg transition-all duration-300 uppercase tracking-wider text-sm flex justify-center items-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Create Draft Room'
                )}
              </button>

              <button
                onClick={() => setIsJoining(true)}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-all duration-300 uppercase tracking-wider text-xs"
              >
                Join Existing Room
              </button>
            </div>
          ) : (
            /* Joining panel options */
            <form onSubmit={handleJoin} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Room Code (6 Letters)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. AX9D2C"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-center tracking-widest placeholder-gray-600 focus:outline-none focus:border-yellow-400 transition-all font-black text-lg"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsJoining(false)}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-all duration-200 uppercase tracking-wider text-xs"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-3 px-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black rounded-xl transition-all duration-200 uppercase tracking-wider text-xs flex justify-center items-center"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Enter Arena'
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="border-t border-white/15 my-6 pt-4 text-center">
            <button
              onClick={() => setShowLeaderboard(true)}
              className="text-xs font-bold text-gray-400 hover:text-yellow-400 uppercase tracking-wider transition-colors"
            >
              🏆 View Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
