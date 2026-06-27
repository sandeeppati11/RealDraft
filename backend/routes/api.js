const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const matchController = require('../controllers/matchController');

// Room endpoints
router.post('/create-room', roomController.createRoom);
router.post('/join-room', roomController.joinRoom);
router.get('/room/:roomCode', roomController.getRoomState);

// Match & Leaderboard endpoints
router.post('/simulate-match', matchController.triggerMatchSimulation);
router.get('/leaderboard', matchController.getLeaderboard);

module.exports = router;
