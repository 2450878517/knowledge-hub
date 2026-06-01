const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const MAX_STORED = 500;
const DEFAULT_FETCH = 100;

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]', 'utf8');
}

function loadAll() {
  ensureStore();
  try {
    const data = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveAll(messages) {
  ensureStore();
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

function sanitizeForStorage(message) {
  const stored = {
    id: message.id,
    username: message.username,
    account: message.account || null,
    avatar: message.avatar,
    content: message.content || '',
    timestamp: message.timestamp,
  };
  if (message.isBot) stored.isBot = true;
  if (message.replyTo) stored.replyTo = message.replyTo;
  if (message.attachment) stored.attachment = message.attachment;
  if (message.mentions?.length) stored.mentions = message.mentions;
  return stored;
}

function appendMessage(message) {
  const messages = loadAll();
  messages.push(sanitizeForStorage(message));
  if (messages.length > MAX_STORED) {
    messages.splice(0, messages.length - MAX_STORED);
  }
  saveAll(messages);
  return message;
}

function getRecentMessages(limit = DEFAULT_FETCH) {
  const messages = loadAll();
  return messages.slice(-limit);
}

module.exports = {
  appendMessage,
  getRecentMessages,
  MAX_STORED,
  DEFAULT_FETCH,
};
