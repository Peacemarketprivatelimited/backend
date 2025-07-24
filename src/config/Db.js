const mongoose = require('mongoose');
const {setupJazzCashStatusCheckCron} = require("../utils/cronJobs");

const connectDB = async () => {
  try {
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    
    // Remove deprecated options
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    setupJazzCashStatusCheckCron();

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;