const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  overall: { type: Number, required: true },
  position: { type: String, required: true },
  secondaryPositions: [{ type: String }],
  nation: { type: String, required: true },
  age: { type: Number, required: true },
  preferredFoot: { type: String, required: true },
  weakFoot: { type: Number, required: true },
  skillMoves: { type: Number, required: true },
  workRate: {
    attack: { type: String, required: true },
    defense: { type: String, required: true }
  },
  height: { type: Number, required: true },
  weight: { type: Number, required: true },
  potential: { type: Number, required: true },
  pace: { type: Number, required: true },
  shooting: { type: Number, required: true },
  passing: { type: Number, required: true },
  dribbling: { type: Number, required: true },
  defending: { type: Number, required: true },
  physical: { type: Number, required: true },
  playerImage: { type: String, required: true },
  club: { type: String, required: true },
  league: { type: String, required: true },
  tier: { type: String, required: true },
  draftScore: { type: Number, required: true },
  isCaptainCandidate: { type: Boolean, required: true }
}, { id: false });

module.exports = mongoose.model('Player', PlayerSchema);
