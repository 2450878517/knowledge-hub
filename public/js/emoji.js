const EMOJI_CATEGORIES = [
  {
    id: 'common',
    label: '常用',
    emojis: ['😀', '😂', '🥰', '😎', '🤔', '👍', '👏', '🎉', '❤️', '🔥', '✨', '💯'],
  },
  {
    id: 'face',
    label: '表情',
    emojis: ['😊', '😁', '😅', '🤣', '😇', '🙂', '😉', '😍', '🥳', '😴', '😭', '😤', '🙄', '😱', '🤗', '🤩'],
  },
  {
    id: 'gesture',
    label: '手势',
    emojis: ['👋', '🤝', '✌️', '🤞', '👌', '🙏', '💪', '🫡', '👀', '💬', '🙌', '🤷'],
  },
  {
    id: 'object',
    label: '物品',
    emojis: ['☕', '🍕', '🎮', '📚', '💡', '🚀', '⭐', '🌈', '🎵', '📷', '🎁', '💻'],
  },
];

const FAVORITES_KEY = 'knowledge-hub-favorite-emojis';
const CUSTOM_EMOJI_KEY = 'knowledge-hub-custom-emojis';
const DEFAULT_FAVORITES = ['😀', '👍', '❤️', '🎉', '🔥'];
const MAX_CUSTOM_EMOJIS = 24;
const MAX_CUSTOM_EMOJI_BYTES = 500 * 1024;

function getFavoriteEmojis() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {
    /* ignore */
  }
  return [...DEFAULT_FAVORITES];
}

function saveFavoriteEmojis(list) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
}

function toggleFavoriteEmoji(emoji) {
  const list = getFavoriteEmojis();
  const idx = list.indexOf(emoji);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift(emoji);
    if (list.length > 24) list.length = 24;
  }
  saveFavoriteEmojis(list);
  return list;
}

function isFavoriteEmoji(emoji) {
  return getFavoriteEmojis().includes(emoji);
}

function getAllEmojis() {
  const seen = new Set();
  const all = [];
  for (const cat of EMOJI_CATEGORIES) {
    for (const e of cat.emojis) {
      if (!seen.has(e)) {
        seen.add(e);
        all.push(e);
      }
    }
  }
  return all;
}

function getCustomEmojis() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_EMOJI_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    /* ignore */
  }
  return [];
}

function saveCustomEmojis(list) {
  localStorage.setItem(CUSTOM_EMOJI_KEY, JSON.stringify(list));
}

function addCustomEmoji(dataUrl, name) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    throw new Error('只能收藏图片');
  }
  if (dataUrl.length > MAX_CUSTOM_EMOJI_BYTES) {
    throw new Error('图片过大，无法收藏（最大 500KB）');
  }

  const list = getCustomEmojis();
  if (list.some((item) => item.data === dataUrl)) {
    throw new Error('该图片已在表情收藏中');
  }

  const item = {
    id: `ce-${Date.now()}`,
    data: dataUrl,
    name: (name || '表情').slice(0, 40),
    createdAt: Date.now(),
  };

  list.unshift(item);
  if (list.length > MAX_CUSTOM_EMOJIS) list.length = MAX_CUSTOM_EMOJIS;
  saveCustomEmojis(list);
  return item;
}

function removeCustomEmoji(id) {
  const list = getCustomEmojis().filter((item) => item.id !== id);
  saveCustomEmojis(list);
  return list;
}

function buildImageAttachmentFromCustom(custom) {
  const mimeMatch = custom.data.match(/^data:([^;]+);/);
  return {
    category: 'image',
    fileName: custom.name || 'sticker.png',
    mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
    data: custom.data,
    size: custom.data.length,
  };
}
