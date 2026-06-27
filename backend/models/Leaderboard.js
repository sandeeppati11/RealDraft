const mongoose = require('mongoose');

const LeaderboardSchema = new mongoose.Schema({
  playerName: { type: String, required: true, unique: true, index: true },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  points: { type: Number, default: 0 } // e.g. 3 for win, 1 for draw, 0 for loss
});

module.exports = mongoose.model('Leaderboard', LeaderboardSchema);
