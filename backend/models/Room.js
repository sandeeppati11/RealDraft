const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  socketId: { type: String, default: null },
  ready: { type: Boolean, default: false },
  formation: { type: String, default: null },
  selectedPlayers: { type: Array, default: [] }, // Array of { position: string, player: obj }
  completed: { type: Boolean, default: false }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  host: { type: MemberSchema, default: null },
  opponent: { type: MemberSchema, default: null },
  status: { 
    type: String, 
    enum: ['waiting', 'formation', 'drafting', 'simulation', 'finished'], 
    default: 'waiting' 
  },
  availablePlayers: [{ type: Number }], // Array of player IDs remaining in the room pool
  draftedPlayers: [{ type: Number }], // Array of player IDs selected by either player
  hostOptions: [{ type: mongoose.Schema.Types.Mixed }], // Current 5 options for the host
  opponentOptions: [{ type: mongoose.Schema.Types.Mixed }], // Current 5 options for the opponent
  currentPositionIndex: { type: Number, default: 0 }, // 0 is Captain round, 1-11 are formation nodes
  draftHistory: [{ type: mongoose.Schema.Types.Mixed }], // Array of events for reconnecting
  endsAt: { type: Number, default: 0 },
  roomSeed: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, expires: 7200 } // Auto TTL cleanup after 2 hours
});

module.exports = mongoose.model('Room', RoomSchema);
