const mongoose = require('mongoose');
const {setupJazzCashStatusCheckCron} = require("../utils/cronJobs");
const logger = require('../utils/logger');

let mongoEventHandlersAttached = false;

function attachMongoEventHandlers() {
  if (mongoEventHandlersAttached) return;
  mongoEventHandlersAttached = true;

  mongoose.connection.on('connected', () => {
    logger.info(`MongoDB connection event: connected (host=${mongoose.connection.host})`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection event: disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB connection event: reconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection event: error', { message: err?.message });
  });
}

const connectDB = async () => {
  try {
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    attachMongoEventHandlers();
    
    // Remove deprecated options
    const conn = await mongoose.connect(process.env.MONGO_URI);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    setupJazzCashStatusCheckCron();

    return conn;
  } catch (error) {
    logger.error('Error connecting to MongoDB', { message: error?.message });
    process.exit(1);
  }
};

module.exports = connectDB;