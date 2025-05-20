const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided"
      });
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from the token
    const user = await User.findById(decoded.id).select("-passwordHash");

if (!user) {
  return res.status(401).json({
    success: false,
    message: 'User not found'
  });
}

// Set user in request
req.user = {
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,          // Make sure to include the role
  permissions: user.permissions  // Include permissions
};
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
      error: error.message
    });
  }
};

// Optional: Admin middleware
exports.admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Not authorized as an admin"
    });
  }
};