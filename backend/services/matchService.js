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
 * Calculates ratings and strength metrics for a drafted team.
 * @param {Array<object>} selectedPlayers - List of { position, player } selected.
 * @returns {object} - Object containing ratings.
 */
const calculateTeamRatings = (selectedPlayers) => {
  if (!selectedPlayers || selectedPlayers.length === 0) {
    return { overall: 0, attack: 0, midfield: 0, defense: 0, draftScore: 0, formationBalance: 0, captainBonus: 0 };
  }

  let totalOverall = 0;
  let totalDraftScore = 0;
  
  let attSum = 0, attCount = 0;
  let midSum = 0, midCount = 0;
  let defSum = 0, defCount = 0;
  
  let matchingPositions = 0;
  let captainBonus = 0;

  selectedPlayers.forEach(({ position: nodePosition, player }) => {
    if (!player) return;
    totalOverall += (player.overall || 70);
    totalDraftScore += (player.draftScore || 70);
    
    // Group ratings: calculate using actual assigned pitch position (cleanNode) instead of default player.position
    const cleanNode = (nodePosition || '').replace(/\d+$/, '');
    const group = getMajorGroup(cleanNode || player.position || '');
    if (group === 'ATT') {
      attSum += (player.overall || 70);
      attCount++;
    } else if (group === 'MID') {
      midSum += (player.overall || 70);
      midCount++;
    } else if (group === 'DEF' || group === 'GK') {
      defSum += (player.overall || 70);
      defCount++;
    }
    
    // Formation balance: check if player matches the node position or is playing in their secondary
    if (cleanNode) {
      if (player.position === cleanNode) {
        matchingPositions += 1.0;
      } else if (player.secondaryPositions && player.secondaryPositions.includes(cleanNode)) {
        matchingPositions += 0.5;
      }
    }

    // Captain bonus: check if player overall >= 88 and is flagged as captain
    if (player.isCaptainCandidate && (player.overall || 0) >= 88) {
      captainBonus = 3;
    }
  });

  const count = selectedPlayers.length;
  
  return {
    overall: Math.round(totalOverall / count),
    attack: attCount > 0 ? Math.round(attSum / attCount) : 70,
    midfield: midCount > 0 ? Math.round(midSum / midCount) : 70,
    defense: defCount > 0 ? Math.round(defSum / defCount) : 70,
    draftScore: Math.round(totalDraftScore / count),
    formationBalance: Math.round((matchingPositions / count) * 10), // Scale to 0-10
    captainBonus
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
  
  // Calculate Strengths
  // Formula: Overall * 0.5 + DraftScore * 0.3 + FormationBalance * 0.1 + CaptainBonus + RandomFactor
  const hostRandom = 5 + Math.random() * 5; // 5-10 random factor
  const opponentRandom = 5 + Math.random() * 5;
  
  const hostStrength = hostRatings.overall * 0.5 + 
                       hostRatings.draftScore * 0.3 + 
                       hostRatings.formationBalance * 0.1 + 
                       hostRatings.captainBonus + 
                       hostRandom;
                       
  const opponentStrength = opponentRatings.overall * 0.5 + 
                           opponentRatings.draftScore * 0.3 + 
                           opponentRatings.formationBalance * 0.1 + 
                           opponentRatings.captainBonus + 
                           opponentRandom;

  // Determine scores probabilistically
  // Base goals around team overall rating
  const baseHostGoals = Math.max(0, Math.floor((hostRatings.attack - 70) / 7 + Math.random() * 2));
  const baseOpponentGoals = Math.max(0, Math.floor((opponentRatings.attack - 70) / 7 + Math.random() * 2));
  
  let hostScore = baseHostGoals;
  let opponentScore = baseOpponentGoals;
  
  // Adjust scores according to strength difference
  const strengthDiff = hostStrength - opponentStrength;
  if (strengthDiff > 5) {
    hostScore += 1;
    opponentScore = Math.max(0, opponentScore - 1);
  } else if (strengthDiff > 12) {
    hostScore += 2;
    opponentScore = Math.max(0, opponentScore - 1);
  } else if (strengthDiff < -5) {
    opponentScore += 1;
    hostScore = Math.max(0, hostScore - 1);
  } else if (strengthDiff < -12) {
    opponentScore += 2;
    hostScore = Math.max(0, hostScore - 1);
  }

  // Final safety checks: limit goal count to 6 for realism
  hostScore = Math.min(6, hostScore);
  opponentScore = Math.min(6, opponentScore);

  // Determine scorers
  const getScorers = (playersList, score) => {
    if (score === 0) return [];
    
    // Filter out players assigned to the GK pitch node
    const candidates = playersList.filter(p => p.position !== 'GK');
    if (candidates.length === 0) return Array(score).fill("Unknown Scorer");

    // Assign probability weights based on Shooting stat
    const scorers = [];
    for (let i = 0; i < score; i++) {
      // Shuffled selection weighted by shooting rating
      const totalWeight = candidates.reduce((sum, p) => sum + p.player.shooting, 0);
      let rand = Math.random() * totalWeight;
      let selected = candidates[0].player.name;
      
      for (const p of candidates) {
        rand -= p.player.shooting;
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

  // MVP selection (Highest draftScore player on the winning team, or random from top 3)
  const winningTeam = hostScore >= opponentScore ? host : opponent;
  const mvpPlayer = winningTeam.selectedPlayers.sort((a, b) => b.player.overall - a.player.overall)[0];
  const mvp = mvpPlayer ? mvpPlayer.player.name : "N/A";

  // Simulate Stats
  const totalStrength = hostStrength + opponentStrength;
  const hostPossession = Math.round((hostStrength / totalStrength) * 100) + Math.round((Math.random() * 6 - 3));
  const opponentPossession = 100 - hostPossession;
  
  const hostShots = Math.max(hostScore, Math.round((hostRatings.midfield / 10) + Math.random() * 8 + (hostScore * 2)));
  const opponentShots = Math.max(opponentScore, Math.round((opponentRatings.midfield / 10) + Math.random() * 8 + (opponentScore * 2)));

  // Shots on Target must be >= goals and <= total shots
  const hostShotsOnTarget = hostScore + Math.floor(Math.random() * Math.max(1, (hostShots - hostScore) * 0.6));
  const opponentShotsOnTarget = opponentScore + Math.floor(Math.random() * Math.max(1, (opponentShots - opponentScore) * 0.6));

  // Passes proportional to possession
  const hostPasses = Math.round((hostPossession / 100) * 900 + Math.random() * 80);
  const opponentPasses = Math.round((opponentPossession / 100) * 900 + Math.random() * 80);

  const hostPassAccuracy = Math.round(75 + (hostRatings.midfield - 70) * 0.6 + Math.random() * 6);
  const opponentPassAccuracy = Math.round(75 + (opponentRatings.midfield - 70) * 0.6 + Math.random() * 6);

  const hostFouls = Math.floor(Math.random() * 9) + 4;
  const opponentFouls = Math.floor(Math.random() * 9) + 4;

  const hostYellowCards = Math.floor(Math.random() * Math.max(1, hostFouls * 0.3));
  const opponentYellowCards = Math.floor(Math.random() * Math.max(1, opponentFouls * 0.3));

  const hostCorners = Math.floor(Math.random() * 7) + 2;
  const opponentCorners = Math.floor(Math.random() * 7) + 2;

  // Saves = opponent's shots on target minus opponent's goals
  const hostSaves = Math.max(0, opponentShotsOnTarget - opponentScore);
  const opponentSaves = Math.max(0, hostShotsOnTarget - hostScore);

  // Generate Match Highlights (Commentary) and attach goal minutes
  const commentary = [];
  const events = [];
  const hostScorers = [];
  const opponentScorers = [];
  
  // Allocate goals to minute marks
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

  // Sort scorer lists chronologically for display
  hostScorers.sort((a, b) => a.minute - b.minute);
  opponentScorers.sort((a, b) => a.minute - b.minute);
  
  // Add some random highlight moments
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
