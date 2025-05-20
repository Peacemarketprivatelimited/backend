const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for user authentication
 * @param {string} userId - User ID to encode in the token
 * @param {string} [expiresIn='30d'] - Token expiration time
 * @returns {string} JWT token
 */
exports.generateToken = (userId, expiresIn = '30d') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload
 */
exports.verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * Decode JWT token without verification (for debugging)
 * @param {string} token - JWT token to decode
 * @returns {object} Decoded token payload
 */
exports.decodeToken = (token) => {
  return jwt.decode(token);
};