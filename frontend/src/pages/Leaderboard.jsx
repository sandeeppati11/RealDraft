import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';

export default function Leaderboard() {
  const { leaderboard, getLeaderboard } = useGame();

  useEffect(() => {
    getLeaderboard();
  }, []);

  return (
    <div className="space-y-6 text-white text-left">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold text-white">
          🏆 Draft Leaderboard
        </h2>
        <p className="text-gray-400 text-xs mt-1">
          Top draft managers ranked by total points (Win = 3pts, Draw = 1pt)
        </p>
      </div>

      <div className="overflow-hidden bg-black/40 border border-white/10 rounded-2xl">
        <table className="w-full text-sm font-semibold">
          <thead className="bg-white/5 border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4 text-center w-16">Rank</th>
              <th className="py-3 px-4 text-left">Manager</th>
              <th className="py-3 px-4 text-center w-20">Points</th>
              <th className="py-3 px-4 text-center w-16">W</th>
              <th className="py-3 px-4 text-center w-16">D</th>
              <th className="py-3 px-4 text-center w-16">L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leaderboard.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 text-xs uppercase tracking-wider">
                  No records yet. Be the first to win!
                </td>
              </tr>
            ) : (
              leaderboard.map((player, idx) => {
                const rank = idx + 1;
                let rankBadge = `${rank}`;
                if (rank === 1) rankBadge = '🥇';
                else if (rank === 2) rankBadge = '🥈';
                else if (rank === 3) rankBadge = '🥉';

                return (
                  <tr key={player.playerName} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-center font-black text-lg select-none">
                      {rankBadge}
                    </td>
                    <td className="py-3 px-4 font-bold text-white truncate max-w-[200px]">
                      {player.playerName}
                    </td>
                    <td className="py-3 px-4 text-center font-black text-yellow-400 text-glow-gold">
                      {player.points}
                    </td>
                    <td className="py-3 px-4 text-center text-green-400">{player.wins}</td>
                    <td className="py-3 px-4 text-center text-gray-400">{player.draws}</td>
                    <td className="py-3 px-4 text-center text-red-400">{player.losses}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
