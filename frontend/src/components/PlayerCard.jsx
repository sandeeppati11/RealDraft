import React from 'react';
import PlayerImage from './PlayerImage';

export default function PlayerCard({ 
  player, 
  onSelect, 
  selected = false, 
  disabled = false, 
  showStats = true,
  revealed = true
}) {
  if (!player) return null;

  const {
    name,
    overall,
    position,
    nation,
    club,
    league,
    pace,
    shooting,
    passing,
    dribbling,
    defending,
    physical,
    tier
  } = player;

  // Determine card style based on overall rating
  let cardBgClass = 'from-amber-700 via-amber-600 to-amber-900 text-amber-100 border-amber-500/30'; // Bronze
  let glowColor = 'shadow-amber-500/10';
  let badgeColor = 'bg-amber-800/80 text-amber-200';
  
  if (overall >= 80) {
    // Gold/Elite/World Class
    cardBgClass = 'from-yellow-600 via-amber-500 to-yellow-800 text-yellow-50 border-yellow-400/40';
    glowColor = 'shadow-yellow-500/25';
    badgeColor = 'bg-yellow-900/60 text-yellow-100';
  } else if (overall >= 74) {
    // Silver
    cardBgClass = 'from-slate-400 via-zinc-400 to-slate-600 text-slate-50 border-slate-300/30';
    glowColor = 'shadow-slate-400/15';
    badgeColor = 'bg-slate-800/60 text-slate-100';
  }

  return (
    <div
      onClick={() => !disabled && onSelect && onSelect(player)}
      className={`relative w-full max-w-[192px] rounded-2xl p-[3px] transition-all duration-300 transform select-none cursor-pointer
        ${disabled ? 'cursor-not-allowed' : 'hover:-translate-y-2 hover:scale-[1.03]'}
        ${selected 
          ? `bg-gradient-to-r from-green-400 to-emerald-500 scale-[1.02] shadow-2xl ${glowColor}` 
          : 'bg-gradient-to-b from-white/10 to-transparent hover:from-white/25 hover:to-white/5'
        }
      `}
    >
      {/* Inner card border wrapper */}
      <div className={`relative h-72 rounded-[14px] bg-gradient-to-b ${cardBgClass} overflow-hidden shadow-lg border flex flex-col justify-between`}>
        
        {/* Shiny pack light overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
        
        {/* Top Details (Rating, Position, Nation Badge) */}
        <div className="flex justify-between items-start p-3 z-10">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black leading-none tracking-tighter drop-shadow-md">
              {overall}
            </span>
            <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded font-black tracking-wide ${badgeColor}`}>
              {position}
            </span>
          </div>
          <div className="flex flex-col items-end text-right">
            {/* Nation flag emoji fallback or abbreviation */}
            <span className="text-xl filter drop-shadow-sm select-none" title={nation}>
              {getFlagEmoji(nation) || '🌍'}
            </span>
            <span className="text-[9px] opacity-75 font-semibold mt-1 max-w-[80px] truncate" title={club}>
              {club}
            </span>
          </div>
        </div>

        {/* Player Face / Silhouette using cascading image loader */}
        <div className="relative flex-grow flex items-center justify-center overflow-hidden h-28 select-none">
          <PlayerImage 
            playerId={player.id}
            playerName={name}
            alt={name}
            className="h-full object-contain filter drop-shadow-lg z-0"
          />
        </div>

        {/* Name and Face Stats */}
        <div className="bg-black/40 backdrop-blur-[2px] p-3 text-center border-t border-white/5 flex flex-col justify-end z-10">
          <h3 className="font-extrabold text-sm tracking-tight truncate drop-shadow-md pb-1.5 border-b border-white/10">
            {name}
          </h3>

          {showStats && (
            <div className="grid grid-cols-6 gap-x-1 gap-y-0.5 pt-1.5 text-[9px] font-bold text-center">
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[7px]">PAC</span>
                <span className="text-sm font-black">{pace}</span>
              </div>
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[7px]">SHO</span>
                <span className="text-sm font-black">{shooting}</span>
              </div>
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[7px]">PAS</span>
                <span className="text-sm font-black">{passing}</span>
              </div>
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[7px]">DRI</span>
                <span className="text-sm font-black">{dribbling}</span>
              </div>
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[7px]">DEF</span>
                <span className="text-sm font-black">{defending}</span>
              </div>
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[7px]">PHY</span>
                <span className="text-sm font-black">{physical}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple country name to flag emoji mapper
function getFlagEmoji(countryName) {
  if (!countryName) return '';
  const countryMap = {
    'Argentina': '🇦🇷',
    'Belgium': '🇧🇪',
    'Brazil': '🇧🇷',
    'Croatia': '🇭🇷',
    'Denmark': '🇩🇰',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'France': '🇫🇷',
    'Germany': '🇩🇪',
    'Italy': '🇮🇹',
    'Netherlands': '🇳🇱',
    'Norway': '🇳🇴',
    'Poland': '🇵🇱',
    'Portugal': '🇵🇹',
    'Senegal': '🇸🇳',
    'Spain': '🇪🇸',
    'Sweden': '🇸🇪',
    'Uruguay': '🇺🇾',
    'United States': '🇺🇸',
    'Mexico': '🇲🇽',
    'Colombia': '🇨🇴',
    'Egypt': '🇪🇬',
    'Morocco': '🇲🇦',
    'Algeria': '🇩🇿',
    'Canada': '🇨🇦',
    'Korea Republic': '🇰🇷',
    'Japan': '🇯🇵',
    'Switzerland': '🇨🇭',
    'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'Austria': '🇦🇹',
    'Turkey': '🇹🇷',
    'Ukraine': '🇺🇦',
  };
  return countryMap[countryName] || '';
}
