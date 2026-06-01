const socket = io();

const AVATAR_OPTIONS = ['😀', '😎', '🦊', '🐱', '🐶', '🌟', '🚀', '💡', '🎮', '🎨', '📚', '🔥'];
const STATUS_LABELS = { online: '在线', away: '离开', busy: '忙碌' };
const MAX_AVATAR_BYTES = 500 * 1024;

const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const profileScreen = document.getElementById('profile-screen');
const profileAvatarOptionsEl = document.getElementById('profile-avatar-options');
const myAvatarPreview = document.getElementById('my-avatar-preview');
const profileNickname = document.getElementById('profile-nickname');
const profileAvatarUpload = document.getElementById('profile-avatar-upload');
const profileSaveBtn = document.getElementById('profile-save-btn');
const profileError = document.getElementById('profile-error');
const statusRadios = document.querySelectorAll('input[name="status"]');
const settingsModal = document.getElementById('settings-modal');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsBtnMobile = document.getElementById('settings-btn-mobile');
const profilePageBtn = document.getElementById('profile-page-btn');
const openProfileBtn = document.getElementById('open-profile-btn');
const logoutBtn = document.getElementById('logout-btn');
const settingsAccountName = document.getElementById('settings-account-name');
const sidebarMeBtn = document.getElementById('sidebar-me-btn');
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarUsername = document.getElementById('sidebar-username');
const sidebarStatusLabel = document.getElementById('sidebar-status-label');
const settingsNavBtns = document.querySelectorAll('.settings-nav-btn');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesEl = document.getElementById('messages');
const userListEl = document.getElementById('user-list');
const onlineCountEl = document.getElementById('online-count');
const typingIndicator = document.getElementById('typing-indicator');
const replyBar = document.getElementById('reply-bar');
const replyBarText = document.getElementById('reply-bar-text');
const replyCancelBtn = document.getElementById('reply-cancel-btn');
const emojiToggleBtn = document.getElementById('emoji-toggle-btn');
const emojiPanel = document.getElementById('emoji-panel');
const emojiTabs = document.getElementById('emoji-tabs');
const emojiGrid = document.getElementById('emoji-grid');
const mentionPopup = document.getElementById('mention-popup');
const mentionList = document.getElementById('mention-list');
const mentionToasts = document.getElementById('mention-toasts');
const chatMain = document.getElementById('chat-main');
const dropOverlay = document.getElementById('drop-overlay');
const attachmentPreview = document.getElementById('attachment-preview');
const attachmentPreviewLabel = document.getElementById('attachment-preview-label');
const attachmentCancelBtn = document.getElementById('attachment-cancel-btn');
const fileAttachBtn = document.getElementById('file-attach-btn');
const fileInput = document.getElementById('file-input');
const msgContextMenu = document.getElementById('msg-context-menu');

let currentUsername = '';
let currentAccount = '';
let currentUser = null;
let currentAvatar = AVATAR_OPTIONS[0];
let currentStatus = 'online';
let profileSelectedAvatar = null;
let profilePage = null;
let authUI = null;
let hasJoinedChat = false;
let onlineUsers = [];
let typingTimeout = null;
let pendingReply = null;
let activeEmojiTab = 'favorites';
let mentionQuery = '';
let mentionStart = -1;
let mentionActiveIndex = 0;
let activeSettingsTab = 'profile';
let pendingAttachment = null;
let contextMenuMsg = null;
let longPressTimer = null;
let dragCounter = 0;
const typingUsers = new Set();

function showError(msg, el) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(el) {
  if (!el) return;
  el.classList.add('hidden');
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncateText(text, maxLen = 60) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function renderAvatarHtml(avatar, className = 'avatar') {
  if (avatar && avatar.startsWith('data:image/')) {
    return `<img class="${className} avatar-img" src="${avatar}" alt="" />`;
  }
  return `<span class="${className}" aria-hidden="true">${escapeHtml(avatar || '😀')}</span>`;
}

function setAvatarPreview(el, avatar) {
  if (avatar && avatar.startsWith('data:image/')) {
    el.innerHTML = `<img class="avatar-img" src="${avatar}" alt="" />`;
  } else {
    el.textContent = avatar || '😀';
  }
}

function readAvatarFile(file, onSuccess, onError) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    onError('请选择图片文件（JPG、PNG、GIF、WebP）');
    return;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    onError('图片不能超过 500KB');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onSuccess(reader.result);
  reader.onerror = () => onError('图片读取失败');
  reader.readAsDataURL(file);
}

function buildAvatarPicker(container, onSelect, selected) {
  container.innerHTML = AVATAR_OPTIONS.map(
    (emoji) => `
      <button type="button" class="avatar-option${emoji === selected ? ' is-selected' : ''}" data-avatar="${emoji}" aria-label="头像 ${emoji}">
        ${emoji}
      </button>
    `
  ).join('');

  container.querySelectorAll('.avatar-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      onSelect(btn.dataset.avatar);
      container.querySelectorAll('.avatar-option').forEach((b) => {
        b.classList.toggle('is-selected', b === btn);
      });
    });
  });
}

function initSettingsAvatarPicker() {
  buildAvatarPicker(profileAvatarOptionsEl, (emoji) => {
    profileSelectedAvatar = emoji;
    profileAvatarUpload.value = '';
    setAvatarPreview(myAvatarPreview, emoji);
  }, typeof currentAvatar === 'string' && !currentAvatar.startsWith('data:') ? currentAvatar : null);
}

function applyUserState(user) {
  currentUser = user;
  currentAccount = user.account;
  currentUsername = user.displayName;
  currentAvatar = user.avatar;
  if (settingsAccountName) settingsAccountName.textContent = user.account;
  updateSidebarMe();
  syncProfilePanel();
  profilePage?.refreshOwn(user);
}

profileAvatarUpload.addEventListener('change', () => {
  const file = profileAvatarUpload.files[0];
  readAvatarFile(
    file,
    (dataUrl) => {
      profileSelectedAvatar = dataUrl;
      setAvatarPreview(myAvatarPreview, dataUrl);
      profileAvatarOptionsEl.querySelectorAll('.avatar-option').forEach((b) => {
        b.classList.remove('is-selected');
      });
      hideError(profileError);
    },
    (msg) => showError(msg, profileError)
  );
});

function addSystemMessage(text) {
  const el = document.createElement('div');
  el.className = 'message system';
  el.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function buildReplyQuote(replyTo) {
  if (!replyTo) return '';
  return `
    <div class="message-reply">
      <span class="message-reply-author">${escapeHtml(replyTo.username)}</span>
      <span class="message-reply-content">${escapeHtml(truncateText(replyTo.content, 80))}</span>
    </div>
  `;
}

function setupMessageInteractions(el, msg) {
  const bubble = el.querySelector('.message-bubble');
  if (!bubble) return;

  bubble.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, msg);
  });

  bubble.addEventListener('touchstart', (e) => {
    longPressTimer = setTimeout(() => {
      const touch = e.touches[0];
      showContextMenu(touch.clientX, touch.clientY, msg);
    }, 500);
  }, { passive: true });

  bubble.addEventListener('touchend', () => clearTimeout(longPressTimer));
  bubble.addEventListener('touchmove', () => clearTimeout(longPressTimer));
}

function showContextMenu(x, y, msg) {
  contextMenuMsg = msg;
  const saveStickerBtn = msgContextMenu.querySelector('[data-action="save-sticker"]');
  if (msg.attachment?.category === 'image') {
    saveStickerBtn.classList.remove('hidden');
  } else {
    saveStickerBtn.classList.add('hidden');
  }
  msgContextMenu.classList.remove('hidden');
  const menuW = 140;
  const menuH = msg.attachment?.category === 'image' ? 120 : 80;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);
  msgContextMenu.style.left = `${left}px`;
  msgContextMenu.style.top = `${top}px`;
}

function hideContextMenu() {
  msgContextMenu.classList.add('hidden');
  contextMenuMsg = null;
}

function addMessage(msg, options = {}) {
  const { username, avatar, content, timestamp, isSelf, replyTo, mentions, attachment, isBot } = msg;
  const isMentioned = mentions?.includes(currentUsername) && !isSelf;
  const hasWide = attachment?.category === 'image' || attachment?.category === 'code' || (content && content.includes('```'));

  const el = document.createElement('div');
  el.className = `message${isSelf ? ' is-self' : ''}${isMentioned ? ' is-mentioned' : ''}${hasWide ? ' is-wide' : ''}${isBot ? ' is-bot' : ''}`;
  el.innerHTML = `
    ${renderAvatarHtml(avatar, 'message-avatar')}
    <div class="message-inner">
      <div class="message-meta">
        <span class="message-username">${escapeHtml(username)}</span>
        <span class="message-time">${formatTime(timestamp)}</span>
      </div>
      <div class="message-body">
        <div class="message-bubble" title="右键或长按操作">
          ${buildReplyQuote(replyTo)}
          ${content ? `<div class="message-content">${renderRichContent(content)}</div>` : ''}
          ${renderAttachmentHtml(attachment)}
        </div>
        <div class="message-actions">
          <button type="button" class="msg-action-btn" data-action="copy" title="复制">复制</button>
          <button type="button" class="msg-action-btn" data-action="reply" title="回复">回复</button>
          ${attachment?.category === 'image' ? '<button type="button" class="msg-action-btn" data-action="save-sticker" title="收藏为表情">收藏</button>' : ''}
        </div>
      </div>
    </div>
  `;

  bindCodeCopyButtons(el);
  if (!isBot) {
    el.querySelector('[data-action="copy"]').addEventListener('click', (e) => {
      copyMessage(getCopyText(msg), e.currentTarget);
    });
    el.querySelector('[data-action="reply"]').addEventListener('click', () => startReply(msg));
    el.querySelector('[data-action="save-sticker"]')?.addEventListener('click', (e) => {
      saveMessageImageAsSticker(msg, e.currentTarget);
    });
    setupMessageInteractions(el, msg);
  } else {
    el.querySelector('.message-actions')?.remove();
  }

  messagesEl.appendChild(el);
  if (options.scroll !== false) scrollToBottom();
}

function loadMessageHistory(messages) {
  messages.forEach((msg) => addMessage(msg, { scroll: false }));
  scrollToBottom();
}

async function copyMessage(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    showActionFeedback(btn, '已复制');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showActionFeedback(btn, '已复制');
  }
}

function showActionFeedback(btn, text) {
  const original = btn.textContent;
  btn.textContent = text;
  btn.classList.add('is-active');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('is-active');
  }, 1500);
}

function startReply(msg) {
  const preview = getReplyPreviewText(msg);
  pendingReply = {
    username: msg.username,
    content: preview,
    ...(msg.attachment && {
      attachment: {
        category: msg.attachment.category,
        fileName: msg.attachment.fileName,
      },
    }),
  };
  replyBarText.textContent = `${msg.username}: ${truncateText(preview)}`;
  replyBar.classList.remove('hidden');
  messageInput.placeholder = `回复 ${msg.username}...`;
  messageInput.focus();
  hideContextMenu();
}

function cancelReply() {
  pendingReply = null;
  replyBar.classList.add('hidden');
  messageInput.placeholder = '输入消息，@ 提及 · ```js 代码块 · 拖拽文件发送...';
}

async function handleFileSelect(file) {
  try {
    pendingAttachment = await processFileForUpload(file);
    showAttachmentPreview();
  } catch (err) {
    addSystemMessage(err.message || '文件处理失败');
  }
}

function showAttachmentPreview() {
  if (!pendingAttachment) return;
  attachmentPreviewLabel.textContent = getAttachmentPreviewLabel(pendingAttachment);
  attachmentPreview.classList.remove('hidden');
}

function clearAttachment() {
  pendingAttachment = null;
  attachmentPreview.classList.add('hidden');
  fileInput.value = '';
}

function autoResizeInput() {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
}

function getStatusHtml(status) {
  const cls = `user-status status-${status || 'online'}`;
  const label = STATUS_LABELS[status] || '在线';
  return `<span class="${cls}" title="${label}"></span>`;
}

function renderUserList(users) {
  onlineUsers = users;
  onlineCountEl.textContent = users.length;
  userListEl.innerHTML = users
    .map(
      (u) => `
      <li class="user-list-item${u.username === currentUsername ? ' is-self' : ''}" data-account="${escapeHtml(u.account || '')}">
        ${renderAvatarHtml(u.avatar, 'user-avatar')}
        <div class="user-info">
          <span class="user-name">${escapeHtml(u.username)}${u.username === currentUsername ? ' (我)' : ''}</span>
          <span class="user-status-label">${STATUS_LABELS[u.status] || '在线'}</span>
        </div>
        ${getStatusHtml(u.status)}
      </li>
    `
    )
    .join('');

  userListEl.querySelectorAll('.user-list-item[data-account]').forEach((li) => {
    const account = li.dataset.account;
    if (!account) return;
    li.addEventListener('click', () => {
      chatScreen.classList.add('hidden');
      profilePage.open(account);
    });
  });
}

function updateTypingIndicator() {
  if (typingUsers.size === 0) {
    typingIndicator.classList.add('hidden');
    return;
  }

  const names = Array.from(typingUsers);
  let text;
  if (names.length === 1) {
    text = `${names[0]} 正在输入...`;
  } else if (names.length === 2) {
    text = `${names[0]} 和 ${names[1]} 正在输入...`;
  } else {
    text = `${names.length} 人正在输入...`;
  }

  typingIndicator.textContent = text;
  typingIndicator.classList.remove('hidden');
}

function getMentionCandidates(query) {
  return onlineUsers.filter(
    (u) =>
      u.username !== currentUsername &&
      u.username.toLowerCase().includes(query.toLowerCase())
  );
}

function closeMentionPopup() {
  mentionPopup.classList.add('hidden');
  mentionQuery = '';
  mentionStart = -1;
  mentionActiveIndex = 0;
}

function renderMentionPopup() {
  const candidates = getMentionCandidates(mentionQuery);
  if (candidates.length === 0) {
    closeMentionPopup();
    return;
  }

  if (mentionActiveIndex >= candidates.length) {
    mentionActiveIndex = candidates.length - 1;
  }

  mentionList.innerHTML = candidates
    .map(
      (u, i) => `
      <li class="mention-item${i === mentionActiveIndex ? ' is-active' : ''}" data-username="${escapeHtml(u.username)}">
        ${renderAvatarHtml(u.avatar, 'mention-avatar')}
        <span>${escapeHtml(u.username)}</span>
        <span class="mention-status">${STATUS_LABELS[u.status] || '在线'}</span>
      </li>
    `
    )
    .join('');

  mentionList.querySelectorAll('.mention-item').forEach((item, i) => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectMention(candidates[i].username);
    });
  });

  mentionPopup.classList.remove('hidden');
}

function detectMention() {
  const pos = messageInput.selectionStart ?? messageInput.value.length;
  const textBefore = messageInput.value.slice(0, pos);
  const atMatch = textBefore.match(/@([\u4e00-\u9fa5\w-]*)$/);

  if (!atMatch) {
    closeMentionPopup();
    return;
  }

  mentionStart = pos - atMatch[0].length;
  mentionQuery = atMatch[1];
  mentionActiveIndex = 0;
  renderMentionPopup();
}

function selectMention(username) {
  const pos = messageInput.selectionStart ?? messageInput.value.length;
  const before = messageInput.value.slice(0, mentionStart);
  const after = messageInput.value.slice(pos);
  const insert = `@${username} `;
  messageInput.value = before + insert + after;
  const newPos = before.length + insert.length;
  messageInput.setSelectionRange(newPos, newPos);
  messageInput.focus();
  closeMentionPopup();
}

function showMentionToast({ from, avatar, content }) {
  const toast = document.createElement('div');
  toast.className = 'mention-toast';
  toast.innerHTML = `
    ${renderAvatarHtml(avatar, 'toast-avatar')}
    <div class="toast-body">
      <strong>@${escapeHtml(currentUsername)}</strong>
      <span>${escapeHtml(from)} 提到了你</span>
      <p>${escapeHtml(truncateText(content, 80))}</p>
    </div>
    <button type="button" class="toast-close" aria-label="关闭">×</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  mentionToasts.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-fading');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function insertEmoji(emoji) {
  const start = messageInput.selectionStart ?? messageInput.value.length;
  const end = messageInput.selectionEnd ?? messageInput.value.length;
  const before = messageInput.value.slice(0, start);
  const after = messageInput.value.slice(end);
  messageInput.value = before + emoji + after;
  const pos = start + emoji.length;
  messageInput.setSelectionRange(pos, pos);
  messageInput.focus();
  messageInput.dispatchEvent(new Event('input'));
}

function saveMessageImageAsSticker(msg, btn) {
  hideContextMenu();
  if (msg.attachment?.category !== 'image') return;
  try {
    addCustomEmoji(msg.attachment.data, msg.attachment.fileName);
    if (btn) showActionFeedback(btn, '已收藏');
    else addSystemMessage('图片已收藏为表情，在 😊 → 表情图 中使用');
  } catch (err) {
    addSystemMessage(err.message || '收藏失败');
  }
}

function sendCustomEmojiSticker(custom) {
  if (!hasJoinedChat) return;
  const attachment = buildImageAttachmentFromCustom(custom);
  const payload = {
    content: '',
    ...(pendingReply && { replyTo: pendingReply }),
    attachment,
  };
  socket.emit('message', payload);
  cancelReply();
  closeEmojiPanel();
  socket.emit('typing', false);
}

function renderEmojiTabs() {
  const tabs = [
    { id: 'favorites', label: '收藏' },
    { id: 'stickers', label: '表情图' },
    ...EMOJI_CATEGORIES,
  ];
  emojiTabs.innerHTML = tabs
    .map(
      (tab) => `
      <button type="button" class="emoji-tab${tab.id === activeEmojiTab ? ' is-active' : ''}" data-tab="${tab.id}">
        ${tab.label}
      </button>
    `
    )
    .join('');

  emojiTabs.querySelectorAll('.emoji-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeEmojiTab = btn.dataset.tab;
      renderEmojiTabs();
      renderEmojiGrid();
    });
  });
}

function renderEmojiGrid() {
  if (activeEmojiTab === 'stickers') {
    const stickers = getCustomEmojis();
    if (stickers.length === 0) {
      emojiGrid.innerHTML = '<p class="emoji-empty">暂无表情图<br>右键聊天图片 →「收藏为表情」</p>';
      return;
    }
    emojiGrid.innerHTML = stickers
      .map(
        (item) => `
        <div class="emoji-item emoji-img-item">
          <button type="button" class="emoji-img-btn" data-sticker-id="${item.id}" title="${escapeHtml(item.name)}">
            <img src="${item.data}" alt="${escapeHtml(item.name)}" />
          </button>
          <button type="button" class="emoji-remove-btn" data-remove-id="${item.id}" title="删除">×</button>
        </div>
      `
      )
      .join('');

    emojiGrid.querySelectorAll('.emoji-img-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const custom = getCustomEmojis().find((s) => s.id === btn.dataset.stickerId);
        if (custom) sendCustomEmojiSticker(custom);
      });
    });

    emojiGrid.querySelectorAll('.emoji-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCustomEmoji(btn.dataset.removeId);
        renderEmojiGrid();
      });
    });
    return;
  }

  let emojis;
  if (activeEmojiTab === 'favorites') {
    emojis = getFavoriteEmojis();
    if (emojis.length === 0) {
      emojiGrid.innerHTML = '<p class="emoji-empty">暂无收藏，在其他分类中点击 ☆ 添加</p>';
      return;
    }
  } else {
    const category = EMOJI_CATEGORIES.find((c) => c.id === activeEmojiTab);
    emojis = category ? category.emojis : [];
  }

  emojiGrid.innerHTML = emojis
    .map(
      (emoji) => `
      <div class="emoji-item">
        <button type="button" class="emoji-btn" data-emoji="${emoji}">${emoji}</button>
        <button type="button" class="emoji-fav-btn${isFavoriteEmoji(emoji) ? ' is-fav' : ''}" data-fav="${emoji}" title="${isFavoriteEmoji(emoji) ? '取消收藏' : '收藏'}">★</button>
      </div>
    `
    )
    .join('');

  emojiGrid.querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.addEventListener('click', () => insertEmoji(btn.dataset.emoji));
  });

  emojiGrid.querySelectorAll('.emoji-fav-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavoriteEmoji(btn.dataset.fav);
      renderEmojiGrid();
      if (activeEmojiTab === 'favorites') renderEmojiTabs();
    });
  });
}

function toggleEmojiPanel() {
  const isOpen = !emojiPanel.classList.contains('hidden');
  if (isOpen) {
    emojiPanel.classList.add('hidden');
  } else {
    renderEmojiTabs();
    renderEmojiGrid();
    emojiPanel.classList.remove('hidden');
  }
}

function closeEmojiPanel() {
  emojiPanel.classList.add('hidden');
}

function syncProfilePanel() {
  profileNickname.value = currentUsername;
  setAvatarPreview(myAvatarPreview, currentAvatar);
  profileSelectedAvatar = currentAvatar;
  statusRadios.forEach((radio) => {
    radio.checked = radio.value === currentStatus;
  });
  buildAvatarPicker(profileAvatarOptionsEl, (emoji) => {
    profileSelectedAvatar = emoji;
    profileAvatarUpload.value = '';
    setAvatarPreview(myAvatarPreview, emoji);
  }, typeof currentAvatar === 'string' && !currentAvatar.startsWith('data:') ? currentAvatar : null);
  updateSidebarMe();
}

function enterChat(user) {
  applyUserState(user);
  authScreen.classList.add('hidden');
  profileScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  messagesEl.innerHTML = '';
  hasJoinedChat = false;
  socket.emit('join', { token: getToken() });
}

function leaveChat() {
  hasJoinedChat = false;
  logout();
  socket.disconnect();
  socket.connect();
  chatScreen.classList.add('hidden');
  profileScreen.classList.add('hidden');
  settingsModal.classList.add('hidden');
  document.body.style.overflow = '';
  authUI.show();
}

function updateSidebarMe() {
  setAvatarPreview(sidebarAvatar, currentAvatar);
  sidebarUsername.textContent = currentUsername || '—';
  sidebarStatusLabel.textContent = STATUS_LABELS[currentStatus] || '在线';
}

function openSettings(tab = 'profile') {
  activeSettingsTab = tab;
  switchSettingsTab(tab);
  syncProfilePanel();
  hideError(profileError);
  settingsModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function switchSettingsTab(tab) {
  activeSettingsTab = tab;
  settingsNavBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.settingsTab === tab);
  });
  document.getElementById('settings-profile').classList.toggle('hidden', tab !== 'profile');
  document.getElementById('settings-status').classList.toggle('hidden', tab !== 'status');
  document.getElementById('settings-account').classList.toggle('hidden', tab !== 'account');
}

initSettingsAvatarPicker();

profileSaveBtn.addEventListener('click', () => {
  hideError(profileError);
  const username = profileNickname.value.trim();
  if (!username) {
    showError('昵称不能为空', profileError);
    return;
  }
  socket.emit('update-profile', {
    username,
    avatar: profileSelectedAvatar ?? currentAvatar,
  });
});

statusRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    currentStatus = radio.value;
    socket.emit('set-status', currentStatus);
    updateSidebarMe();
  });
});

settingsBtn.addEventListener('click', () => openSettings());
settingsBtnMobile.addEventListener('click', () => openSettings());
sidebarMeBtn.addEventListener('click', () => profilePage.open(currentAccount));
profilePageBtn.addEventListener('click', () => profilePage.open(currentAccount));
openProfileBtn.addEventListener('click', () => {
  closeSettings();
  chatScreen.classList.add('hidden');
  profilePage.open(currentAccount);
});
logoutBtn.addEventListener('click', () => {
  closeSettings();
  leaveChat();
});
settingsCloseBtn.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

settingsNavBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchSettingsTab(btn.dataset.settingsTab));
});

replyCancelBtn.addEventListener('click', cancelReply);
attachmentCancelBtn.addEventListener('click', clearAttachment);

fileAttachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (file) await handleFileSelect(file);
});

chatMain.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter += 1;
  dropOverlay.classList.remove('hidden');
});

chatMain.addEventListener('dragleave', (e) => {
  if (!chatMain.contains(e.relatedTarget)) {
    dragCounter -= 1;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.add('hidden');
    }
  }
});

chatMain.addEventListener('dragover', (e) => e.preventDefault());

chatMain.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.add('hidden');
  const file = e.dataTransfer.files[0];
  if (file) await handleFileSelect(file);
});

msgContextMenu.querySelector('[data-action="reply"]').addEventListener('click', () => {
  if (contextMenuMsg) startReply(contextMenuMsg);
});

msgContextMenu.querySelector('[data-action="copy"]').addEventListener('click', () => {
  if (contextMenuMsg) {
    copyMessage(getCopyText(contextMenuMsg), msgContextMenu.querySelector('[data-action="copy"]'));
  }
  hideContextMenu();
});

msgContextMenu.querySelector('[data-action="save-sticker"]').addEventListener('click', () => {
  if (contextMenuMsg) saveMessageImageAsSticker(contextMenuMsg);
});

document.addEventListener('click', (e) => {
  if (!msgContextMenu.contains(e.target)) hideContextMenu();
  if (!emojiPanel.contains(e.target) && e.target !== emojiToggleBtn) {
    closeEmojiPanel();
  }
});

emojiToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleEmojiPanel();
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text && !pendingAttachment) return;

  const payload = {
    content: text,
    ...(pendingReply && { replyTo: pendingReply }),
    ...(pendingAttachment && { attachment: pendingAttachment }),
  };

  socket.emit('message', payload);
  messageInput.value = '';
  autoResizeInput();
  cancelReply();
  clearAttachment();
  closeEmojiPanel();
  closeMentionPopup();
  socket.emit('typing', false);
});

socket.on('error', ({ message, code }) => {
  if (code === 'AUTH_EXPIRED') {
    leaveChat();
    return;
  }
  if (!chatScreen.classList.contains('hidden')) {
    showError(message, profileError);
  }
});

socket.on('joined', ({ username, avatar, status, users, user, history }) => {
  hasJoinedChat = true;
  if (user) applyUserState(user);
  else {
    currentUsername = username;
    currentAvatar = avatar;
  }
  currentStatus = status || 'online';
  authScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  messagesEl.innerHTML = '';
  if (history?.length) {
    loadMessageHistory(history);
  }
  renderUserList(users);
  syncProfilePanel();
  addSystemMessage(`欢迎回来，${username}！输入 /time 可查询当前时间`);
  messageInput.focus();
});

socket.on('profile-updated', ({ username, avatar, user }) => {
  if (user) applyUserState(user);
  else {
    currentUsername = username;
    currentAvatar = avatar;
    profileSelectedAvatar = avatar;
    syncProfilePanel();
  }
  hideError(profileError);
});

socket.on('users-updated', ({ users }) => {
  renderUserList(users);
  const me = users.find((u) => u.username === currentUsername);
  if (me?.status) {
    currentStatus = me.status;
    updateSidebarMe();
  }
});

socket.on('user-joined', ({ username, users }) => {
  renderUserList(users);
  addSystemMessage(`${username} 加入了聊天室`);
});

socket.on('user-left', ({ username, users }) => {
  renderUserList(users);
  typingUsers.delete(username);
  updateTypingIndicator();
  addSystemMessage(`${username} 离开了聊天室`);
});

socket.on('message', (msg) => {
  addMessage(msg);
});

socket.on('mentioned', (data) => {
  showMentionToast(data);
});

socket.on('typing', ({ username, isTyping }) => {
  if (username === currentUsername) return;
  if (isTyping) {
    typingUsers.add(username);
  } else {
    typingUsers.delete(username);
  }
  updateTypingIndicator();
});

messageInput.addEventListener('input', () => {
  detectMention();
  autoResizeInput();
  socket.emit('typing', true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', false);
  }, 1500);
});

messageInput.addEventListener('keydown', (e) => {
  if (!mentionPopup.classList.contains('hidden')) {
    const candidates = getMentionCandidates(mentionQuery);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionActiveIndex = (mentionActiveIndex + 1) % candidates.length;
      renderMentionPopup();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionActiveIndex = (mentionActiveIndex - 1 + candidates.length) % candidates.length;
      renderMentionPopup();
      return;
    }
    if (e.key === 'Enter' && candidates.length > 0) {
      e.preventDefault();
      selectMention(candidates[mentionActiveIndex].username);
      return;
    }
    if (e.key === 'Escape') {
      closeMentionPopup();
      return;
    }
  }

  if (e.key === 'Enter' && !e.shiftKey && mentionPopup.classList.contains('hidden')) {
    e.preventDefault();
    messageForm.requestSubmit();
    return;
  }

  if (e.key === 'Escape') {
    if (!settingsModal.classList.contains('hidden')) {
      closeSettings();
      return;
    }
    if (pendingReply) cancelReply();
    closeEmojiPanel();
  }
});

socket.on('disconnect', () => {
  document.querySelector('.status-dot').style.background = 'var(--error)';
  document.querySelector('.status-text').textContent = '已断开';
  addSystemMessage('与服务器断开连接，请刷新页面重试');
});

socket.on('connect', () => {
  if (currentUsername && hasJoinedChat) {
    document.querySelector('.status-dot').style.background = 'var(--success)';
    document.querySelector('.status-text').textContent = '已连接';
    socket.emit('join', { token: getToken() });
  }
});

profilePage = initProfilePage({
  onBack: () => {
    profileScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
  },
  onSaved: (user) => {
    applyUserState(user);
    socket.emit('update-profile', {
      username: user.displayName,
      avatar: user.avatar,
    });
    addSystemMessage('个人主页已更新');
  },
  getCurrentAccount: () => currentAccount,
});

authUI = initAuthUI({
  onSuccess: (user) => enterChat(user),
});

tryAutoLogin(
  (user) => enterChat(user),
  () => authUI.show()
);
