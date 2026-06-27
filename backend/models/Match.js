const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  roomCode: { type: String, required: true },
  hostName: { type: String, required: true },
  opponentName: { type: String, required: true },
  hostScore: { type: Number, required: true },
  opponentScore: { type: Number, required: true },
  mvp: { type: String, required: true },
  hostScorers: [{
    name: { type: String },
    minute: { type: Number }
  }],
  opponentScorers: [{
    name: { type: String },
    minute: { type: Number }
  }],
  stats: {
    hostPossession: { type: Number, required: true },
    opponentPossession: { type: Number, required: true },
    hostShots: { type: Number, required: true },
    opponentShots: { type: Number, required: true },
    hostShotsOnTarget: { type: Number, default: 0 },
    opponentShotsOnTarget: { type: Number, default: 0 },
    hostPasses: { type: Number, default: 0 },
    opponentPasses: { type: Number, default: 0 },
    hostPassAccuracy: { type: Number, default: 0 },
    opponentPassAccuracy: { type: Number, default: 0 },
    hostFouls: { type: Number, default: 0 },
    opponentFouls: { type: Number, default: 0 },
    hostYellowCards: { type: Number, default: 0 },
    opponentYellowCards: { type: Number, default: 0 },
    hostCorners: { type: Number, default: 0 },
    opponentCorners: { type: Number, default: 0 },
    hostSaves: { type: Number, default: 0 },
    opponentSaves: { type: Number, default: 0 }
  },
  commentary: [{ type: String }],
  playedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', MatchSchema);
