import React, { useState, useEffect } from 'react';

export default function PlayerImage({ playerId, playerName, className, alt = 'Player' }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  const idStr = String(playerId).padStart(6, '0');
  const part1 = idStr.substring(0, 3);
  const part2 = idStr.substring(3, 6);

  // List of fallback CDN URLs to resolve variations in SoFIFA's folder naming and game version suffixes
  const imageUrls = [
    `https://cdn.sofifa.net/players/${part1}/${part2}/23_120.png`,
    `https://cdn.sofifa.net/players/${part1}/${part2}/24_120.png`,
    `https://cdn.sofifa.net/players/${part1}/${part2}/25_120.png`,
    `https://cdn.sofifa.net/players/${part1}/${part2}/120.png`,
    `https://cdn.sofifa.net/players/4/23/${playerId}.png`
  ];

  // Reset states if the player changes
  useEffect(() => {
    setImageIndex(0);
    setImageError(false);
  }, [playerId]);

  const handleOnError = () => {
    if (imageIndex < imageUrls.length - 1) {
      setImageIndex(prev => prev + 1);
    } else {
      setImageError(true);
    }
  };

  if (imageError) {
    const getInitials = (fullName) => {
      if (!fullName) return '';
      const parts = fullName.split(' ');
      if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    };
    const initials = getInitials(playerName);

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent to-black/30">
        <svg className="w-16 h-16 text-white/10" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
        </svg>
        {initials && (
          <span className="absolute text-xl font-black tracking-wider text-white/30 drop-shadow-md select-none">
            {initials}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={imageUrls[imageIndex]}
      onError={handleOnError}
      alt={alt}
      className={`${className} object-contain`}
      loading="eager"
      referrerPolicy="no-referrer"
    />
  );
}
