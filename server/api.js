const express = require('express');
const {
  toPublicUser,
  findByAccount,
  findById,
  createUser,
  updateUser,
} = require('./db');
const {
  hashPassword,
  verifyPassword,
  signToken,
  authMiddleware,
} = require('./auth');

const AVATAR_OPTIONS = ['😀', '😎', '🦊', '🐱', '🐶', '🌟', '🚀', '💡', '🎮', '🎨', '📚', '🔥'];
const MAX_AVATAR_SIZE = 500 * 1024;

function isValidAccount(account) {
  return /^[\w\u4e00-\u9fa5]{3,20}$/.test(account);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 64;
}

function isValidDisplayName(name) {
  const trimmed = (name || '').trim();
  return trimmed.length >= 1 && trimmed.length <= 20;
}

function isValidAvatar(avatar) {
  if (!avatar || typeof avatar !== 'string') return false;
  if (AVATAR_OPTIONS.includes(avatar)) return true;
  if (
    avatar.startsWith('data:image/jpeg') ||
    avatar.startsWith('data:image/png') ||
    avatar.startsWith('data:image/gif') ||
    avatar.startsWith('data:image/webp')
  ) {
    return avatar.length <= MAX_AVATAR_SIZE;
  }
  return false;
}

function normalizeAvatar(avatar, fallbackName) {
  if (isValidAvatar(avatar)) return avatar;
  let hash = 0;
  for (let i = 0; i < fallbackName.length; i++) {
    hash = fallbackName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_OPTIONS[Math.abs(hash) % AVATAR_OPTIONS.length];
}

function isValidHomepage(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function createApiRouter() {
  const router = express.Router();

  router.post('/auth/register', async (req, res) => {
    try {
      const { account, password, displayName, avatar } = req.body || {};
      if (!isValidAccount(account)) {
        return res.status(400).json({ message: '账号需为 3-20 位字母、数字或中文' });
      }
      if (!isValidPassword(password)) {
        return res.status(400).json({ message: '密码需为 6-64 位' });
      }
      if (!isValidDisplayName(displayName)) {
        return res.status(400).json({ message: '昵称需为 1-20 个字符' });
      }

      const passwordHash = await hashPassword(password);
      const user = createUser({
        account: account.trim(),
        passwordHash,
        displayName: displayName.trim(),
        avatar: normalizeAvatar(avatar, displayName.trim()),
      });

      const token = signToken(user);
      res.json({ token, user: toPublicUser(user) });
    } catch (err) {
      res.status(400).json({ message: err.message || '注册失败' });
    }
  });

  router.post('/auth/login', async (req, res) => {
    try {
      const { account, password } = req.body || {};
      const user = findByAccount((account || '').trim());
      if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
        return res.status(401).json({ message: '账号或密码错误' });
      }
      const token = signToken(user);
      res.json({ token, user: toPublicUser(user) });
    } catch {
      res.status(500).json({ message: '登录失败' });
    }
  });

  router.get('/auth/me', authMiddleware, (req, res) => {
    const user = findById(req.auth.userId);
    if (!user) return res.status(401).json({ message: '用户不存在' });
    res.json({ user: toPublicUser(user) });
  });

  router.put('/profile', authMiddleware, (req, res) => {
    try {
      const { displayName, avatar, bio, homepage } = req.body || {};
      const patch = {};

      if (displayName !== undefined) {
        if (!isValidDisplayName(displayName)) {
          return res.status(400).json({ message: '昵称需为 1-20 个字符' });
        }
        patch.displayName = displayName.trim();
      }
      if (avatar !== undefined) {
        if (!isValidAvatar(avatar)) {
          return res.status(400).json({ message: '头像无效或过大' });
        }
        patch.avatar = avatar;
      }
      if (bio !== undefined) patch.bio = bio;
      if (homepage !== undefined) {
        const url = String(homepage).trim();
        if (!isValidHomepage(url)) {
          return res.status(400).json({ message: '主页链接需以 http:// 或 https:// 开头' });
        }
        patch.homepage = url;
      }

      const user = updateUser(req.auth.userId, patch);
      if (!user) return res.status(404).json({ message: '用户不存在' });
      res.json({ user: toPublicUser(user) });
    } catch (err) {
      res.status(400).json({ message: err.message || '保存失败' });
    }
  });

  router.get('/profile/:account', (req, res) => {
    const user = findByAccount(req.params.account);
    if (!user) return res.status(404).json({ message: '用户不存在' });
    res.json({ user: toPublicUser(user) });
  });

  return router;
}

module.exports = {
  createApiRouter,
  isValidAvatar,
  AVATAR_OPTIONS,
};
