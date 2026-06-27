const Room = require('../models/Room');
const Player = require('../models/Player');
const { getPlayersList } = require('../services/draftService');

// Helper to generate a random 6-character room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

exports.createRoom = async (req, res) => {
  try {
    const { name, isAi } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Player name is required" });
    }
    
    // Check if there are players in the database
    const allPlayers = await getPlayersList();
    const availableIds = allPlayers.map(p => p.id);
    if (availableIds.length === 0) {
      return res.status(500).json({ message: "Player database is empty. Server still seeding?" });
    }
    
    let code = generateRoomCode();
    // Ensure uniqueness
    let existingRoom = await Room.findOne({ code });
    while (existingRoom) {
      code = generateRoomCode();
      existingRoom = await Room.findOne({ code });
    }

    const FORMATIONS = ['433', '442', '4231', '352', '532', '343'];
    const aiFormation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
    
    const room = new Room({
      code,
      host: {
        name,
        socketId: null,
        ready: false,
        formation: null,
        selectedPlayers: [],
        completed: false
      },
      opponent: isAi ? {
        name: "AI Bot",
        socketId: "AI_BOT_SOCKET_ID",
        ready: true,
        formation: aiFormation,
        selectedPlayers: [],
        completed: false
      } : null,
      status: isAi ? 'formation' : 'waiting',
      isAi: !!isAi,
      availablePlayers: availableIds,
      draftedPlayers: [],
      hostOptions: [],
      opponentOptions: [],
      currentPositionIndex: 0,
      roomSeed: Math.random().toString(36).substring(7)
    });
    
    await room.save();
    console.log(`Room created: ${code} by ${name} (AI: ${!!isAi})`);
    res.status(201).json({ roomCode: code, room });
  } catch (error) {
    console.error(`Create Room Error: ${error.message}`);
    res.status(500).json({ message: "Server error during room creation" });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const { name, roomCode } = req.body;
    if (!name || !roomCode) {
      return res.status(400).json({ message: "Player name and room code are required" });
    }
    
    const code = roomCode.toUpperCase();
    const room = await Room.findOne({ code });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    
    if (room.status !== 'waiting' || room.opponent) {
      return res.status(400).json({ message: "Room is already full or draft has started" });
    }
    
    // Add opponent to the room and progress to formation phase
    room.opponent = {
      name,
      socketId: null,
      ready: false,
      formation: null,
      selectedPlayers: [],
      completed: false
    };
    room.status = 'formation';
    
    await room.save();
    console.log(`Player ${name} joined room: ${code}`);
    res.status(200).json({ roomCode: code, room });
  } catch (error) {
    console.error(`Join Room Error: ${error.message}`);
    res.status(500).json({ message: "Server error joining room" });
  }
};

exports.getRoomState = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await Room.findOne({ code: roomCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.status(200).json(room);
  } catch (error) {
    res.status(500).json({ message: "Server error fetching room state" });
  }
};
