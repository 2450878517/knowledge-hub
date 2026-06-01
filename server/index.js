const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createApiRouter, isValidAvatar } = require('./api');
const { verifyToken } = require('./auth');
const { findById, updateUser, toPublicUser } = require('./db');
const { appendMessage, getRecentMessages } = require('./messages');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 3 * 1024 * 1024,
});

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '600kb' }));
app.use('/api', createApiRouter());
app.use(express.static(path.join(__dirname, '../public')));

const users = new Map();
const accountSockets = new Map();

const VALID_STATUSES = ['online', 'away', 'busy'];
const MAX_IMAGE_DATA = 2 * 1024 * 1024;
const MAX_FILE_DATA = 1024 * 1024;
const MAX_CODE_CHARS = 50000;

function getOnlineUsers() {
  return Array.from(users.values()).map(
    ({ id, userId, account, username, avatar, status, joinedAt }) => ({
      id,
      userId,
      account,
      username,
      avatar,
      status: status || 'online',
      joinedAt,
    })
  );
}

function extractMentions(content, senderUsername) {
  if (!content) return [];
  const matches = content.match(/@([\u4e00-\u9fa5\w-]+)/g) || [];
  const names = [...new Set(matches.map((m) => m.slice(1)))];
  const onlineNames = new Set(
    Array.from(users.values())
      .map((u) => u.username)
      .filter((n) => n !== senderUsername)
  );
  return names.filter((n) => onlineNames.has(n));
}

function validateAttachment(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const category = raw.category;
  if (!['image', 'document', 'code'].includes(category)) return null;

  const fileName = String(raw.fileName || 'file').slice(0, 100);
  const mimeType = String(raw.mimeType || 'application/octet-stream').slice(0, 80);

  if (category === 'code') {
    const textContent = String(raw.textContent || '');
    if (!textContent.trim()) return null;
    if (textContent.length > MAX_CODE_CHARS) return null;
    return {
      category,
      fileName,
      mimeType,
      language: String(raw.language || 'plaintext').slice(0, 30),
      textContent,
      size: textContent.length,
    };
  }

  const data = String(raw.data || '');
  if (!data.startsWith('data:')) return null;

  const maxSize = category === 'image' ? MAX_IMAGE_DATA : MAX_FILE_DATA;
  if (data.length > maxSize) return null;
  if (category === 'image' && !data.startsWith('data:image/')) return null;

  return {
    category,
    fileName,
    mimeType,
    data,
    size: Number(raw.size) || 0,
  };
}

function broadcastUsers() {
  io.emit('users-updated', { users: getOnlineUsers() });
}

const TIME_BOT = { username: '时间机器人', avatar: '⏰' };

function formatCurrentTime() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function emitBotMessage(content) {
  const message = {
    id: `bot-${Date.now()}`,
    username: TIME_BOT.username,
    avatar: TIME_BOT.avatar,
    content,
    timestamp: Date.now(),
    isBot: true,
    isSelf: false,
  };
  appendMessage(message);
  io.emit('message', message);
}

function buildReplyPreview(replyTo) {
  if (!replyTo) return undefined;
  const { username, content, attachment } = replyTo;
  if (!username) return undefined;
  let preview = String(content || '').slice(0, 200);
  if (attachment?.category === 'image') preview = '[图片]';
  else if (attachment?.category === 'code') preview = `[代码] ${attachment.fileName || ''}`;
  else if (attachment?.category === 'document') preview = `[文件] ${attachment.fileName || ''}`;
  return {
    username: String(username).slice(0, 20),
    content: preview || '[消息]',
    ...(attachment && {
      attachment: { category: attachment.category, fileName: attachment.fileName },
    }),
  };
}

function disconnectExistingSession(userId) {
  const oldSocketId = accountSockets.get(userId);
  if (oldSocketId && oldSocketId !== null) {
    const oldSocket = io.sockets.sockets.get(oldSocketId);
    if (oldSocket) {
      oldSocket.emit('error', { message: '账号已在其他窗口登录' });
      oldSocket.disconnect(true);
    }
  }
}

io.on('connection', (socket) => {
  socket.on('join', (payload) => {
    const token = payload?.token;
    if (!token) {
      socket.emit('error', { message: '请先登录后再进入聊天室' });
      return;
    }

    const auth = verifyToken(token);
    if (!auth) {
      socket.emit('error', { message: '登录已过期，请重新登录', code: 'AUTH_EXPIRED' });
      return;
    }

    const dbUser = findById(auth.userId);
    if (!dbUser) {
      socket.emit('error', { message: '用户不存在', code: 'AUTH_EXPIRED' });
      return;
    }

    disconnectExistingSession(dbUser.id);

    users.set(socket.id, {
      id: socket.id,
      userId: dbUser.id,
      account: dbUser.account,
      username: dbUser.displayName,
      avatar: dbUser.avatar,
      status: 'online',
      joinedAt: Date.now(),
    });
    accountSockets.set(dbUser.id, socket.id);

    const history = getRecentMessages().map((msg) => ({
      ...msg,
      isSelf: msg.account === dbUser.account,
    }));

    socket.emit('joined', {
      username: dbUser.displayName,
      account: dbUser.account,
      avatar: dbUser.avatar,
      status: 'online',
      user: toPublicUser(dbUser),
      users: getOnlineUsers(),
      history,
    });

    socket.broadcast.emit('user-joined', {
      username: dbUser.displayName,
      account: dbUser.account,
      avatar: dbUser.avatar,
      status: 'online',
      users: getOnlineUsers(),
    });
  });

  socket.on('update-profile', (payload) => {
    const session = users.get(socket.id);
    if (!session || !payload) return;

    try {
      const patch = {};
      if (payload.username !== undefined) patch.displayName = payload.username;
      if (payload.avatar !== undefined && isValidAvatar(payload.avatar)) {
        patch.avatar = payload.avatar;
      }
      const updated = updateUser(session.userId, patch);
      if (!updated) return;

      session.username = updated.displayName;
      session.avatar = updated.avatar;

      socket.emit('profile-updated', {
        username: updated.displayName,
        avatar: updated.avatar,
        user: toPublicUser(updated),
      });
      broadcastUsers();
    } catch (err) {
      socket.emit('error', { message: err.message || '更新失败' });
    }
  });

  socket.on('set-status', (status) => {
    const user = users.get(socket.id);
    if (!user || !VALID_STATUSES.includes(status)) return;
    user.status = status;
    broadcastUsers();
  });

  socket.on('message', (payload) => {
    const user = users.get(socket.id);
    if (!user) return;

    const content = (
      typeof payload === 'string' ? payload : payload?.content || ''
    ).trim();

    const attachment = payload?.attachment
      ? validateAttachment(payload.attachment)
      : null;

    if (!content && !attachment) return;

    if (payload?.attachment && !attachment) {
      socket.emit('error', { message: '文件无效或超出大小限制' });
      return;
    }

    if (content.toLowerCase() === '/time' && !attachment) {
      emitBotMessage(`🕐 当前时间：${formatCurrentTime()}`);
      return;
    }

    const replyTo = buildReplyPreview(
      payload && typeof payload === 'object' ? payload.replyTo : null
    );

    const mentions = extractMentions(content, user.username);

    const message = {
      id: `${socket.id}-${Date.now()}`,
      username: user.username,
      account: user.account,
      avatar: user.avatar,
      content,
      timestamp: Date.now(),
      isSelf: false,
      ...(replyTo && { replyTo }),
      ...(attachment && { attachment }),
      ...(mentions.length > 0 && { mentions }),
    };

    appendMessage(message);

    socket.emit('message', { ...message, isSelf: true });
    socket.broadcast.emit('message', message);

    for (const [id, u] of users) {
      if (mentions.includes(u.username)) {
        io.to(id).emit('mentioned', {
          from: user.username,
          avatar: user.avatar,
          content: content || attachment?.fileName || '',
          messageId: message.id,
          timestamp: message.timestamp,
        });
      }
    }
  });

  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('typing', {
      username: user.username,
      isTyping: Boolean(isTyping),
    });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;

    if (accountSockets.get(user.userId) === socket.id) {
      accountSockets.delete(user.userId);
    }
    users.delete(socket.id);

    io.emit('user-left', {
      username: user.username,
      users: getOnlineUsers(),
    });
  });
});

server.listen(PORT, () => {
  console.log(`聊天室已启动: http://localhost:${PORT}`);
});

module.exports = { io, users, broadcastUsers };
