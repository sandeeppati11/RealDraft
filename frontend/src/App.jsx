import React from 'react';
import { useGame } from './context/GameContext';
import Landing from './pages/Landing';
import Lobby from './pages/Lobby';
import FormationSelection from './pages/FormationSelection';
import DraftRoom from './pages/DraftRoom';
import MatchSimulation from './pages/MatchSimulation';

export default function App() {
  const { playerName, room } = useGame();

  // State-driven routing based on current Room Status
  if (!playerName || !room) {
    return <Landing />;
  }

  switch (room.status) {
    case 'waiting':
      return <Lobby />;
    case 'formation':
      return <FormationSelection />;
    case 'drafting':
      return <DraftRoom />;
    case 'simulation':
    case 'finished':
      return <MatchSimulation />;
    default:
      return <Landing />;
  }
}
