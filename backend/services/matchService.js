/**
 * Helper to check the major tactical group of a position.
 */
const getMajorGroup = (pos) => {
  if (pos === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  if (['ST', 'CF', 'LW', 'RW'].includes(pos)) return 'ATT';
  return 'OTH';
};

/**
 * Calculates position match rating modifier based on chemistry rules.
 */
const getPositionModifier = (player, cleanNode) => {
  if (!cleanNode) return 1.0;
  
  // 1. Primary Position Match (100% effectiveness)
  if (player.position === cleanNode) {
    return 1.0;
  }
  
  // 2. Secondary Position Match (85% effectiveness)
  if (player.secondaryPositions && player.secondaryPositions.includes(cleanNode)) {
    return 0.85;
  }
  
  // 3. Similar Position Match (same department group, e.g. LM playing CM) (70% effectiveness)
  const playerGroup = getMajorGroup(player.position);
  const slotGroup = getMajorGroup(cleanNode);
  if (playerGroup === slotGroup) {
    return 0.70;
  }
  
  // 4. Completely Wrong Position (different department groups, e.g. ST playing CB) (40% effectiveness)
  return 0.40;
};

/**
 * Calculates ratings and strength metrics for a drafted team.
 * @param {Array<object>} selectedPlayers - List of { position, player } selected.
 * @returns {object} - Object containing ratings.
 */
const calculateTeamRatings = (selectedPlayers) => {
  if (!selectedPlayers || selectedPlayers.length === 0) {
    return { 
      overall: 0, attack: 0, midfield: 0, defense: 0, goalkeeper: 0,
      draftScore: 0, formationBalance: 0, captainBonus: 0,
      pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70
    };
  }

  let totalOverall = 0;
  let totalDraftScore = 0;
  
  let attSum = 0, attCount = 0;
  let midSum = 0, midCount = 0;
  let defSum = 0, defCount = 0;
  let gkSum = 0, gkCount = 0;
  
  let paceSum = 0, shootingSum = 0, passingSum = 0, dribblingSum = 0, defendingSum = 0, physicalSum = 0;
  let modifierSum = 0;
  let captainBonus = 0;

  selectedPlayers.forEach(({ position: nodePosition, player, isCaptain }) => {
    if (!player) return;
    
    const cleanNode = (nodePosition || '').replace(/\d+$/, '');
    const modifier = getPositionModifier(player, cleanNode);
    modifierSum += modifier;

    // Apply modifier to overall and draft score
    const effOverall = (player.overall || 70) * modifier;
    const effDraftScore = (player.draftScore || 70) * modifier;
    
    totalOverall += effOverall;
    totalDraftScore += effDraftScore;
    
    // Outfield sub-attributes scaled by modifier
    paceSum += (player.pace || 70) * modifier;
    shootingSum += (player.shooting || 70) * modifier;
    passingSum += (player.passing || 70) * modifier;
    dribblingSum += (player.dribbling || 70) * modifier;
    defendingSum += (player.defending || 70) * modifier;
    physicalSum += (player.physical || 70) * modifier;

    const group = getMajorGroup(cleanNode || player.position || '');
    if (group === 'ATT') {
      attSum += effOverall;
      attCount++;
    } else if (group === 'MID') {
      midSum += effOverall;
      midCount++;
    } else if (group === 'DEF') {
      defSum += effOverall;
      defCount++;
    } else if (group === 'GK') {
      gkSum += effOverall;
      gkCount++;
    }

    // Captain bonus: check if player overall >= 88 and is flagged as captain candidate
    if ((isCaptain || player.isCaptain) && player.isCaptainCandidate && (player.overall || 0) >= 88) {
      captainBonus = 3;
    }
  });

  const count = selectedPlayers.length;
  
  return {
    overall: Math.round(totalOverall / count),
    attack: attCount > 0 ? Math.round(attSum / attCount) : 70,
    midfield: midCount > 0 ? Math.round(midSum / midCount) : 70,
    defense: defCount > 0 ? Math.round(defSum / defCount) : 70,
    goalkeeper: gkCount > 0 ? Math.round(gkSum / gkCount) : 70,
    draftScore: Math.round(totalDraftScore / count),
    formationBalance: Math.round((modifierSum / count) * 10), // Scale to 0-10
    captainBonus,
    pace: Math.round(paceSum / count),
    shooting: Math.round(shootingSum / count),
    passing: Math.round(passingSum / count),
    dribbling: Math.round(dribblingSum / count),
    defending: Math.round(defendingSum / count),
    physical: Math.round(physicalSum / count)
  };
};

/**
 * Simulates a football match between two drafted teams.
 * @param {string} roomCode - The room code.
 * @param {object} host - The host member data.
 * @param {object} opponent - The opponent member data.
 * @returns {object} - Simulated match results.
 */
const simulateMatch = (roomCode, host, opponent) => {
  const hostRatings = calculateTeamRatings(host.selectedPlayers);
  const opponentRatings = calculateTeamRatings(opponent.selectedPlayers);
  
  // 1. Midfield Control & Possession
  // Combine Midfield group rating and team attributes (passing and dribbling)
  const hostMidfieldStrength = (hostRatings.midfield * 0.6) + ((hostRatings.passing + hostRatings.dribbling) / 2) * 0.4;
  const opponentMidfieldStrength = (opponentRatings.midfield * 0.6) + ((opponentRatings.passing + opponentRatings.dribbling) / 2) * 0.4;
  
  const totalMidfield = hostMidfieldStrength + opponentMidfieldStrength;
  let hostPossession = Math.round((hostMidfieldStrength / (totalMidfield || 1)) * 100);
  // Add random factor of +/- 3%
  hostPossession += Math.round(Math.random() * 6 - 3);
  // Clamp possession between 30% and 70% for realism
  hostPossession = Math.max(30, Math.min(70, hostPossession));
  const opponentPossession = 100 - hostPossession;

  // 2. Chance Creation (Shots)
  // Higher Midfield Control + Pace/Passing creates more opportunities
  // Host attacks:
  const hostChancesBase = 4 + (hostMidfieldStrength / (opponentMidfieldStrength || 1)) * 6 + ((hostRatings.pace + hostRatings.passing) / 20);
  // Opponent attacks:
  const opponentChancesBase = 4 + (opponentMidfieldStrength / (hostMidfieldStrength || 1)) * 6 + ((opponentRatings.pace + opponentRatings.passing) / 20);
  
  // Opponent Defense reduces host chances, and vice versa
  const hostDefStrength = (hostRatings.defense * 0.7) + (hostRatings.defending * 0.3);
  const opponentDefStrength = (opponentRatings.defense * 0.7) + (opponentRatings.defending * 0.3);
  
  // Final shots conceded depends on defense efficiency (benchmark is 80 rating)
  const hostShots = Math.max(0, Math.round(opponentChancesBase * (80 / (hostDefStrength || 1)) + Math.random() * 3));
  const opponentShots = Math.max(0, Math.round(hostChancesBase * (80 / (opponentDefStrength || 1)) + Math.random() * 3));

  // 3. Goal Conversion (Goal Generation & GK interaction)
  // Attack (Overall + Shooting) vs GK (Goalkeeper + Physical)
  const hostAttStrength = (hostRatings.attack * 0.6) + (hostRatings.shooting * 0.4);
  const opponentAttStrength = (opponentRatings.attack * 0.6) + (opponentRatings.shooting * 0.4);
  
  const hostGkStrength = (hostRatings.goalkeeper * 0.8) + (hostRatings.physical * 0.2);
  const opponentGkStrength = (opponentRatings.goalkeeper * 0.8) + (opponentRatings.physical * 0.2);
  
  // Base conversion ratio is around 10-15%, scaled by attack vs gk, and a tiny physical duel bonus
  const hostPhysicalRatio = Math.pow(hostRatings.physical / (opponentRatings.physical || 1), 0.2);
  const opponentPhysicalRatio = Math.pow(opponentRatings.physical / (hostRatings.physical || 1), 0.2);

  // Captain influence gives a 3% boost to efficiency
  const hostCaptainFactor = hostRatings.captainBonus > 0 ? 1.03 : 1.0;
  const opponentCaptainFactor = opponentRatings.captainBonus > 0 ? 1.03 : 1.0;

  // Add random variance of 0% to 5%
  const hostConversionRate = (0.10 * (hostAttStrength / (opponentGkStrength || 1)) + Math.random() * 0.05) * hostPhysicalRatio * hostCaptainFactor;
  const opponentConversionRate = (0.10 * (opponentAttStrength / (hostGkStrength || 1)) + Math.random() * 0.05) * opponentPhysicalRatio * opponentCaptainFactor;

  let hostScore = Math.round(opponentShots * hostConversionRate);
  let opponentScore = Math.round(hostShots * opponentConversionRate);

  // Safety caps
  hostScore = Math.min(6, Math.max(0, hostScore));
  opponentScore = Math.min(6, Math.max(0, opponentScore));

  // 4. Match Strength (Rebalanced tactical strength with reduced randomness)
  // Lucky factor is reduced to a narrow range of 2.0 to 5.0 ( finishing touch, not deciding factor )
  const hostRandom = 2.0 + Math.random() * 3.0;
  const opponentRandom = 2.0 + Math.random() * 3.0;
  
  const hostStrength = (hostRatings.attack * 0.25) + 
                       (hostRatings.midfield * 0.25) + 
                       (hostRatings.defense * 0.20) + 
                       (hostRatings.goalkeeper * 0.15) + 
                       (hostRatings.formationBalance * 1.0) + 
                       hostRatings.captainBonus + 
                       hostRandom;
                       
  const opponentStrength = (opponentRatings.attack * 0.25) + 
                           (opponentRatings.midfield * 0.25) + 
                           (opponentRatings.defense * 0.20) + 
                           (opponentRatings.goalkeeper * 0.15) + 
                           (opponentRatings.formationBalance * 1.0) + 
                           opponentRatings.captainBonus + 
                           opponentRandom;

  // Determine scorers
  const getScorers = (playersList, score) => {
    if (score === 0) return [];
    
    // Filter out players assigned to the GK pitch node
    const candidates = playersList.filter(p => p.position !== 'GK');
    if (candidates.length === 0) return Array(score).fill("Unknown Scorer");

    // Assign probability weights based on Shooting stat
    const scorers = [];
    for (let i = 0; i < score; i++) {
      const totalWeight = candidates.reduce((sum, p) => sum + (p.player.shooting || 70), 0);
      let rand = Math.random() * totalWeight;
      let selected = candidates[0].player.name;
      
      for (const p of candidates) {
        rand -= (p.player.shooting || 70);
        if (rand <= 0) {
          selected = p.player.name;
          break;
        }
      }
      scorers.push(selected);
    }
    return scorers;
  };

  const hostRawScorers = getScorers(host.selectedPlayers, hostScore);
  const opponentRawScorers = getScorers(opponent.selectedPlayers, opponentScore);

  // MVP selection (Highest rating player on the winning team, or draw)
  const winningTeam = hostScore >= opponentScore ? host : opponent;
  const mvpPlayer = winningTeam.selectedPlayers.sort((a, b) => b.player.overall - a.player.overall)[0];
  const mvp = mvpPlayer ? mvpPlayer.player.name : "N/A";

  // Shots on Target must be >= goals and <= total shots
  // Opponent shots are host's shots faced (conceded by opponent), and vice versa
  const hostShotsOnTarget = hostScore + Math.floor(Math.random() * Math.max(1, (opponentShots - hostScore) * 0.45));
  const opponentShotsOnTarget = opponentScore + Math.floor(Math.random() * Math.max(1, (hostShots - opponentScore) * 0.45));

  // Passes proportional to possession
  const hostPasses = Math.round((hostPossession / 100) * 900 + Math.random() * 60);
  const opponentPasses = Math.round((opponentPossession / 100) * 900 + Math.random() * 60);

  const hostPassAccuracy = Math.round(75 + (hostRatings.midfield - 70) * 0.65 + Math.random() * 5);
  const opponentPassAccuracy = Math.round(75 + (opponentRatings.midfield - 70) * 0.65 + Math.random() * 5);

  const hostFouls = Math.floor(Math.random() * 8) + 4;
  const opponentFouls = Math.floor(Math.random() * 8) + 4;

  const hostYellowCards = Math.floor(Math.random() * Math.max(1, hostFouls * 0.25));
  const opponentYellowCards = Math.floor(Math.random() * Math.max(1, opponentFouls * 0.25));

  const hostCorners = Math.floor(Math.random() * 6) + 2;
  const opponentCorners = Math.floor(Math.random() * 6) + 2;

  // Saves = opponent's shots on target minus opponent's goals
  // Opponent shots on target is what host goalkeeper faced
  const hostSaves = Math.max(0, opponentShotsOnTarget - opponentScore);
  const opponentSaves = Math.max(0, hostShotsOnTarget - hostScore);

  // Generate Match Highlights (Commentary) and attach goal minutes
  const commentary = [];
  const events = [];
  const hostScorers = [];
  const opponentScorers = [];
  
  hostRawScorers.forEach(scorerName => {
    const min = Math.floor(Math.random() * 88) + 1;
    events.push({ minute: min, team: 'host', scorer: scorerName });
    hostScorers.push({ name: scorerName, minute: min });
  });

  opponentRawScorers.forEach(scorerName => {
    const min = Math.floor(Math.random() * 88) + 1;
    events.push({ minute: min, team: 'opponent', scorer: scorerName });
    opponentScorers.push({ name: scorerName, minute: min });
  });

  hostScorers.sort((a, b) => a.minute - b.minute);
  opponentScorers.sort((a, b) => a.minute - b.minute);
  
  const genericMoments = [
    { text: "Kickoff! The match is underway under clear skies.", minute: 1 },
    { text: "Great tackle in the midfield stops a dangerous counterattack.", minute: 15 },
    { text: "Stunning shot from distance hits the crossbar!", minute: 32 },
    { text: "Halftime whistle blows. Both managers heading down the tunnel to regroup.", minute: 45 },
    { text: "Spectacular diving save by the keeper denies a certain goal!", minute: 58 },
    { text: "Yellow card issued for a reckless challenge in the box.", minute: 73 },
    { text: "Fulltime! The referee blows the final whistle.", minute: 90 }
  ];
  
  events.push(...genericMoments);
  events.sort((a, b) => a.minute - b.minute);

  events.forEach(event => {
    if (event.text) {
      commentary.push(`${event.minute}' - ${event.text}`);
    } else if (event.team === 'host') {
      commentary.push(`${event.minute}' - GOAL! ${event.scorer} scoring for ${host.name} with a clinical strike!`);
    } else {
      commentary.push(`${event.minute}' - GOAL! ${event.scorer} scores for ${opponent.name} with an absolute rocket!`);
    }
  });

  return {
    roomCode,
    hostName: host.name,
    opponentName: opponent.name,
    hostScore,
    opponentScore,
    mvp,
    hostScorers,
    opponentScorers,
    stats: {
      hostPossession,
      opponentPossession,
      hostShots: opponentShots, // opponent's shots faced is what host shot!
      opponentShots: hostShots, // host's shots faced is what opponent shot!
      hostShotsOnTarget,
      opponentShotsOnTarget,
      hostPasses,
      opponentPasses,
      hostPassAccuracy,
      opponentPassAccuracy,
      hostFouls,
      opponentFouls,
      hostYellowCards,
      opponentYellowCards,
      hostCorners,
      opponentCorners,
      hostSaves,
      opponentSaves
    },
    commentary,
    hostRatings,
    opponentRatings
  };
};

module.exports = {
  calculateTeamRatings,
  simulateMatch
};
