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
  
  // 1. Team Identities (Precompute modifiers)
  // Technical bonus for possession & pass accuracy
  const hostTechBonus = Math.max(0, (hostRatings.passing + hostRatings.dribbling) / 2 - 78) * 0.4;
  const opponentTechBonus = Math.max(0, (opponentRatings.passing + opponentRatings.dribbling) / 2 - 78) * 0.4;

  // Pace bonus for counter-attacking chance creation
  const hostPaceBonus = Math.max(0, hostRatings.pace - 78) * 0.08;
  const opponentPaceBonus = Math.max(0, opponentRatings.pace - 78) * 0.08;

  // Physical bonus for aerial duels & goal conversion
  const hostPhysBonus = Math.max(0, hostRatings.physical - 78) * 0.004;
  const opponentPhysBonus = Math.max(0, opponentRatings.physical - 78) * 0.004;

  // Defensive block scaling (reducing opponent chances)
  const hostDefFactor = 1.0 - Math.max(0, hostRatings.defending - 78) * 0.012;
  const opponentDefFactor = 1.0 - Math.max(0, opponentRatings.defending - 78) * 0.012;

  // 2. Setup segment simulation (6 blocks of 15 minutes)
  let hostScore = 0;
  let opponentScore = 0;
  let hostShots = 0;
  let opponentShots = 0;
  
  let hostPossessionSum = 0;
  const goalEvents = [];

  let hostMomentum = 1.0;
  let opponentMomentum = 1.0;

  const hostPhysicalRatio = Math.pow(hostRatings.physical / (opponentRatings.physical || 1), 0.2);
  const opponentPhysicalRatio = Math.pow(opponentRatings.physical / (hostRatings.physical || 1), 0.2);

  const hostCaptainFactor = hostRatings.captainBonus > 0 ? 1.03 : 1.0;
  const opponentCaptainFactor = opponentRatings.captainBonus > 0 ? 1.03 : 1.0;

  for (let segment = 0; segment < 6; segment++) {
    const startMin = segment * 15;
    const isLateGame = segment === 5; // 75' - 90'

    // Decay momentum back to 1.0 slightly at start of segment
    hostMomentum = hostMomentum * 0.8 + 1.0 * 0.2;
    opponentMomentum = opponentMomentum * 0.8 + 1.0 * 0.2;

    // Calculate ratings with momentum
    const hostMidfieldStrength = (hostRatings.midfield * 0.6 + ((hostRatings.passing + hostRatings.dribbling) / 2) * 0.4 + hostTechBonus) * hostMomentum;
    const opponentMidfieldStrength = (opponentRatings.midfield * 0.6 + ((opponentRatings.passing + opponentRatings.dribbling) / 2) * 0.4 + opponentTechBonus) * opponentMomentum;

    // Possession ratio
    const totalMidfield = hostMidfieldStrength + opponentMidfieldStrength;
    let segPossession = Math.round((hostMidfieldStrength / (totalMidfield || 1)) * 100);
    segPossession += Math.round(Math.random() * 4 - 2);
    segPossession = Math.max(30, Math.min(70, segPossession));
    hostPossessionSum += segPossession;

    // Tactical setup for late game push
    let hostLateGameMod = 1.0;
    let opponentLateGameMod = 1.0;
    let hostLateDefMod = 1.0;
    let opponentLateDefMod = 1.0;

    if (isLateGame) {
      if (hostScore < opponentScore) {
        hostLateGameMod = 1.4; // Attacking desperation
        hostLateDefMod = 0.75;  // Defense vulnerability
      } else if (opponentScore < hostScore) {
        opponentLateGameMod = 1.4;
        opponentLateDefMod = 0.75;
      }
    }

    // Base chances created per segment (adjusted base for active chance creation)
    const hostChancesBase = (1.0 + (segPossession / 18) + hostPaceBonus) * hostMomentum * hostLateGameMod;
    const opponentChancesBase = (1.0 + ((100 - segPossession) / 18) + opponentPaceBonus) * opponentMomentum * opponentLateGameMod;

    // Defense ratings and identity reduction
    const hostDefStrength = ((hostRatings.defense * 0.7) + (hostRatings.defending * 0.3)) * hostMomentum * hostLateDefMod;
    const opponentDefStrength = ((opponentRatings.defense * 0.7) + (opponentRatings.defending * 0.3)) * opponentMomentum * opponentLateDefMod;

    // Shots taken this segment
    const hostSegShots = Math.max(0, Math.round(hostChancesBase * (80 / (opponentDefStrength || 1)) * opponentDefFactor + Math.random() * 1.2));
    const opponentSegShots = Math.max(0, Math.round(opponentChancesBase * (80 / (hostDefStrength || 1)) * hostDefFactor + Math.random() * 1.2));

    hostShots += hostSegShots;
    opponentShots += opponentSegShots;

    // Conversion rate calculation
    const hostAttStrength = (hostRatings.attack * 0.6) + (hostRatings.shooting * 0.4);
    const opponentAttStrength = (opponentRatings.attack * 0.6) + (opponentRatings.shooting * 0.4);
    
    const hostGkStrength = (hostRatings.goalkeeper * 0.8) + (hostRatings.physical * 0.2);
    const opponentGkStrength = (opponentRatings.goalkeeper * 0.8) + (opponentRatings.physical * 0.2);

    const hostConversion = (0.12 * (hostAttStrength / (opponentGkStrength || 1)) + hostPhysBonus) * hostPhysicalRatio * hostCaptainFactor + Math.random() * 0.03;
    const opponentConversion = (0.12 * (opponentAttStrength / (hostGkStrength || 1)) + opponentPhysBonus) * opponentPhysicalRatio * opponentCaptainFactor + Math.random() * 0.03;

    // Calculate goals in this segment probabilistically per shot to avoid segment rounding down to 0
    let hostSegGoals = 0;
    for (let s = 0; s < hostSegShots; s++) {
      if (Math.random() < hostConversion) {
        hostSegGoals++;
      }
    }

    let opponentSegGoals = 0;
    for (let s = 0; s < opponentSegShots; s++) {
      if (Math.random() < opponentConversion) {
        opponentSegGoals++;
      }
    }

    // Save events
    if (hostSegGoals > 0) {
      for (let g = 0; g < hostSegGoals; g++) {
        const min = startMin + Math.floor(Math.random() * 14) + 1;
        goalEvents.push({ minute: min, team: 'host' });
      }
      hostScore += hostSegGoals;
      // Goal momentum swing
      hostMomentum = Math.min(1.4, hostMomentum + 0.15);
      opponentMomentum = Math.max(0.7, opponentMomentum - 0.10);
    }

    if (opponentSegGoals > 0) {
      for (let g = 0; g < opponentSegGoals; g++) {
        const min = startMin + Math.floor(Math.random() * 14) + 1;
        goalEvents.push({ minute: min, team: 'opponent' });
      }
      opponentScore += opponentSegGoals;
      // Goal momentum swing
      opponentMomentum = Math.min(1.4, opponentMomentum + 0.15);
      hostMomentum = Math.max(0.7, hostMomentum - 0.10);
    }
  }

  // 3. Post-simulation rebalance and stats aggregation
  hostScore = Math.min(6, hostScore);
  opponentScore = Math.min(6, opponentScore);

  const hostPossession = Math.round(hostPossessionSum / 6);
  const opponentPossession = 100 - hostPossession;

  // Rebalanced strength score
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
    const candidates = playersList.filter(p => p.position !== 'GK');
    if (candidates.length === 0) return Array(score).fill("Unknown Scorer");

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

  // Re-map scorers to goals
  const hostRawScorers = getScorers(host.selectedPlayers, hostScore);
  const opponentRawScorers = getScorers(opponent.selectedPlayers, opponentScore);

  const hostScorers = [];
  const opponentScorers = [];
  const events = [];

  // Sort chronological goal events from segment list
  const hostGoalMins = goalEvents.filter(e => e.team === 'host').map(e => e.minute).sort((a,b) => a-b);
  const opponentGoalMins = goalEvents.filter(e => e.team === 'opponent').map(e => e.minute).sort((a,b) => a-b);

  for (let i = 0; i < hostScore; i++) {
    const min = hostGoalMins[i] || (Math.floor(Math.random() * 88) + 1);
    const name = hostRawScorers[i] || "Scorer";
    hostScorers.push({ name, minute: min });
    events.push({ minute: min, team: 'host', scorer: name });
  }

  for (let i = 0; i < opponentScore; i++) {
    const min = opponentGoalMins[i] || (Math.floor(Math.random() * 88) + 1);
    const name = opponentRawScorers[i] || "Scorer";
    opponentScorers.push({ name, minute: min });
    events.push({ minute: min, team: 'opponent', scorer: name });
  }

  hostScorers.sort((a, b) => a.minute - b.minute);
  opponentScorers.sort((a, b) => a.minute - b.minute);

  // MVP selection (Highest rating player on the winning team, or draw)
  const winningTeam = hostScore >= opponentScore ? host : opponent;
  const mvpPlayer = winningTeam.selectedPlayers.sort((a, b) => b.player.overall - a.player.overall)[0];
  const mvp = mvpPlayer ? mvpPlayer.player.name : "N/A";

  // Shots on Target must be >= goals and <= total shots
  const hostShotsOnTarget = hostScore + Math.floor(Math.random() * Math.max(1, (hostShots - hostScore) * 0.45));
  const opponentShotsOnTarget = opponentScore + Math.floor(Math.random() * Math.max(1, (opponentShots - opponentScore) * 0.45));

  // Passes proportional to possession
  const hostPasses = Math.round((hostPossession / 100) * 900 + Math.random() * 60);
  const opponentPasses = Math.round((opponentPossession / 100) * 900 + Math.random() * 60);

  const hostPassAccuracy = Math.round(75 + (hostRatings.midfield - 70) * 0.65 + hostTechBonus * 2 + Math.random() * 4);
  const opponentPassAccuracy = Math.round(75 + (opponentRatings.midfield - 70) * 0.65 + opponentTechBonus * 2 + Math.random() * 4);

  const hostFouls = Math.floor(Math.random() * 8) + 4;
  const opponentFouls = Math.floor(Math.random() * 8) + 4;

  const hostYellowCards = Math.floor(Math.random() * Math.max(1, hostFouls * 0.25));
  const opponentYellowCards = Math.floor(Math.random() * Math.max(1, opponentFouls * 0.25));

  const hostCorners = Math.floor(Math.random() * 6) + 2;
  const opponentCorners = Math.floor(Math.random() * 6) + 2;

  // Saves = shots on target faced minus goals conceded
  const hostSaves = Math.max(0, opponentShotsOnTarget - opponentScore);
  const opponentSaves = Math.max(0, hostShotsOnTarget - hostScore);

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

  const commentary = [];
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
      hostShots,
      opponentShots,
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
