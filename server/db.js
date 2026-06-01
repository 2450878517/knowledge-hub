const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf8');
}

function loadUsers() {
  ensureStore();
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  ensureStore();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function toPublicUser(user) {
  return {
    id: user.id,
    account: user.account,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio || '',
    homepage: user.homepage || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function findByAccount(account) {
  const users = loadUsers();
  return users.find((u) => u.account.toLowerCase() === account.toLowerCase()) || null;
}

function findById(id) {
  const users = loadUsers();
  return users.find((u) => u.id === id) || null;
}

function findByDisplayName(displayName, excludeId) {
  const users = loadUsers();
  return (
    users.find(
      (u) =>
        u.id !== excludeId &&
        u.displayName.toLowerCase() === displayName.toLowerCase()
    ) || null
  );
}

function createUser({ account, passwordHash, displayName, avatar }) {
  const users = loadUsers();
  if (findByAccount(account)) {
    throw new Error('该账号已被注册');
  }
  if (findByDisplayName(displayName)) {
    throw new Error('该昵称已被使用');
  }

  const now = Date.now();
  const user = {
    id: randomUUID(),
    account,
    passwordHash,
    displayName,
    avatar,
    bio: '',
    homepage: '',
    createdAt: now,
    updatedAt: now,
  };
  users.push(user);
  saveUsers(users);
  return user;
}

function updateUser(id, patch) {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return null;

  const user = users[idx];
  if (patch.displayName !== undefined) {
    const taken = findByDisplayName(patch.displayName, id);
    if (taken) throw new Error('该昵称已被使用');
    user.displayName = patch.displayName;
  }
  if (patch.avatar !== undefined) user.avatar = patch.avatar;
  if (patch.bio !== undefined) user.bio = String(patch.bio).slice(0, 200);
  if (patch.homepage !== undefined) user.homepage = String(patch.homepage).slice(0, 200);
  user.updatedAt = Date.now();

  users[idx] = user;
  saveUsers(users);
  return user;
}

module.exports = {
  toPublicUser,
  findByAccount,
  findById,
  createUser,
  updateUser,
};
