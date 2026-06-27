const fs = require('fs');
const path = require('path');
const Player = require('../models/Player');

const seedPlayers = async () => {
  try {
    const count = await Player.countDocuments();
    if (count > 0) {
      console.log(`Players collection already seeded with ${count} players.`);
      return;
    }
    
    console.log("Seeding players collection from players.json...");
    const filePath = path.join(__dirname, '../../players.json');
    if (!fs.existsSync(filePath)) {
      console.error(`Error: players.json not found at ${filePath}`);
      return;
    }
    
    const rawData = fs.readFileSync(filePath, 'utf8');
    const players = JSON.parse(rawData);
    
    await Player.insertMany(players);
    console.log(`Successfully seeded players collection with ${players.length} players!`);
  } catch (error) {
    console.error(`Seeding error: ${error.message}`);
  }
};

module.exports = seedPlayers;
