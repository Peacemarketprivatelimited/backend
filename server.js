const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const connectDB = require('./src/config/Db');
const logger = require('./src/utils/logger');
const adminRoutes = require('./src/routes/adminRoutes');
const productRoutes = require('./src/routes/productRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const jazzcashRoutes = require('./src/routes/jazzcashRoutes');
const blogRoutes = require('./src/routes/blogRoutes');

// Import rate limiters
const {
  globalLimiter,
  authLimiter,
  adminLimiter,
  paymentLimiter,
  orderLimiter,
  methodBasedLimiter
} = require('./src/config/rateLimitConfig');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

app.set('trust proxy', 1); // Trust first proxy for rate limiting

// Security middleware
app.use(helmet()); // Set security HTTP headers
app.use(mongoSanitize()); // Sanitize inputs against NoSQL query injection
app.use(xss()); // Sanitize inputs against XSS attacks

// Apply global rate limiter first (safety net)
app.use(globalLimiter);

// Body parser middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(cors({
  origin: ['https://peace-market.com','https://admin.peace-market.com'], // <-- set your frontend/admin domain here
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

// ============ APPLY ROUTE-SPECIFIC LIMITERS ============

// Auth routes - strictest limiting (applied before general user routes)
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/forgot-password', authLimiter);
app.use('/api/users/reset-password', authLimiter);

// Payment routes - strict limiting
app.use('/api/jazzcash', paymentLimiter);

// Order routes - moderate limiting
app.use('/api/orders', orderLimiter);

// Admin routes - admin specific limiting
app.use('/api/admin', adminLimiter, adminRoutes);

// Apply method-based limiters for remaining API routes
app.use('/api', methodBasedLimiter);

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/jazzcash', jazzcashRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/videos', require('./src/routes/videoRoutes'));

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