const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'knowledge-hub-dev-secret-change-me';
const JWT_EXPIRES = '7d';

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(user) {
  return jwt.sign({ userId: user.id, account: user.account }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: '未登录' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
  req.auth = payload;
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  authMiddleware,
};
