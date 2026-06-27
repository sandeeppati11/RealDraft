const Match = require('../models/Match');
const Leaderboard = require('../models/Leaderboard');
const Room = require('../models/Room');
const { simulateMatch } = require('../services/matchService');

// In-memory simulation locks to prevent parallel request race conditions
const simulationLocks = {};

// Update player stats in the leaderboard
const updateLeaderboardStats = async (playerName, result) => {
  try {
    let stats = await Leaderboard.findOne({ playerName });
    if (!stats) {
      stats = new Leaderboard({ playerName });
    }
    
    if (result === 'win') {
      stats.wins += 1;
      stats.points += 3;
    } else if (result === 'loss') {
      stats.losses += 1;
    } else if (result === 'draw') {
      stats.draws += 1;
      stats.points += 1;
    }
    
    await stats.save();
  } catch (error) {
    console.error(`Leaderboard Update Error for ${playerName}: ${error.message}`);
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const list = await Leaderboard.find().sort({ points: -1, wins: -1 }).limit(20);
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ message: "Server error retrieving leaderboard" });
  }
};

exports.triggerMatchSimulation = async (req, res) => {
  try {
    const { roomCode } = req.body;
    if (!roomCode) {
      return res.status(400).json({ message: "Room code is required" });
    }
    
    const room = await Room.findOne({ code: roomCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    
    if (!room.host.completed || !room.opponent.completed) {
      return res.status(400).json({ message: "Both players must complete drafting first" });
    }
    
    // Check if match was already simulated
    let matchLog = await Match.findOne({ roomCode: room.code });
    if (!matchLog) {
      if (simulationLocks[room.code]) {
        matchLog = await simulationLocks[room.code];
      } else {
        let resolveLock, rejectLock;
        simulationLocks[room.code] = new Promise((resolve, reject) => {
          resolveLock = resolve;
          rejectLock = reject;
        });

        try {
          const results = simulateMatch(room.code, room.host, room.opponent);
          
          matchLog = new Match({
            roomCode: room.code,
            hostName: results.hostName,
            opponentName: results.opponentName,
            hostScore: results.hostScore,
            opponentScore: results.opponentScore,
            mvp: results.mvp,
            hostScorers: results.hostScorers,
            opponentScorers: results.opponentScorers,
            stats: {
              hostPossession: results.stats.hostPossession,
              opponentPossession: results.stats.opponentPossession,
              hostShots: results.stats.hostShots,
              opponentShots: results.stats.opponentShots,
              hostShotsOnTarget: results.stats.hostShotsOnTarget,
              opponentShotsOnTarget: results.stats.opponentShotsOnTarget,
              hostPasses: results.stats.hostPasses,
              opponentPasses: results.stats.opponentPasses,
              hostPassAccuracy: results.stats.hostPassAccuracy,
              opponentPassAccuracy: results.stats.opponentPassAccuracy,
              hostFouls: results.stats.hostFouls,
              opponentFouls: results.stats.opponentFouls,
              hostYellowCards: results.stats.hostYellowCards,
              opponentYellowCards: results.stats.opponentYellowCards,
              hostCorners: results.stats.hostCorners,
              opponentCorners: results.stats.opponentCorners,
              hostSaves: results.stats.hostSaves,
              opponentSaves: results.stats.opponentSaves
            },
            commentary: results.commentary
          });
          
          await matchLog.save();
          
          // Update Leaderboard
          if (results.hostScore > results.opponentScore) {
            await updateLeaderboardStats(results.hostName, 'win');
            await updateLeaderboardStats(results.opponentName, 'loss');
          } else if (results.hostScore < results.opponentScore) {
            await updateLeaderboardStats(results.opponentName, 'win');
            await updateLeaderboardStats(results.hostName, 'loss');
          } else {
            await updateLeaderboardStats(results.hostName, 'draw');
            await updateLeaderboardStats(results.opponentName, 'draw');
          }

          resolveLock(matchLog);
        } catch (err) {
          rejectLock(err);
          delete simulationLocks[room.code];
          throw err;
        } finally {
          setTimeout(() => {
            delete simulationLocks[room.code];
          }, 5000);
        }
      }
    } else {
      // Dynamic backfill safeguard: If loading a match simulated before these fields were added,
      // generate and save realistic statistics on-the-fly to heal the match screen.
      let needsSave = false;

      // 1. Backfill Scorers list by parsing commentary
      if (!matchLog.hostScorers || matchLog.hostScorers.length === 0) {
        const parsedHost = [];
        const parsedOpp = [];
        matchLog.commentary.forEach(line => {
          const match = line.match(/^(\d+)'\s*-\s*GOAL!\s*(.*?)\s*(scoring|scores)/i);
          if (match) {
            const minute = parseInt(match[1]);
            const scorerName = match[2].trim();
            if (line.includes(`for ${room.host.name}`)) {
              parsedHost.push({ name: scorerName, minute });
            } else {
              parsedOpp.push({ name: scorerName, minute });
            }
          }
        });
        matchLog.hostScorers = parsedHost;
        matchLog.opponentScorers = parsedOpp;
        needsSave = true;
      }

      // 2. Backfill comparative stats if missing or defaulted to zero
      if (matchLog.stats.hostShotsOnTarget === undefined || matchLog.stats.hostShotsOnTarget === 0) {
        const hostPossession = matchLog.stats.hostPossession || 50;
        const opponentPossession = 100 - hostPossession;
        const hostShots = matchLog.stats.hostShots || 12;
        const opponentShots = matchLog.stats.opponentShots || 10;
        const hostScore = matchLog.hostScore;
        const opponentScore = matchLog.opponentScore;

        const hostShotsOnTarget = hostScore + Math.floor(Math.random() * Math.max(1, (hostShots - hostScore) * 0.6));
        const opponentShotsOnTarget = opponentScore + Math.floor(Math.random() * Math.max(1, (opponentShots - opponentScore) * 0.6));

        const hostPasses = Math.round((hostPossession / 100) * 900 + Math.random() * 80);
        const opponentPasses = Math.round((opponentPossession / 100) * 900 + Math.random() * 80);

        const hostPassAccuracy = Math.round(78 + Math.random() * 10);
        const opponentPassAccuracy = Math.round(78 + Math.random() * 10);

        const hostFouls = Math.floor(Math.random() * 9) + 4;
        const opponentFouls = Math.floor(Math.random() * 9) + 4;

        const hostYellowCards = Math.floor(Math.random() * Math.max(1, hostFouls * 0.25));
        const opponentYellowCards = Math.floor(Math.random() * Math.max(1, opponentFouls * 0.25));

        const hostCorners = Math.floor(Math.random() * 7) + 2;
        const opponentCorners = Math.floor(Math.random() * 7) + 2;

        const hostSaves = Math.max(0, opponentShotsOnTarget - opponentScore);
        const opponentSaves = Math.max(0, hostShotsOnTarget - hostScore);

        matchLog.stats.hostPossession = hostPossession;
        matchLog.stats.opponentPossession = opponentPossession;
        matchLog.stats.hostShots = hostShots;
        matchLog.stats.opponentShots = opponentShots;
        matchLog.stats.hostShotsOnTarget = hostShotsOnTarget;
        matchLog.stats.opponentShotsOnTarget = opponentShotsOnTarget;
        matchLog.stats.hostPasses = hostPasses;
        matchLog.stats.opponentPasses = opponentPasses;
        matchLog.stats.hostPassAccuracy = hostPassAccuracy;
        matchLog.stats.opponentPassAccuracy = opponentPassAccuracy;
        matchLog.stats.hostFouls = hostFouls;
        matchLog.stats.opponentFouls = opponentFouls;
        matchLog.stats.hostYellowCards = hostYellowCards;
        matchLog.stats.opponentYellowCards = opponentYellowCards;
        matchLog.stats.hostCorners = hostCorners;
        matchLog.stats.opponentCorners = opponentCorners;
        matchLog.stats.hostSaves = hostSaves;
        matchLog.stats.opponentSaves = opponentSaves;

        needsSave = true;
      }

      if (needsSave) {
        await matchLog.save();
      }
    }
    
    // Update room status
    if (room.status !== 'finished') {
      room.status = 'finished';
      await room.save();
    }
    
    res.status(200).json(matchLog);
  } catch (error) {
    console.error(`Simulate Match Error: ${error.message}`);
    res.status(500).json({ message: "Server error during match simulation" });
  }
};
