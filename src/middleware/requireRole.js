/**
 * Middleware kiểm tra quyền truy cập của user dựa vào danh sách role được phép.
 *
 * @param {Array<string>} roles - Danh sách vai trò được phép (['Admin', 'Staff'])
 * @returns {Function} Middleware function
 */
module.exports = function requireRoles(roles = []) {
  return function (req, res, next) {
    try {
      // kiểm tra role
      if (!req.userData || !req.userData.role) {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          message: 'Unauthorized. No role info.',
          data: null
        });
      }

      const userRole = req.userData.role;

      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: `Access denied. Requires role: ${roles.join(', ')}`,
          data: null
        });
      }

      // Đủ quyền → cho qua
      next();
    } catch (error) {
      console.error('requireRoles error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  };
};
