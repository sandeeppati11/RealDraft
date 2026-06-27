const Player = require('../models/Player');

let cachedPlayers = null;

const getPlayersList = async () => {
  if (!cachedPlayers || cachedPlayers.length === 0) {
    cachedPlayers = await Player.find({});
    console.log(`[PlayerCache] Loaded ${cachedPlayers.length} players from database into in-memory cache.`);
  }
  return cachedPlayers;
};

// Major position groups for priority similarity matching
const POSITION_GROUPS = {
  'GK': ['GK'],
  'DEF': ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  'MID': ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  'ATT': ['ST', 'CF', 'LW', 'RW']
};

/**
 * Hidden list of globally recognizable superstars
 */
const FAMOUS_STARS = [
  'messi', 'ronaldo', 'mbappé', 'mbappe', 'haaland', 'neymar', 'salah', 
  'de bruyne', 'modrić', 'modric', 'benzema', 'lewandowski', 'vinícius', 'vinicius',
  'bellingham', 'rodri', 'kane', 'son', 'van dijk', 'courtois', 
  'neuer', 'pedri', 'kimmich', 'griezmann', 'saka', 'foden', 'gundogan', 
  'kroos', 'alaba', 'casemiro', 'marquinhos', 'oblak', 'ter stegen', 
  'donnarumma', 'valverde', 'bernardo silva', 'musiala', 'wirtz', 'buba'
];

/**
 * Global in-memory appearance tracker to ensure variety across rooms.
 * Maps playerId -> number of times offered in the current server session.
 */
const starAppearanceCounts = {};

const getCleanPositionName = (pos) => {
  return pos.replace(/\d+$/, '');
};

const getSimilarPositions = (pos) => {
  const clean = getCleanPositionName(pos);
  for (const group of Object.values(POSITION_GROUPS)) {
    if (group.includes(clean)) return group;
  }
  return [clean];
};

const getMajorGroupKey = (pos) => {
  const clean = getCleanPositionName(pos);
  if (POSITION_GROUPS.DEF.includes(clean)) return 'DEF';
  if (POSITION_GROUPS.MID.includes(clean)) return 'MID';
  if (POSITION_GROUPS.ATT.includes(clean)) return 'ATT';
  return 'GK';
};

/**
 * Determines if a player is considered a globally recognizable Star
 */
const isStarPlayer = (player) => {
  if (player.overall >= 86) return true;
  const nameLower = player.name.toLowerCase();
  return FAMOUS_STARS.some(star => nameLower.includes(star));
};

/**
 * Defines a "Hidden Gem" (lower-rated card under 80 overall with standout world-class stats)
 */
const isHiddenGem = (player) => {
  return player.overall < 80 && (
    player.pace >= 88 || 
    player.dribbling >= 86 || 
    player.physical >= 85 || 
    player.shooting >= 83 || 
    player.passing >= 84 || 
    player.defending >= 83
  );
};

/**
 * Classifies a player's tactical style profile to ensure option diversity
 */
const getPlayerStyle = (player, groupKey) => {
  if (groupKey === 'ATT') {
    if (player.pace >= 84) return 'Pace';
    if (player.physical >= 78) return 'Physical';
    if (player.shooting >= 80) return 'Finisher';
    if (player.dribbling >= 82 || player.passing >= 80) return 'Playmaker';
    return 'Balanced';
  }
  if (groupKey === 'MID') {
    if (player.defending >= 75) return 'Defensive';
    if (player.passing >= 80) return 'Playmaker';
    if (player.physical >= 76) return 'Physical';
    if (player.pace >= 80) return 'Pace';
    return 'Balanced';
  }
  if (groupKey === 'DEF') {
    if (player.pace >= 76) return 'Pace';
    if (player.physical >= 80) return 'Physical';
    if (player.defending >= 80) return 'Defender';
    if (player.passing >= 70 || player.dribbling >= 70) return 'Technical';
    return 'Balanced';
  }
  return 'Balanced';
};

const getRandomSample = (arr, size) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
};

const filterByMemory = (candidates, seenClubs, seenLeagues) => {
  const clean = candidates.filter(p => !seenClubs.has(p.club) && !seenLeagues.has(p.league));
  return clean.length > 0 ? clean : candidates;
};

/**
 * Calculates adaptive star probability dynamically.
 */
const calculateDynamicStarProbability = (roundsSinceStar, remainingStarsCount, currentDraftQuality) => {
  let prob = 0.12;

  if (roundsSinceStar === 2) prob += 0.38;
  if (roundsSinceStar >= 3) prob += 0.88;

  if (roundsSinceStar < 3 && remainingStarsCount < 4) {
    prob *= (remainingStarsCount / 4);
  }

  if (currentDraftQuality < 79.5 && roundsSinceStar >= 2) {
    prob += 0.15;
  }

  return Math.min(1.0, prob);
};

/**
 * Selects a star candidate using global session variety weights (1 / (1 + count))
 */
const selectWeightedStar = (candidates) => {
  if (candidates.length === 0) return null;

  const candidatesWithWeights = candidates.map(p => {
    const count = starAppearanceCounts[p.id] || 0;
    const weight = 1 / (1 + count);
    return { player: p, weight };
  });

  const totalWeight = candidatesWithWeights.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const c of candidatesWithWeights) {
    rand -= c.weight;
    if (rand <= 0) {
      starAppearanceCounts[c.player.id] = (starAppearanceCounts[c.player.id] || 0) + 1;
      return c.player;
    }
  }

  return candidates[0];
};

/**
 * Selects a player for a slot using position priority, style constraints, and draft memory.
 */
const selectPlayerForSlot = (pool, position, tierFilter, context, forceStar = false, seenStyles = new Set()) => {
  const cleanNode = getCleanPositionName(position);
  const groupKey = getMajorGroupKey(cleanNode);

  // Layered priority lookup
  const primary = pool.filter(p => p.position === cleanNode);
  const secondary = pool.filter(p => p.position !== cleanNode && p.secondaryPositions?.includes(cleanNode));
  const similarPos = getSimilarPositions(position);
  const similar = pool.filter(p => p.position !== cleanNode && !p.secondaryPositions?.includes(cleanNode) && similarPos.includes(p.position));
  const fallback = pool;

  const priorityLayers = [primary, secondary, similar, fallback];

  for (const layer of priorityLayers) {
    if (layer.length === 0) continue;

    let matching = layer.filter(tierFilter);
    if (matching.length === 0) continue;

    if (forceStar) {
      const stars = matching.filter(isStarPlayer);
      if (stars.length > 0) {
        const chosenStar = selectWeightedStar(stars);
        if (chosenStar) return chosenStar;
      }
    }

    // Apply Draft Memory Filter
    let stepCandidates = filterByMemory(matching, context.seenClubs, context.seenLeagues);

    // Apply Soft Position Diversity Style Filter (70% intelligence / 30% controlled chaos)
    if (groupKey !== 'GK') {
      const useIntelligentStyle = Math.random() < 0.70; // 70% soft rules, 30% pure randomness

      if (useIntelligentStyle) {
        // Sort candidates prioritizing styles offered less frequently, with small random noise
        stepCandidates.sort((a, b) => {
          const styleA = getPlayerStyle(a, groupKey);
          const styleB = getPlayerStyle(b, groupKey);
          const countA = context.styleCounts[styleA] || 0;
          const countB = context.styleCounts[styleB] || 0;
          const noiseA = Math.random() * 0.6 - 0.3; // noise between -0.3 and 0.3
          const noiseB = Math.random() * 0.6 - 0.3;
          return (countA + noiseA) - (countB + noiseB);
        });

        // Softly avoid duplicate styles in the same 5-card offer
        const diverse = stepCandidates.filter(p => !seenStyles.has(getPlayerStyle(p, groupKey)));
        if (diverse.length > 0) {
          stepCandidates = diverse;
        }
      }
    }

    const selected = getRandomSample(stepCandidates.slice(0, 5), 1)[0]; // Sample from top matching candidates
    if (selected) return selected;
  }

  // Fallback: get any player matching the tier filter
  const tierCandidates = pool.filter(tierFilter);
  if (tierCandidates.length > 0) {
    return getRandomSample(tierCandidates, 1)[0];
  }

  return getRandomSample(pool, 1)[0];
};

/**
 * Generates all 11 rounds of choices for both players in-memory.
 */
const generateSequencedDraft = (allPlayers, room) => {
  const code = room.code;

  // Initialize draft memory, context trackers, and playstyle counters
  const hostContext = {
    roundsSinceStar: 0,
    seenClubs: new Set(),
    seenLeagues: new Set(),
    seenNations: new Set(),
    cumulativeOffersSum: 0,
    count: 0,
    styleCounts: { Pace: 0, Physical: 0, Finisher: 0, Playmaker: 0, Defender: 0, Technical: 0, Defensive: 0 },
    groupQuality: { DEF: { sum: 0, count: 0 }, MID: { sum: 0, count: 0 }, ATT: { sum: 0, count: 0 } }
  };

  const oppContext = {
    roundsSinceStar: 0,
    seenClubs: new Set(),
    seenLeagues: new Set(),
    seenNations: new Set(),
    cumulativeOffersSum: 0,
    count: 0,
    styleCounts: { Pace: 0, Physical: 0, Finisher: 0, Playmaker: 0, Defender: 0, Technical: 0, Defensive: 0 },
    groupQuality: { DEF: { sum: 0, count: 0 }, MID: { sum: 0, count: 0 }, ATT: { sum: 0, count: 0 } }
  };

  const FORMATION_POSITIONS = {
    '433': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM1', 'CM2', 'CAM', 'LW', 'RW', 'ST'],
    '4231': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CDM1', 'CDM2', 'CAM', 'LM', 'RM', 'ST'],
    '442': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'LM', 'CM1', 'CM2', 'RM', 'ST1', 'ST2'],
    '352': ['GK', 'CB1', 'CB2', 'CB3', 'LM', 'CDM1', 'CDM2', 'RM', 'CAM', 'ST1', 'ST2'],
    '532': ['GK', 'LWB', 'CB1', 'CB2', 'CB3', 'RWB', 'CM1', 'CM2', 'CM3', 'ST1', 'ST2'],
    '4141': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CDM', 'LM', 'CM1', 'CM2', 'RM', 'ST'],
    '451': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM', 'LM', 'CAM1', 'CAM2', 'RM', 'ST'],
    '343': ['GK', 'CB1', 'CB2', 'CB3', 'LM', 'CM1', 'CM2', 'RM', 'LW', 'RW', 'ST'],
    '451 Flat': ['GK', 'LB', 'CB1', 'CB2', 'RB', 'LM', 'CM1', 'CM2', 'CM3', 'RM', 'ST']
  };

  const hostSlots = FORMATION_POSITIONS[room.host.formation] || FORMATION_POSITIONS['433'];
  const oppSlots  = FORMATION_POSITIONS[room.opponent.formation] || FORMATION_POSITIONS['433'];

  let pool = [...allPlayers];

  // ── Round 0: Captain Candidate Generation (High Premium) ──
  const hostCapCandidates = pool.filter(p => p.isCaptainCandidate);
  const hostCap = getRandomSample(hostCapCandidates, 5);
  const hostCapIds = hostCap.map(p => p.id);
  pool = pool.filter(p => !hostCapIds.includes(p.id));

  const oppCapCandidates = pool.filter(p => p.isCaptainCandidate);
  const oppCap = getRandomSample(oppCapCandidates, 5);
  const oppCapIds = oppCap.map(p => p.id);
  pool = pool.filter(p => !oppCapIds.includes(p.id));

  const sequence = {
    host: { capOptions: hostCap, slotOptions: new Array(11).fill(null) },
    opponent: { capOptions: oppCap, slotOptions: new Array(11).fill(null) }
  };

  // ── Rounds 1–10: Position Slot Options ──
  for (let roundIdx = 0; roundIdx < 11; roundIdx++) {
    const hostPos = hostSlots[roundIdx];
    const oppPos = oppSlots[roundIdx];

    // Generate Host 5-card offer
    const hostOffer = generateFiveCardComposition(pool, hostPos, hostContext);
    const hostOfferIds = hostOffer.map(p => p.id);
    pool = pool.filter(p => !hostOfferIds.includes(p.id));

    // Generate Opponent 5-card offer
    const oppOffer = generateFiveCardComposition(pool, oppPos, oppContext);
    const oppOfferIds = oppOffer.map(p => p.id);
    pool = pool.filter(p => !oppOfferIds.includes(p.id));

    sequence.host.slotOptions[roundIdx] = hostOffer;
    sequence.opponent.slotOptions[roundIdx] = oppOffer;
  }

  return sequence;
};

/**
 * Builds a balanced 5-card composition using templates, memory, and diversity.
 */
function generateFiveCardComposition(pool, position, context) {
  const offer = [];
  let tempPool = [...pool];

  const cleanNode = getCleanPositionName(position);
  const groupKey = getMajorGroupKey(cleanNode);

  // Dynamic Star Probability Calculation
  const remainingStars = tempPool.filter(isStarPlayer).length;
  const currentAvg = context.count > 0 ? context.cumulativeOffersSum / context.count : 80;
  const starProb = calculateDynamicStarProbability(context.roundsSinceStar, remainingStars, currentAvg);

  let forceStar = Math.random() < starProb;
  let starEnqueued = false;

  // Rating Tiers
  const isElite = p => p.overall >= 87;
  const isWorldClass = p => p.overall >= 84 && p.overall < 87;
  const isExcellent = p => p.overall >= 80 && p.overall < 84;
  const isGood = p => p.overall >= 75 && p.overall < 80;
  const isAverage = p => p.overall < 75;

  // Card Slot Templates
  const templates = [
    // Template A (Standard Balanced - 1 Premium, 2 Strong, 2 Balanced)
    [
      { name: 'Premium', filter: p => isElite(p) || isWorldClass(p), forceStar: forceStar },
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Balanced', filter: isGood, forceStar: false },
      { name: 'Balanced', filter: p => isGood(p) || isAverage(p), forceStar: false }
    ],
    // Template B (Rare Double Premium - 2 Premium, 1 Strong, 1 Balanced, 1 Average)
    [
      { name: 'Premium', filter: p => isElite(p) || isWorldClass(p), forceStar: forceStar },
      { name: 'Premium', filter: p => isElite(p) || isWorldClass(p), forceStar: false },
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Balanced', filter: isGood, forceStar: false },
      { name: 'Average', filter: isAverage, forceStar: false }
    ],
    // Template C (No Premium - Tactical Strong Round)
    [
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Balanced', filter: isGood, forceStar: false },
      { name: 'Balanced', filter: p => isGood(p) || isAverage(p), forceStar: false }
    ],
    // Template D (Superstar & Hidden Gem - 1 Premium, 1 Strong, 2 Balanced, 1 Hidden Gem)
    [
      { name: 'Premium', filter: p => isElite(p) || isWorldClass(p), forceStar: forceStar },
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Balanced', filter: isGood, forceStar: false },
      { name: 'Balanced', filter: isGood, forceStar: false },
      { name: 'HiddenGem', filter: isHiddenGem, forceStar: false }
    ],
    // Template E (Pure Tactical No Premium - 2 Strong, 2 Balanced, 1 Hidden Gem)
    [
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Strong', filter: isExcellent, forceStar: false },
      { name: 'Balanced', filter: isGood, forceStar: false },
      { name: 'Balanced', filter: p => isGood(p) || isAverage(p), forceStar: false },
      { name: 'HiddenGem', filter: isHiddenGem, forceStar: false }
    ]
  ];

  // Pick a random template
  const templateIdx = Math.floor(Math.random() * templates.length);
  const selectedTemplate = [...templates[templateIdx]];

  // ── Context-Aware Defensive/Attacking Quality Adjustment ──
  // If the average quality of options generated for this major group key is low (e.g. < 79),
  // we subtly lift the balanced slot filters (65% chance) to ensure they get interesting tactical choices.
  const groupStats = context.groupQuality[groupKey];
  const groupAvg = groupStats?.count > 0 ? groupStats.sum / groupStats.count : 80;
  
  if (groupKey !== 'GK' && groupAvg < 79.0 && Math.random() < 0.65) {
    const upgradableIdx = selectedTemplate.findIndex(s => s.name === 'Balanced' || s.name === 'Average');
    if (upgradableIdx !== -1) {
      // Upgrade Balanced to Excellent to ensure solid options in a weak department
      selectedTemplate[upgradableIdx] = { name: 'Strong', filter: isExcellent, forceStar: false };
    }
  }

  const seenStyles = new Set();

  for (const slot of selectedTemplate) {
    const selected = selectPlayerForSlot(tempPool, position, slot.filter, context, slot.forceStar && !starEnqueued, seenStyles);
    
    if (selected) {
      offer.push(selected);
      tempPool = tempPool.filter(p => p.id !== selected.id);

      // Track style and update counts
      if (groupKey !== 'GK') {
        const style = getPlayerStyle(selected, groupKey);
        seenStyles.add(style);
        context.styleCounts[style] = (context.styleCounts[style] || 0) + 1;
      }
      
      // Track star appearance
      if (isStarPlayer(selected)) {
        starEnqueued = true;
        context.roundsSinceStar = 0;
      }
    }
  }

  // Fallback: fill up to 5 cards if needed
  if (offer.length < 5) {
    const needed = 5 - offer.length;
    const fallbacks = getRandomSample(tempPool, needed);
    offer.push(...fallbacks);
  }

  // Update offer average metrics
  const offerAvgOverall = offer.reduce((sum, p) => sum + p.overall, 0) / 5;
  context.cumulativeOffersSum += offerAvgOverall;
  context.count++;

  // Update group quality tracking
  if (groupKey !== 'GK') {
    context.groupQuality[groupKey].sum += offerAvgOverall;
    context.groupQuality[groupKey].count++;
  }

  // Add to memory
  offer.forEach(p => {
    context.seenClubs.add(p.club);
    context.seenLeagues.add(p.league);
    context.seenNations.add(p.nation);
  });

  // Limit memory growth
  if (context.seenClubs.size > 20) {
    const arr = Array.from(context.seenClubs);
    context.seenClubs = new Set(arr.slice(arr.length - 15));
  }
  if (context.seenLeagues.size > 8) {
    const arr = Array.from(context.seenLeagues);
    context.seenLeagues = new Set(arr.slice(arr.length - 5));
  }

  return offer;
}

const getDraftOptions = async (availableIds, position, isCaptainRound = false) => {
  const players = await getPlayersList();
  if (isCaptainRound) {
    const candidates = players.filter(p => availableIds.includes(p.id) && p.isCaptainCandidate);
    return getRandomSample(candidates, 5);
  }

  const allAvailable = players.filter(p => availableIds.includes(p.id));
  const mockContext = {
    roundsSinceStar: 0,
    seenClubs: new Set(),
    seenLeagues: new Set(),
    seenNations: new Set(),
    cumulativeOffersSum: 0,
    count: 0,
    styleCounts: { Pace: 0, Physical: 0, Finisher: 0, Playmaker: 0, Defender: 0, Technical: 0, Defensive: 0 },
    groupQuality: { DEF: { sum: 0, count: 0 }, MID: { sum: 0, count: 0 }, ATT: { sum: 0, count: 0 } }
  };

  return generateFiveCardComposition(allAvailable, position, mockContext);
};

module.exports = {
  getDraftOptions,
  generateSequencedDraft,
  getPlayersList
};
