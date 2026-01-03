/**
 * Redis Configuration and Cache Utility
 * Professional-grade caching layer for PeaceMarket Backend
 * 
 * Features:
 * - Connection pooling with automatic reconnection
 * - Graceful fallback when Redis is unavailable
 * - Key prefixing for namespace isolation
 * - Pattern-based cache invalidation
 * - TTL management with sensible defaults
 * - Statistics and monitoring support
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

// ============ CONFIGURATION ============
// Config will be built dynamically when initRedis is called (after dotenv loads)
const getRedisConfig = () => {
  const useTls = process.env.REDIS_TLS === 'true';
  
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || 'default',
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    keyPrefix: process.env.REDIS_PREFIX || 'pm:',
    
    // TLS for Redis Cloud - use proper TLS settings
    ...(useTls ? { 
      tls: {
        rejectUnauthorized: false
      }
    } : {}),
    
    // Connection settings
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 5000,
    
    // Reconnection strategy
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis: Max reconnection attempts reached');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    
    // Enable offline queue for commands during disconnect
    enableOfflineQueue: true,
    lazyConnect: true
  };
};

// ============ TTL PRESETS (in seconds) ============
const TTL = {
  SHORT: 60,           // 1 minute - for frequently changing data
  MEDIUM: 300,         // 5 minutes - default for most queries
  LONG: 900,           // 15 minutes - for stable data
  EXTENDED: 3600,      // 1 hour - for rarely changing data
  DAY: 86400           // 24 hours - for static content
};

// ============ CACHE KEY PREFIXES ============
const CACHE_KEYS = {
  PRODUCTS: 'products:',
  PRODUCT: 'product:',
  PRODUCT_FEATURED: 'products:featured',
  PRODUCT_DISCOUNTED: 'products:discounted',
  PRODUCT_CATEGORY: 'products:category:',
  PRODUCT_SEARCH: 'products:search:',
  
  CATEGORIES: 'categories:',
  CATEGORY: 'category:',
  CATEGORY_FEATURED: 'categories:featured',
  
  BLOGS: 'blogs:',
  BLOG: 'blog:',
  
  VIDEOS: 'videos:',
  VIDEO: 'video:',
  
  USER: 'user:',
  STATS: 'stats:'
};

// ============ REDIS CLIENT ============
let redis = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
const initRedis = async () => {
  try {
    // Build config at runtime (after dotenv has loaded)
    const config = getRedisConfig();
    
    logger.info(`Redis: Connecting to ${config.host}:${config.port}...`);
    
    redis = new Redis(config);
    
    redis.on('connect', () => {
      logger.info('Redis: Connecting...');
    });
    
    redis.on('ready', () => {
      isConnected = true;
      logger.info('Redis: Connected and ready');
    });
    
    redis.on('error', (err) => {
      logger.error('Redis: Connection error', err.message);
    });
    
    redis.on('close', () => {
      isConnected = false;
      logger.warn('Redis: Connection closed');
    });
    
    redis.on('reconnecting', () => {
      logger.info('Redis: Reconnecting...');
    });
    
    // Attempt connection
    await redis.connect();
    
    return redis;
  } catch (error) {
    logger.error('Redis: Failed to initialize', error.message);
    isConnected = false;
    return null;
  }
};

/**
 * Get Redis client instance
 */
const getRedis = () => redis;

/**
 * Check if Redis is connected
 */
const isRedisConnected = () => isConnected && redis && redis.status === 'ready';

// ============ CACHE UTILITY CLASS ============
class Cache {
  /**
   * Get cached value by key
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  static async get(key) {
    if (!isRedisConnected()) return null;
    
    try {
      const data = await redis.get(key);
      if (!data) return null;
      
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Cache GET error [${key}]:`, error.message);
      return null;
    }
  }
  
  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttl - Time to live in seconds (default: MEDIUM)
   * @returns {Promise<boolean>} Success status
   */
  static async set(key, value, ttl = TTL.MEDIUM) {
    if (!isRedisConnected()) return false;
    
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache SET error [${key}]:`, error.message);
      return false;
    }
  }
  
  /**
   * Delete specific key from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  static async del(key) {
    if (!isRedisConnected()) return false;
    
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache DEL error [${key}]:`, error.message);
      return false;
    }
  }
  
  /**
   * Delete all keys matching a pattern
   * @param {string} pattern - Pattern to match (e.g., 'products:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  static async delPattern(pattern) {
    if (!isRedisConnected()) return 0;
    
    try {
      const keyPrefix = process.env.REDIS_PREFIX || 'pm:';
      
      // Use SCAN for production-safe pattern deletion
      const stream = redis.scanStream({
        match: keyPrefix + pattern,
        count: 100
      });
      
      let deletedCount = 0;
      
      return new Promise((resolve, reject) => {
        stream.on('data', async (keys) => {
          if (keys.length) {
            // Remove prefix for deletion (ioredis adds it automatically)
            const keysWithoutPrefix = keys.map(k => k.replace(keyPrefix, ''));
            const pipeline = redis.pipeline();
            keysWithoutPrefix.forEach(key => pipeline.del(key));
            await pipeline.exec();
            deletedCount += keys.length;
          }
        });
        
        stream.on('end', () => {
          logger.info(`Cache: Invalidated ${deletedCount} keys matching '${pattern}'`);
          resolve(deletedCount);
        });
        
        stream.on('error', (err) => {
          logger.error(`Cache pattern delete error:`, err.message);
          reject(err);
        });
      });
    } catch (error) {
      logger.error(`Cache DEL PATTERN error [${pattern}]:`, error.message);
      return 0;
    }
  }
  
  /**
   * Invalidate all product-related caches
   */
  static async invalidateProducts() {
    await this.delPattern('products:*');
    await this.delPattern('product:*');
  }
  
  /**
   * Invalidate all category-related caches
   */
  static async invalidateCategories() {
    await this.delPattern('categories:*');
    await this.delPattern('category:*');
    // Also invalidate products since they depend on categories
    await this.invalidateProducts();
  }
  
  /**
   * Invalidate all blog-related caches
   */
  static async invalidateBlogs() {
    await this.delPattern('blogs:*');
    await this.delPattern('blog:*');
  }
  
  /**
   * Invalidate all video-related caches
   */
  static async invalidateVideos() {
    await this.delPattern('videos:*');
    await this.delPattern('video:*');
  }
  
  /**
   * Invalidate specific product by ID or slug
   * @param {string} identifier - Product ID or slug
   */
  static async invalidateProduct(identifier) {
    await this.del(`${CACHE_KEYS.PRODUCT}id:${identifier}`);
    await this.del(`${CACHE_KEYS.PRODUCT}slug:${identifier}`);
    // Also clear listing caches
    await this.delPattern('products:list:*');
    await this.delPattern('products:featured*');
    await this.delPattern('products:discounted*');
    await this.delPattern('products:category:*');
  }
  
  /**
   * Invalidate specific category by ID or slug
   * @param {string} identifier - Category ID or slug
   */
  static async invalidateCategory(identifier) {
    await this.del(`${CACHE_KEYS.CATEGORY}id:${identifier}`);
    await this.del(`${CACHE_KEYS.CATEGORY}slug:${identifier}`);
    await this.delPattern('categories:*');
  }
  
  /**
   * Invalidate specific blog by ID or slug
   * @param {string} identifier - Blog ID or slug
   */
  static async invalidateBlog(identifier) {
    await this.del(`${CACHE_KEYS.BLOG}id:${identifier}`);
    await this.del(`${CACHE_KEYS.BLOG}slug:${identifier}`);
    await this.delPattern('blogs:list:*');
  }
  
  /**
   * Generate cache key from request query parameters
   * @param {string} prefix - Key prefix
   * @param {object} params - Query parameters
   * @returns {string} Cache key
   */
  static generateKey(prefix, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .filter(key => params[key] !== undefined && params[key] !== '')
      .map(key => `${key}:${params[key]}`)
      .join(':');
    
    return sortedParams ? `${prefix}${sortedParams}` : prefix;
  }
  
  /**
   * Get cache statistics
   * @returns {Promise<object>} Cache stats
   */
  static async getStats() {
    if (!isRedisConnected()) {
      return { connected: false, message: 'Redis not connected' };
    }
    
    try {
      const info = await redis.info('stats');
      const dbSize = await redis.dbsize();
      
      return {
        connected: true,
        dbSize,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) acc[key] = value;
          return acc;
        }, {})
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
  
  /**
   * Flush all cache (use with caution!)
   */
  static async flushAll() {
    if (!isRedisConnected()) return false;
    
    try {
      await redis.flushdb();
      logger.warn('Cache: All data flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error.message);
      return false;
    }
  }
  
  /**
   * Graceful shutdown
   */
  static async disconnect() {
    if (redis) {
      await redis.quit();
      logger.info('Redis: Disconnected gracefully');
    }
  }
}

// ============ CACHE MIDDLEWARE ============
/**
 * Express middleware for caching GET requests
 * @param {string} keyPrefix - Cache key prefix
 * @param {number} ttl - Cache TTL in seconds
 */
const cacheMiddleware = (keyPrefix, ttl = TTL.MEDIUM) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Generate cache key from URL and query params
    const cacheKey = Cache.generateKey(keyPrefix, {
      ...req.query,
      path: req.path
    });
    
    try {
      const cached = await Cache.get(cacheKey);
      
      if (cached) {
        // Add cache header for debugging
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
      
      // Store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to cache response
      res.json = async (data) => {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          await Cache.set(cacheKey, data, ttl);
        }
        res.set('X-Cache', 'MISS');
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      // On error, proceed without caching
      next();
    }
  };
};

module.exports = {
  initRedis,
  getRedis,
  isRedisConnected,
  Cache,
  TTL,
  CACHE_KEYS,
  cacheMiddleware
};
