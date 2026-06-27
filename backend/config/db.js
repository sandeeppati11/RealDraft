const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/realdraft';
    console.log(`Attempting to connect to MongoDB at ${uri}...`);
    
    // Set a connection timeout of 3 seconds so we don't hang if Mongo isn't running
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000,
    };
    
    try {
      const conn = await mongoose.connect(uri, options);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (primaryError) {
      console.log(`Primary MongoDB connection failed: ${primaryError.message}`);
      console.log("Starting in-memory MongoDB server as fallback...");
      
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      
      console.log(`In-Memory MongoDB Server started at: ${mongoUri}`);
      const conn = await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(`MongoDB Connected (In-Memory): ${conn.connection.host}`);
    }
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
