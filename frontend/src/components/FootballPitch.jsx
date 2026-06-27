import PlayerImage from './PlayerImage';

const POSITION_COORDINATES = {
  '433': {
    'GK': { left: '50%', bottom: '5%' },
    'LB': { left: '15%', bottom: '22%' },
    'CB1': { left: '38%', bottom: '20%' },
    'CB2': { left: '62%', bottom: '20%' },
    'RB': { left: '85%', bottom: '22%' },
    'CM1': { left: '25%', bottom: '45%' },
    'CM2': { left: '75%', bottom: '45%' },
    'CAM': { left: '50%', bottom: '52%' },
    'LW': { left: '20%', bottom: '78%' },
    'RW': { left: '80%', bottom: '78%' },
    'ST': { left: '50%', bottom: '82%' },
  },
  '442': {
    'GK': { left: '50%', bottom: '5%' },
    'LB': { left: '15%', bottom: '22%' },
    'CB1': { left: '38%', bottom: '20%' },
    'CB2': { left: '62%', bottom: '20%' },
    'RB': { left: '85%', bottom: '22%' },
    'LM': { left: '15%', bottom: '48%' },
    'CM1': { left: '38%', bottom: '46%' },
    'CM2': { left: '62%', bottom: '46%' },
    'RM': { left: '85%', bottom: '48%' },
    'ST1': { left: '35%', bottom: '78%' },
    'ST2': { left: '65%', bottom: '78%' },
  },
  '4231': {
    'GK': { left: '50%', bottom: '5%' },
    'LB': { left: '15%', bottom: '22%' },
    'CB1': { left: '38%', bottom: '20%' },
    'CB2': { left: '62%', bottom: '20%' },
    'RB': { left: '85%', bottom: '22%' },
    'CDM1': { left: '33%', bottom: '40%' },
    'CDM2': { left: '67%', bottom: '40%' },
    'LM': { left: '15%', bottom: '60%' },
    'CAM': { left: '50%', bottom: '62%' },
    'RM': { left: '85%', bottom: '60%' },
    'ST': { left: '50%', bottom: '82%' },
  },
  '352': {
    'GK': { left: '50%', bottom: '5%' },
    'CB1': { left: '25%', bottom: '20%' },
    'CB2': { left: '50%', bottom: '18%' },
    'CB3': { left: '75%', bottom: '20%' },
    'LM': { left: '12%', bottom: '48%' },
    'CDM1': { left: '33%', bottom: '42%' },
    'CDM2': { left: '67%', bottom: '42%' },
    'RM': { left: '88%', bottom: '48%' },
    'CAM': { left: '50%', bottom: '60%' },
    'ST1': { left: '35%', bottom: '80%' },
    'ST2': { left: '65%', bottom: '80%' },
  },
  '532': {
    'GK': { left: '50%', bottom: '5%' },
    'LWB': { left: '12%', bottom: '25%' },
    'CB1': { left: '30%', bottom: '20%' },
    'CB2': { left: '50%', bottom: '18%' },
    'CB3': { left: '70%', bottom: '20%' },
    'RWB': { left: '88%', bottom: '25%' },
    'CM1': { left: '28%', bottom: '46%' },
    'CM2': { left: '50%', bottom: '48%' },
    'CM3': { left: '72%', bottom: '46%' },
    'ST1': { left: '35%', bottom: '78%' },
    'ST2': { left: '65%', bottom: '78%' },
  },
  '343': {
    'GK': { left: '50%', bottom: '5%' },
    'CB1': { left: '25%', bottom: '20%' },
    'CB2': { left: '50%', bottom: '18%' },
    'CB3': { left: '75%', bottom: '20%' },
    'LM': { left: '15%', bottom: '46%' },
    'CM1': { left: '38%', bottom: '45%' },
    'CM2': { left: '62%', bottom: '45%' },
    'RM': { left: '85%', bottom: '46%' },
    'LW': { left: '20%', bottom: '78%' },
    'RW': { left: '80%', bottom: '78%' },
    'ST': { left: '50%', bottom: '82%' },
  },
  '4141': {
    'GK': { left: '50%', bottom: '5%' },
    'LB': { left: '15%', bottom: '22%' },
    'CB1': { left: '38%', bottom: '20%' },
    'CB2': { left: '62%', bottom: '20%' },
    'RB': { left: '85%', bottom: '22%' },
    'CDM': { left: '50%', bottom: '38%' },
    'LM': { left: '15%', bottom: '54%' },
    'CM1': { left: '38%', bottom: '52%' },
    'CM2': { left: '62%', bottom: '52%' },
    'RM': { left: '85%', bottom: '54%' },
    'ST': { left: '50%', bottom: '82%' },
  },
  '451': {
    'GK': { left: '50%', bottom: '5%' },
    'LB': { left: '15%', bottom: '22%' },
    'CB1': { left: '38%', bottom: '20%' },
    'CB2': { left: '62%', bottom: '20%' },
    'RB': { left: '85%', bottom: '22%' },
    'CM': { left: '50%', bottom: '40%' },
    'LM': { left: '15%', bottom: '58%' },
    'CAM1': { left: '35%', bottom: '62%' },
    'CAM2': { left: '65%', bottom: '62%' },
    'RM': { left: '85%', bottom: '58%' },
    'ST': { left: '50%', bottom: '82%' },
  },
  '451 Flat': {
    'GK': { left: '50%', bottom: '5%' },
    'LB': { left: '15%', bottom: '22%' },
    'CB1': { left: '38%', bottom: '20%' },
    'CB2': { left: '62%', bottom: '20%' },
    'RB': { left: '85%', bottom: '22%' },
    'LM': { left: '15%', bottom: '48%' },
    'CM1': { left: '35%', bottom: '46%' },
    'CM2': { left: '50%', bottom: '46%' },
    'CM3': { left: '65%', bottom: '46%' },
    'RM': { left: '85%', bottom: '48%' },
    'ST': { left: '50%', bottom: '82%' },
  }
};

export default function FootballPitch({ formation = '433', selectedPlayers = [], activeNode = '' }) {
  const coordinates = POSITION_COORDINATES[formation] || POSITION_COORDINATES['433'];

  // Helper to find player and captain status for a position node
  const getEntryForNode = (nodeName) => {
    const found = selectedPlayers.find(p => p.position === nodeName);
    return found || null;
  };

  return (
    <div className="relative w-full aspect-[4/5] max-w-[480px] mx-auto rounded-3xl overflow-hidden bg-gradient-to-b from-pitch-green to-pitch-dark border-2 border-white/10 shadow-2xl p-4">
      {/* Soccer Pitch Markings */}
      <div className="absolute inset-4 border border-pitch-line pointer-events-none rounded-2xl">
        {/* Halfway Line */}
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-pitch-line" />
        
        {/* Center Circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] aspect-square rounded-full border border-pitch-line" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/40" />

        {/* Top Penalty Area */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[55%] h-[18%] border-b border-x border-pitch-line">
          {/* Top Goal Area */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50%] h-[35%] border-b border-x border-pitch-line" />
        </div>
        
        {/* Bottom Penalty Area */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[55%] h-[18%] border-t border-x border-pitch-line">
          {/* Bottom Goal Area */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[50%] h-[35%] border-t border-x border-pitch-line" />
        </div>
      </div>

      {/* Render Player Nodes */}
      {Object.entries(coordinates).map(([nodeName, style]) => {
        const entry = getEntryForNode(nodeName);
        const player = entry ? entry.player : null;
        const isCaptain = entry ? entry.isCaptain : false;
        const isActive = activeNode === nodeName;

        return (
          <div
            key={nodeName}
            style={{
              position: 'absolute',
              left: style.left,
              bottom: style.bottom,
              transform: 'translate(-50%, 50%)',
            }}
            className="flex flex-col items-center z-10"
          >
            {player ? (
              // Drafted Card Node Badge
              <div 
                className={`relative w-14 h-[75px] rounded-md bg-gradient-to-b flex flex-col justify-between p-1 shadow-md text-white text-center cursor-pointer transition-all duration-300 overflow-hidden
                  ${player.overall >= 80 
                    ? 'from-yellow-600 via-amber-500 to-yellow-800 border border-yellow-400/40 glow-gold' 
                    : 'from-slate-400 via-zinc-400 to-slate-600 border border-slate-300/30'
                  }
                `}
              >
                {/* Captain armband badge */}
                {isCaptain && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center shadow-md z-20 border border-yellow-600">
                    <span className="text-[8px] font-black text-black">C</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-[8px] font-black z-10">
                  <span>{player.overall}</span>
                  <span className="opacity-75 uppercase">{nodeName.replace(/\d+$/, '')}</span>
                </div>
                
                {/* Micro Player Image representation */}
                <div className="h-9 w-full flex items-center justify-center overflow-hidden z-0 select-none">
                  <PlayerImage 
                    playerId={player.id}
                    playerName={player.name}
                    alt={player.name}
                    className="h-full object-contain filter drop-shadow-sm"
                  />
                </div>

                <div className="text-[7px] font-black truncate max-w-[48px] leading-tight z-10 bg-black/40 py-0.5 rounded-sm">
                  {player.name.split(' ').pop()}
                </div>
              </div>
            ) : (
              // Placeholder Node
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-[9px] transition-all duration-300
                  ${isActive 
                    ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 animate-pulse scale-110 shadow-lg shadow-yellow-500/20' 
                    : 'border-white/20 bg-black/40 text-white/50'
                  }
                `}
              >
                {nodeName.replace(/\d+$/, '')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
