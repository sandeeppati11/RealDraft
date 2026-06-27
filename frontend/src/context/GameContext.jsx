import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { imageCache, PRIORITY } from '../utils/imageCache';

const GameContext = createContext();

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BACKEND_URL + '/api',
});

export const GameProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState(null);
  const [timer, setTimer] = useState(30);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matchResult, setMatchResult] = useState(null);

  // Keep a ref of room state to avoid stale closure captures in socket event handlers
  const roomRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
    };
  }, [socket]);

  // Local synchronized countdown timer based on round endsAt timestamp
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (room && room.status === 'drafting' && room.endsAt) {
      const calculateTimeLeft = () => {
        const remaining = Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000));
        setTimer(remaining);
        if (remaining <= 0 && timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };

      calculateTimeLeft();
      timerIntervalRef.current = setInterval(calculateTimeLeft, 1000);
    } else {
      setTimer(30);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [room]);

  const initSocketConnection = (code, name) => {
    if (socket) socket.disconnect();

    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', () => {
      console.log('Connected to socket server:', newSocket.id);
      newSocket.emit('join-room', { roomCode: code, playerName: name });
    });

    newSocket.on('room-state', (updatedRoom) => {
      console.log('Received room state update:', updatedRoom);
      setErrorMessage('');

      // Extract prefetchOptions — ephemeral, not persisted in DB
      const { prefetchOptions, ...roomData } = updatedRoom;

      // Update room state immediately — no blocking
      setRoom(roomData);
      setRoomCode(roomData.code);

      if (roomData.status === 'finished') {
        fetchMatchResult(roomData.code);
      }

      if (roomData.status === 'drafting') {
        // ── Prioritized image prefetch via ImageCacheManager ──────────────────
        //
        // When a new round starts, free the concurrency pool from lower-priority
        // downloads so CURRENT-round images are served within the first 4 slots.
        //
        // Priority order:
        //   0 CURRENT  — visible cards right now (highest urgency)
        //   1 NEXT     — r1: one round ahead
        //   2 PREFETCH — r2: two rounds ahead

        const currentPlayers = [
          ...(roomData.hostOptions || []),
          ...(roomData.opponentOptions || []),
        ];

        const r1Players = [
          ...(prefetchOptions?.r1?.host     || []),
          ...(prefetchOptions?.r1?.opponent || []),
        ];

        const r2Players = [
          ...(prefetchOptions?.r2?.host     || []),
          ...(prefetchOptions?.r2?.opponent || []),
        ];

        // Cancel any NEXT/PREFETCH downloads in-flight to free the 4 slots
        // for this round's visible cards first.
        imageCache.cancelBelow(PRIORITY.NEXT);

        // Enqueue in priority order
        imageCache.enqueue(currentPlayers, PRIORITY.CURRENT);
        imageCache.enqueue(r1Players,      PRIORITY.NEXT);
        imageCache.enqueue(r2Players,      PRIORITY.PREFETCH);
      }
    });



    newSocket.on('player-disconnected', ({ playerName: dcPlayer }) => {
      console.log(`Opponent disconnected: ${dcPlayer}`);
    });

    newSocket.on('room-destroyed', (reason) => {
      alert(reason);
      resetGame();
    });

    newSocket.on('error-msg', (msg) => {
      setErrorMessage(msg);
    });

    setSocket(newSocket);
  };

  const createRoom = async (name) => {
    try {
      setLoading(true);
      setErrorMessage('');
      const response = await api.post('/create-room', { name });
      const { roomCode: code, room: newRoom } = response.data;

      setPlayerName(name);
      setRoomCode(code);
      setRoom(newRoom);
      initSocketConnection(code, name);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to create room. Is the server running?');
      console.error('Create room error:', err);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (code, name) => {
    try {
      setLoading(true);
      setErrorMessage('');
      const formattedCode = code.trim().toUpperCase();
      const response = await api.post('/join-room', { roomCode: formattedCode, name });
      const { room: joinedRoom } = response.data;

      setPlayerName(name);
      setRoomCode(formattedCode);
      setRoom(joinedRoom);
      initSocketConnection(formattedCode, name);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to join room. Check code or server.');
      console.error('Join room error:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectFormation = (formation) => {
    if (socket) socket.emit('formation-selected', { formation });
  };

  const pickPlayer = (playerId) => {
    if (socket) socket.emit('player-picked', { playerId });
  };

  const fetchMatchResult = async (code) => {
    try {
      await api.get(`/room/${code}`);
      const matchRes = await api.post(`/simulate-match`, { roomCode: code });
      setMatchResult(matchRes.data);
    } catch (err) {
      console.error('Fetch match result error:', err);
    }
  };

  const getLeaderboard = async () => {
    try {
      const response = await api.get('/leaderboard');
      setLeaderboard(response.data);
    } catch (err) {
      console.error('Leaderboard error:', err);
    }
  };

  const resetGame = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    // Cancel all pending/in-flight image downloads and clear the loaded set
    imageCache.reset();

    setPlayerName('');
    setRoomCode('');
    setRoom(null);
    setTimer(30);
    setErrorMessage('');
    setMatchResult(null);
  };

  return (
    <GameContext.Provider
      value={{
        playerName,
        roomCode,
        room,
        timer,
        errorMessage,
        loading,
        leaderboard,
        matchResult,
        setErrorMessage,
        createRoom,
        joinRoom,
        selectFormation,
        pickPlayer,
        fetchMatchResult,
        getLeaderboard,
        resetGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);
