const { jwt } = require('../utils/security');
const db = require('../database/db');

function authMiddleware(req, res, next) {
  let token = null;

  // 1. From Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  // 2. From query parameter (used for direct browser file download links: ?token=...)
  else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'tarcin_palani_jwt_secret_key_2026_secure_embedded_hub';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token. Please log in again.'
    });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Admin/Supervisor privileges required.'
    });
  }
  next();
}

function requireIntern(req, res, next) {
  if (!req.user || req.user.role !== 'INTERN') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Intern privileges required.'
    });
  }
  next();
}

module.exports = {
  authMiddleware,
  requireAdmin,
  requireIntern
};
