/**
 * Middleware to verify admin access rights
 */
exports.isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin privileges required'
    });
  };
  
  /**
   * Middleware to check specific admin permissions
   * @param {string} permission - The permission to check
   */
  exports.hasPermission = (permission) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }
      
      // Super admins have all permissions
      if (req.user.role === 'superadmin') {
        return next();
      }
      
      // Check if the user has the required permission
      if (req.user.role === 'admin' && req.user.permissions && req.user.permissions[permission]) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        message: `Access denied: ${permission} permission required`
      });
    };
  };