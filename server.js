const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const connectDB = require('./src/config/Db');
const logger = require('./src/utils/logger');
const adminRoutes = require('./src/routes/adminRoutes');
const productRoutes = require('./src/routes/productRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const jazzcashRoutes = require('./src/routes/jazzcashRoutes');
const blogRoutes = require('./src/routes/blogRoutes'); // add this

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

//testing ci/cd


app.set('trust proxy', 1); // Trust first proxy for rate limiting

// Security middleware
app.use(helmet()); // Set security HTTP headers
app.use(mongoSanitize()); // Sanitize inputs against NoSQL query injection
app.use(xss()); // Sanitize inputs against XSS attacks

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api', limiter);

// Body parser middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(cors({
  origin: ['https://admin.peace-market.com','https://peace-market.com'], // <-- set your frontend/admin domain here
  credentials: true
}));

// Logging middleware
const environment = process.env.NODE_ENV || 'development';
if (environment === 'development') {
  app.use(morgan('dev'));
}

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const orderRoutes = require('./src/routes/orderRoutes');

// Import other routes as they are created
// const productRoutes = require('./src/routes/productRoutes');
// const subscriptionRoutes = require('./src/routes/subscriptionRoutes');

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/jazzcash', jazzcashRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/videos', require('./src/routes/videoRoutes'));

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per window
    message: 'Too many requests from this IP, please try again later'
  });
  
  app.use('/api/admin', adminLimiter,adminRoutes);

// Subscription routes
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
app.use('/api/subscription', subscriptionRoutes);

// Run scheduled tasks
const { checkExpiredSubscriptions } = require('./src/utils/scheduledTasks');
const mongoose = require('mongoose');

// Check for expired subscriptions daily
setInterval(checkExpiredSubscriptions, 24 * 60 * 60 * 1000);

// Initial check only after MongoDB is connected
mongoose.connection.once('connected', () => {
  // Small delay to ensure everything is ready
  setTimeout(checkExpiredSubscriptions, 2000);
});

// Root route
app.get('/test', (req, res) => {
  res.status(200).json({"success": true, "message": "API is running successfully!" });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`Error: ${err.message}`);
  
  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: environment === 'development' ? err.stack : undefined
  });
});

// Set port and start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server running in ${environment} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
  console.error('Unhandled Rejection! 💥 Shutting down...');
  // Close server & exit process
  process.exit(1);
});