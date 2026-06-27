const Room = require('../models/Room');
const Player = require('../models/Player');
const { getDraftOptions, generateSequencedDraft, getPlayersList } = require('../services/draftService');

// Maps formation names to 11 positional nodes
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

const activeTimers = {};      // Maps roomCode -> setTimeout instance
const disconnectTimeouts = {}; // Maps roomCode -> setTimeout instance
const roomLocks = {};          // Maps roomCode -> Promise chain for sequential updates

// Helper to execute database operations sequentially per room to prevent Mongoose VersionErrors
function executeQueue(roomCode, taskFn) {
  if (!roomLocks[roomCode]) {
    roomLocks[roomCode] = Promise.resolve();
  }
  roomLocks[roomCode] = roomLocks[roomCode]
    .then(async () => {
      try {
        await taskFn();
      } catch (err) {
        console.error(`[Queue Task Error] Room ${roomCode}:`, err.message);
      }
    })
    .catch((err) => {
      console.error(`[Queue Chain Error] Room ${roomCode}:`, err.message);
    });
}

/**
 * In-memory draft sequence cache.
 * Key: roomCode
 * Value: {
 *   host:     { capOptions: [...], slotOptions: [Array(11)] },
 *   opponent: { capOptions: [...], slotOptions: [Array(11)] }
 * }
 * 
 * Generated once after formations are locked, reused for all 11 draft rounds.
 * slotOptions[i] corresponds to FORMATION_POSITIONS[formation][i].
 */
const draftSequences = {};

// ─────────────────────────────────────────────
// Formation / Slot Helpers
// ─────────────────────────────────────────────

const getCleanPositionName = (nodeName) => {
  return nodeName.replace(/\d+$/, ''); // CB1 -> CB
};

const findBestCaptainSlot = (formation, playerPosition, secondaryPositions = [], filledSlots = []) => {
  const slots = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['433'];
  
  // If player is a GK, force them into the GK slot
  if (playerPosition === 'GK') {
    const gkIdx = slots.findIndex(s => getCleanPositionName(s) === 'GK');
    if (gkIdx !== -1) return gkIdx;
  }

  // 1. Search for primary position match (excluding GK)
  let idx = slots.findIndex(s => getCleanPositionName(s) === playerPosition && getCleanPositionName(s) !== 'GK' && !filledSlots.includes(s));
  if (idx !== -1) return idx;

  // 2. Search secondary positions (excluding GK)
  for (const secPos of secondaryPositions) {
    if (secPos === 'GK') continue;
    idx = slots.findIndex(s => getCleanPositionName(s) === secPos && !filledSlots.includes(s));
    if (idx !== -1) return idx;
  }

  // 3. Search for a similar position group (excluding GK)
  const getGroup = (pos) => {
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
    if (['ST', 'CF', 'LW', 'RW'].includes(pos)) return 'ATT';
    return 'GK';
  };
  const captainGroup = getGroup(playerPosition);
  idx = slots.findIndex(s => getCleanPositionName(s) !== 'GK' && getGroup(getCleanPositionName(s)) === captainGroup && !filledSlots.includes(s));
  if (idx !== -1) return idx;

  // 4. Fallback to any free slot that is NOT 'GK'
  idx = slots.findIndex(s => getCleanPositionName(s) !== 'GK' && !filledSlots.includes(s));
  return idx !== -1 ? idx : 1; // Fallback to index 1 (usually first defender slot) if all else is full
};

/**
 * Returns all formation slots except the one taken by the captain.
 */
const getRemainingSlots = (formation, captainSlotIdx) => {
  const slots = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['433'];
  return slots.filter((_, i) => i !== captainSlotIdx);
};

/**
 * Returns the index of the captain's formation slot from a member's selectedPlayers.
 * Returns -1 if no captain entry found yet.
 */
const getCaptainSlotIdx = (member) => {
  const entry = member.selectedPlayers.find(p => p.isCaptain);
  if (!entry) return -1;
  const slots = FORMATION_POSITIONS[member.formation] || FORMATION_POSITIONS['433'];
  return slots.indexOf(entry.position);
};

// ─────────────────────────────────────────────
// Full Draft Sequence Pre-generation
// ─────────────────────────────────────────────

/**
 * Pre-generates ALL 11 rounds of draft options for both players immediately after
 * formations are locked. Stored in draftSequences[code] for instant access during the draft.
 *
 * Generation uses a simulated pool-depletion pass: after each slot's options are generated,
 * those player IDs are excluded from subsequent slots. This gives realistic positional spread.
 *
 * At serve-time, options are validated against the actual available pool and fall back to
 * dynamic generation if too many players have been invalidated by actual picks.
 */
const preGenerateFullDraftSequence = async (room) => {
  const code = room.code;
  try {
    const players = await getPlayersList();
    const allPlayers = players.filter(p => room.availablePlayers.includes(p.id));
    const sequence = generateSequencedDraft(allPlayers, room);
    draftSequences[code] = sequence;
    console.log(`[Sequence] Advanced sequence generated successfully for room ${code}`);
  } catch (err) {
    console.error(`[Sequence] Failed to generate sequence for room ${code}: ${err.message}`);
  }
};

/**
 * Retrieves pre-generated options from the sequence cache for a specific formation slot.
 * Returns null if the sequence isn't ready or the slot is out of range.
 * 
 * @param {string}  code       - Room code
 * @param {boolean} isHost     - true for host, false for opponent
 * @param {number}  slotIdx    - Index in FORMATION_POSITIONS[formation] (-1 for captain round)
 */
const getRawSequenceOptions = (code, isHost, slotIdx) => {
  const seq = draftSequences[code];
  if (!seq) return null;
  const memberSeq = isHost ? seq.host : seq.opponent;
  if (slotIdx === -1) return memberSeq.capOptions;
  return memberSeq.slotOptions[slotIdx] || null;
};

/**
 * Returns validated sequence options, falling back to dynamic generation if stale.
 * "Stale" means fewer than 3 of the 5 pre-generated players are still in the available pool.
 */
const getValidatedOptions = async (code, isHost, slotIdx, position, availablePlayers, isCaptainRound) => {
  const preGen = getRawSequenceOptions(code, isHost, slotIdx);

  if (preGen && preGen.length > 0) {
    const valid = preGen.filter(p => availablePlayers.includes(p.id));
    if (valid.length >= 3) {
      return valid; // Sequence still fresh enough → instant serve
    }
  }

  // Fallback: dynamic generation (sequence not ready or too stale)
  return await getDraftOptions(availablePlayers, position, isCaptainRound);
};

/**
 * Reads sequence options for a specific round (N) and wraps validation.
 * Computes the formation slot index from captainSlotIdx + roundIndex.
 */
const getOptionsForRound = async (code, isHost, roundIdx, formation, captainSlotIdx, availablePlayers) => {
  const slots = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['433'];

  if (roundIdx === 0) {
    // Captain round — slotIdx is -1 (special marker)
    return await getValidatedOptions(code, isHost, -1, 'CAP', availablePlayers, true);
  }

  const remainingSlots = getRemainingSlots(formation, captainSlotIdx);
  const slotName = remainingSlots[roundIdx - 1];
  if (!slotName) return [];

  const slotIdx  = slots.indexOf(slotName);
  const position = getCleanPositionName(slotName);
  return await getValidatedOptions(code, isHost, slotIdx, position, availablePlayers, false);
};

/**
 * Builds prefetchOptions containing the next TWO rounds of options for image warming.
 * r1 = one round after nextRoundIdx (already being shown, but images may need warming)
 * r2 = two rounds after nextRoundIdx
 *
 * Reads directly from the sequence cache (no DB calls) — fire and forget if cache is empty.
 */
const buildPrefetchOptions = (code, nextRoundIdx, room) => {
  const prefetch = { r1: { host: [], opponent: [] }, r2: { host: [], opponent: [] } };

  // r1: the round AFTER what's currently being shown (nextRoundIdx + 1)
  const r1Idx = nextRoundIdx + 1;
  if (r1Idx < 11) {
    const hostCaptainIdx = getCaptainSlotIdx(room.host);
    const oppCaptainIdx  = getCaptainSlotIdx(room.opponent);

    const hostR1Slots = getRemainingSlots(room.host.formation, hostCaptainIdx);
    const oppR1Slots  = getRemainingSlots(room.opponent.formation, oppCaptainIdx);

    const hostR1SlotName = hostR1Slots[r1Idx - 1];
    const oppR1SlotName  = oppR1Slots[r1Idx - 1];

    if (hostR1SlotName && oppR1SlotName) {
      const hostSlots = FORMATION_POSITIONS[room.host.formation] || FORMATION_POSITIONS['433'];
      const oppSlots  = FORMATION_POSITIONS[room.opponent.formation] || FORMATION_POSITIONS['433'];
      prefetch.r1.host     = getRawSequenceOptions(code, true,  hostSlots.indexOf(hostR1SlotName)) || [];
      prefetch.r1.opponent = getRawSequenceOptions(code, false, oppSlots.indexOf(oppR1SlotName))   || [];
    }
  }

  // r2: the round after r1
  const r2Idx = nextRoundIdx + 2;
  if (r2Idx < 11) {
    const hostCaptainIdx = getCaptainSlotIdx(room.host);
    const oppCaptainIdx  = getCaptainSlotIdx(room.opponent);

    const hostR2Slots = getRemainingSlots(room.host.formation, hostCaptainIdx);
    const oppR2Slots  = getRemainingSlots(room.opponent.formation, oppCaptainIdx);

    const hostR2SlotName = hostR2Slots[r2Idx - 1];
    const oppR2SlotName  = oppR2Slots[r2Idx - 1];

    if (hostR2SlotName && oppR2SlotName) {
      const hostSlots = FORMATION_POSITIONS[room.host.formation] || FORMATION_POSITIONS['433'];
      const oppSlots  = FORMATION_POSITIONS[room.opponent.formation] || FORMATION_POSITIONS['433'];
      prefetch.r2.host     = getRawSequenceOptions(code, true,  hostSlots.indexOf(hostR2SlotName)) || [];
      prefetch.r2.opponent = getRawSequenceOptions(code, false, oppSlots.indexOf(oppR2SlotName))   || [];
    }
  }

  return prefetch;
};

/**
 * Builds prefetchOptions for the captain round (round 0).
 * r1 = first remaining slot for each player (can't know captain slot yet, uses slot 1 estimate)
 * r2 = second remaining slot estimate
 */
const buildCaptainRoundPrefetch = (code, room) => {
  const prefetch = { r1: { host: [], opponent: [] }, r2: { host: [], opponent: [] } };

  // r1: slot index 1 in each formation (since slot 0 might be taken by captain)
  const hostSlot1 = FORMATION_POSITIONS[room.host.formation]?.[1];
  const oppSlot1  = FORMATION_POSITIONS[room.opponent.formation]?.[1];
  if (hostSlot1) prefetch.r1.host     = getRawSequenceOptions(code, true,  1) || [];
  if (oppSlot1)  prefetch.r1.opponent = getRawSequenceOptions(code, false, 1) || [];

  // r2: slot index 2
  const hostSlot2 = FORMATION_POSITIONS[room.host.formation]?.[2];
  const oppSlot2  = FORMATION_POSITIONS[room.opponent.formation]?.[2];
  if (hostSlot2) prefetch.r2.host     = getRawSequenceOptions(code, true,  2) || [];
  if (oppSlot2)  prefetch.r2.opponent = getRawSequenceOptions(code, false, 2) || [];

  return prefetch;
};

// ─────────────────────────────────────────────
// Socket Handler
// ─────────────────────────────────────────────

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join Room Event
    socket.on('join-room', async ({ roomCode, playerName }) => {
      const code = roomCode.toUpperCase();
      executeQueue(code, async () => {
        const room = await Room.findOne({ code });
        if (!room) {
          socket.emit('error-msg', 'Room not found');
          return;
        }

        socket.join(code);
        socket.roomCode = code;
        socket.playerName = playerName;

        if (room.host && room.host.name === playerName) {
          room.host.socketId = socket.id;
        } else if (room.opponent && room.opponent.name === playerName) {
          room.opponent.socketId = socket.id;
        } else {
          socket.emit('error-msg', 'Unauthorized to join this room');
          return;
        }

        if (disconnectTimeouts[code]) {
          clearTimeout(disconnectTimeouts[code]);
          delete disconnectTimeouts[code];
          console.log(`Cancelled disconnect timeout for room ${code}`);
        }

        await room.save();
        io.to(code).emit('room-state', room);
      });
    });

    // Formation Selected Event
    socket.on('formation-selected', async ({ formation }) => {
      const code = socket.roomCode;
      if (!code) return;

      executeQueue(code, async () => {
        const room = await Room.findOne({ code });
        if (!room) return;

        if (room.host.name === socket.playerName) {
          room.host.formation = formation;
          room.host.ready = true;
        } else if (room.opponent && room.opponent.name === socket.playerName) {
          room.opponent.formation = formation;
          room.opponent.ready = true;
        }

        if (room.host.ready && room.opponent && room.opponent.ready) {
          room.status = 'drafting';
          room.currentPositionIndex = 0;

          // Generate captain options (round 0) immediately
          const hostCapOptions = await getDraftOptions(room.availablePlayers, 'CAP', true);
          const hostOptionIds   = hostCapOptions.map(p => p.id);
          const tempAvailable   = room.availablePlayers.filter(id => !hostOptionIds.includes(id));
          const oppCapOptions   = await getDraftOptions(tempAvailable, 'CAP', true);

          room.hostOptions     = hostCapOptions;
          room.opponentOptions = oppCapOptions;
          room.endsAt          = Date.now() + 30000;

          // ── Pre-generate the full draft sequence in the background (non-blocking) ──
          // This runs asynchronously while round 0 is being played.
          // By the time round 1 starts (~30s), the full sequence is ready.
          preGenerateFullDraftSequence(room).catch(err =>
            console.error(`[Sequence] Pre-generation failed for room ${code}:`, err.message)
          );
        }

        await room.save();

        if (room.status === 'drafting') {
          // Emit captain round state with speculative r1/r2 prefetch from sequence cache
          // (May be empty on first call since sequence is still generating — that's OK)
          const prefetchOptions = buildCaptainRoundPrefetch(code, room);
          io.to(code).emit('room-state', { ...room.toObject(), prefetchOptions });
          startDraftTimer(io, code);
        } else {
          io.to(code).emit('room-state', room);
        }
      });
    });

    // Player Picked Event
    socket.on('player-picked', async ({ playerId }) => {
      const code = socket.roomCode;
      if (!code) return;

      executeQueue(code, async () => {
        const room = await Room.findOne({ code });
        if (!room) return;

        const isHost  = room.host.name === socket.playerName;
        const member  = isHost ? room.host : room.opponent;
        const options = isHost ? room.hostOptions : room.opponentOptions;

        const selectedPlayer = options.find(p => p.id === parseInt(playerId));
        if (!selectedPlayer) {
          socket.emit('error-msg', 'Invalid player selection');
          return;
        }

        const expectedCount = room.currentPositionIndex + 1;
        if (member.selectedPlayers.length >= expectedCount) return;

        // ── Determine formation slot ──
        const isCaptainPick = room.currentPositionIndex === 0;
        let activeNode;

        if (isCaptainPick) {
          const captainSlotIdx = findBestCaptainSlot(
            member.formation,
            selectedPlayer.position,
            selectedPlayer.secondaryPositions || [],
            []
          );
          activeNode = (FORMATION_POSITIONS[member.formation] || FORMATION_POSITIONS['433'])[captainSlotIdx];
        } else {
          const captainSlotIdx = getCaptainSlotIdx(member);
          const remaining = getRemainingSlots(member.formation, captainSlotIdx);
          activeNode = remaining[room.currentPositionIndex - 1];
        }

        member.selectedPlayers.push({ position: activeNode, player: selectedPlayer, isCaptain: isCaptainPick });
        room.draftedPlayers.push(selectedPlayer.id);
        room.availablePlayers = room.availablePlayers.filter(id => id !== selectedPlayer.id);

        await room.save();

        // ── AI Opponent auto-draft logic ──
        if (room.isAi) {
          if (room.opponent.selectedPlayers.length < expectedCount) {
            const isCapPick = room.currentPositionIndex === 0;
            let bestPick = null;
            let bestScore = -1;
            let bestNode = null;

            for (const p of room.opponentOptions) {
              let nodeName;
              if (isCapPick) {
                const captainSlotIdx = findBestCaptainSlot(
                  room.opponent.formation, p.position, p.secondaryPositions || [], []
                );
                nodeName = (FORMATION_POSITIONS[room.opponent.formation] || FORMATION_POSITIONS['433'])[captainSlotIdx];
              } else {
                const captainIdx = getCaptainSlotIdx(room.opponent);
                const remaining  = getRemainingSlots(room.opponent.formation, captainIdx);
                nodeName = remaining[room.currentPositionIndex - 1];
              }

              // Calculate smart selection weight
              let score = p.overall * 1.5 + p.draftScore * 0.5;
              const cleanNode = nodeName.replace(/\d+$/, '');
              if (p.position === cleanNode) {
                score += 40;
              } else if (p.secondaryPositions && p.secondaryPositions.includes(cleanNode)) {
                score += 15;
              }
              if (isCapPick && p.isCaptainCandidate && p.overall >= 88) {
                score += 50;
              }

              if (score > bestScore) {
                bestScore = score;
                bestPick = p;
                bestNode = nodeName;
              }
            }

            if (bestPick) {
              room.opponent.selectedPlayers.push({ position: bestNode, player: bestPick, isCaptain: isCapPick });
              room.draftedPlayers.push(bestPick.id);
              room.availablePlayers = room.availablePlayers.filter(id => id !== bestPick.id);
              await room.save();
            }
          }
        }

        const hostCompletedRound     = room.host.selectedPlayers.length === expectedCount;
        const opponentCompletedRound = room.opponent.selectedPlayers.length === expectedCount;

        if (hostCompletedRound && opponentCompletedRound) {
          clearTimeout(activeTimers[code]);
          delete activeTimers[code];

          room.currentPositionIndex += 1;

          if (room.currentPositionIndex >= 11) {
            room.status = 'simulation';
            room.host.completed = true;
            room.opponent.completed = true;
            room.hostOptions = [];
            room.opponentOptions = [];

            await room.save();
            // Clean up sequence from memory
            delete draftSequences[code];
            io.to(code).emit('room-state', room);
          } else {
            // ── Serve next round options ──
            // Try sequence first (validated), fall back to dynamic generation
            const hostCaptainIdx = getCaptainSlotIdx(room.host);
            const oppCaptainIdx  = getCaptainSlotIdx(room.opponent);

            const nextHostOptions = await getOptionsForRound(
              code, true, room.currentPositionIndex,
              room.host.formation, hostCaptainIdx, room.availablePlayers
            );

            // Exclude host options from opponent pool to prevent cross-duplicates
            const hostOptIds = nextHostOptions.map(p => p.id);
            const tempPool   = room.availablePlayers.filter(id => !hostOptIds.includes(id));

            const nextOppOptions = await getOptionsForRound(
              code, false, room.currentPositionIndex,
              room.opponent.formation, oppCaptainIdx, tempPool
            );

            room.hostOptions     = nextHostOptions;
            room.opponentOptions = nextOppOptions;
            room.endsAt          = Date.now() + 30000;

            await room.save();

            // ── Rolling two-round prefetch ──
            // r1 = round after what's being shown, r2 = round after r1
            // Read directly from sequence (in-memory, instant, no DB call)
            const prefetchOptions = buildPrefetchOptions(code, room.currentPositionIndex, room);

            io.to(code).emit('room-state', { ...room.toObject(), prefetchOptions });
            startDraftTimer(io, code);
          }
        } else {
          // Only one player picked — partial state update
          io.to(code).emit('room-state', room);
        }
      });
    });

    // Disconnect Event
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const code = socket.roomCode;
      if (!code) return;

      executeQueue(code, async () => {
        const room = await Room.findOne({ code });
        if (!room) return;

        if (room.host && room.host.socketId === socket.id) {
          room.host.socketId = null;
        } else if (room.opponent && room.opponent.socketId === socket.id) {
          room.opponent.socketId = null;
        }
        await room.save();

        io.to(code).emit('player-disconnected', { playerName: socket.playerName });
        io.to(code).emit('room-state', room);

        if (room.status === 'waiting' || room.status === 'finished') {
          if (room.status === 'waiting') {
            await Room.deleteOne({ code });
            delete draftSequences[code]; // clean up
            console.log(`Room ${code} deleted immediately as host disconnected`);
          }
          return;
        }

        if (!disconnectTimeouts[code]) {
          disconnectTimeouts[code] = setTimeout(async () => {
            console.log(`Reconnection timeout expired for room ${code}. Deleting room.`);
            clearTimeout(activeTimers[code]);
            delete activeTimers[code];
            delete draftSequences[code]; // clean up sequence from memory

            await Room.deleteOne({ code });
            io.to(code).emit('room-destroyed', 'Opponent failed to reconnect within 30 seconds.');
            delete disconnectTimeouts[code];
          }, 30000);
        }
      });
    });
  });
};

// ─────────────────────────────────────────────
// Draft Timer (auto-pick on timeout)
// ─────────────────────────────────────────────

function startDraftTimer(io, roomCode) {
  clearTimeout(activeTimers[roomCode]);

  activeTimers[roomCode] = setTimeout(async () => {
    delete activeTimers[roomCode];

    executeQueue(roomCode, async () => {
      const room = await Room.findOne({ code: roomCode });
      if (!room || room.status !== 'drafting') return;

      const roundIndex    = room.currentPositionIndex;
      const expectedCount = roundIndex + 1;
      let hostUpdated     = false;
      let opponentUpdated = false;

      // ── Auto-pick for host ──
      if (room.host.selectedPlayers.length < expectedCount) {
        const isCapPick = roundIndex === 0;
        const pick = room.hostOptions[Math.floor(Math.random() * room.hostOptions.length)];
        let hostNode;

        if (isCapPick) {
          const captainSlotIdx = findBestCaptainSlot(
            room.host.formation, pick.position, pick.secondaryPositions || [], []
          );
          hostNode = (FORMATION_POSITIONS[room.host.formation] || FORMATION_POSITIONS['433'])[captainSlotIdx];
          room.host.selectedPlayers.push({ position: hostNode, player: pick, isCaptain: true });
        } else {
          const captainIdx = getCaptainSlotIdx(room.host);
          const remaining  = getRemainingSlots(room.host.formation, captainIdx);
          hostNode = remaining[roundIndex - 1];
          room.host.selectedPlayers.push({ position: hostNode, player: pick, isCaptain: false });
        }
        room.draftedPlayers.push(pick.id);
        room.availablePlayers = room.availablePlayers.filter(id => id !== pick.id);
        hostUpdated = true;
      }

      // ── Auto-pick for opponent ──
      if (room.opponent && room.opponent.selectedPlayers.length < expectedCount) {
        const isCapPick = roundIndex === 0;
        const pick = room.opponentOptions[Math.floor(Math.random() * room.opponentOptions.length)];
        let oppNode;

        if (isCapPick) {
          const captainSlotIdx = findBestCaptainSlot(
            room.opponent.formation, pick.position, pick.secondaryPositions || [], []
          );
          oppNode = (FORMATION_POSITIONS[room.opponent.formation] || FORMATION_POSITIONS['433'])[captainSlotIdx];
          room.opponent.selectedPlayers.push({ position: oppNode, player: pick, isCaptain: true });
        } else {
          const captainIdx = getCaptainSlotIdx(room.opponent);
          const remaining  = getRemainingSlots(room.opponent.formation, captainIdx);
          oppNode = remaining[roundIndex - 1];
          room.opponent.selectedPlayers.push({ position: oppNode, player: pick, isCaptain: false });
        }
        room.draftedPlayers.push(pick.id);
        room.availablePlayers = room.availablePlayers.filter(id => id !== pick.id);
        opponentUpdated = true;
      }

      if (hostUpdated || opponentUpdated) {
        room.currentPositionIndex += 1;

        if (room.currentPositionIndex >= 11) {
          room.status = 'simulation';
          room.host.completed = true;
          room.opponent.completed = true;
          room.hostOptions = [];
          room.opponentOptions = [];

          await room.save();
          delete draftSequences[roomCode];
          io.to(roomCode).emit('room-state', room);
        } else {
          // Serve next round from sequence (with validation fallback)
          const hostCaptainIdx = getCaptainSlotIdx(room.host);
          const oppCaptainIdx  = getCaptainSlotIdx(room.opponent);

          const nextHostOptions = await getOptionsForRound(
            roomCode, true, room.currentPositionIndex,
            room.host.formation, hostCaptainIdx, room.availablePlayers
          );
          const hostOptIds = nextHostOptions.map(p => p.id);
          const tempPool   = room.availablePlayers.filter(id => !hostOptIds.includes(id));
          const nextOppOptions = await getOptionsForRound(
            roomCode, false, room.currentPositionIndex,
            room.opponent.formation, oppCaptainIdx, tempPool
          );

          room.hostOptions     = nextHostOptions;
          room.opponentOptions = nextOppOptions;
          room.endsAt          = Date.now() + 30000;

          await room.save();

          const prefetchOptions = buildPrefetchOptions(roomCode, room.currentPositionIndex, room);
          io.to(roomCode).emit('room-state', { ...room.toObject(), prefetchOptions });
          startDraftTimer(io, roomCode);
        }
      }
    });
  }, 30500);
}

module.exports = socketHandler;
