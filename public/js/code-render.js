const LANG_MAP = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cpp: 'cpp',
  cc: 'cpp',
  c: 'c',
  h: 'c',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  xml: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  vue: 'xml',
  dockerfile: 'dockerfile',
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function highlightMentions(text) {
  return text.replace(
    /@([\u4e00-\u9fa5\w-]+)/g,
    '<span class="mention-tag">@$1</span>'
  );
}

function highlightInlineCode(text) {
  return text.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
}

function highlightCode(lang, code) {
  const safe = escapeHtml(code);
  if (typeof hljs !== 'undefined') {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return safe;
    }
  }
  return safe;
}

function renderCodeBlock(lang, code) {
  const highlighted = highlightCode(lang, code);
  const label = lang ? escapeHtml(lang) : 'code';
  return `
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-lang">${label}</span>
        <button type="button" class="code-copy-btn" data-code="${encodeURIComponent(code)}">复制</button>
      </div>
      <pre><code class="hljs">${highlighted}</code></pre>
    </div>
  `;
}

function renderRichContent(content) {
  if (!content) return '';

  const parts = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(renderTextSegment(text));
    }
    parts.push(renderCodeBlock(match[1] || 'plaintext', match[2].replace(/\n$/, '')));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(renderTextSegment(content.slice(lastIndex)));
  }

  return parts.join('') || renderTextSegment(content);
}

function renderTextSegment(text) {
  const escaped = escapeHtml(text);
  const withMentions = highlightMentions(escaped);
  const withCode = highlightInlineCode(withMentions);
  return withCode.replace(/\n/g, '<br>');
}

function renderAttachmentCode(attachment) {
  const code = attachment.textContent || '';
  return renderCodeBlock(attachment.language || 'plaintext', code);
}

function bindCodeCopyButtons(container) {
  container.querySelectorAll('.code-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = decodeURIComponent(btn.dataset.code || '');
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = '已复制';
        setTimeout(() => {
          btn.textContent = '复制';
        }, 1500);
      } catch {
        btn.textContent = '失败';
      }
    });
  });
}

function detectLanguage(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return LANG_MAP[ext] || 'plaintext';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(category, fileName) {
  if (category === 'image') return '🖼️';
  if (category === 'code') return '💻';
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(ext)) return '📕';
  if (['doc', 'docx'].includes(ext)) return '📄';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z'].includes(ext)) return '📦';
  return '📎';
}

function renderAttachmentHtml(attachment) {
  if (!attachment) return '';

  if (attachment.category === 'image') {
    return `
      <div class="msg-attachment msg-image">
        <img src="${attachment.data}" alt="${escapeHtml(attachment.fileName)}" loading="lazy" />
      </div>
    `;
  }

  if (attachment.category === 'code') {
    return `<div class="msg-attachment msg-code-file">${renderAttachmentCode(attachment)}</div>`;
  }

  const icon = getFileIcon('document', attachment.fileName);
  const size = formatFileSize(attachment.size || 0);
  return `
    <a class="msg-attachment msg-file" href="${attachment.data}" download="${escapeHtml(attachment.fileName)}">
      <span class="file-icon">${icon}</span>
      <span class="file-info">
        <span class="file-name">${escapeHtml(attachment.fileName)}</span>
        <span class="file-size">${size}</span>
      </span>
      <span class="file-download">下载</span>
    </a>
  `;
}

function getReplyPreviewText(msg) {
  if (msg.attachment?.category === 'image') return '[图片]';
  if (msg.attachment?.category === 'code') return `[代码] ${msg.attachment.fileName}`;
  if (msg.attachment?.category === 'document') return `[文件] ${msg.attachment.fileName}`;
  return msg.content || '';
}

function getCopyText(msg) {
  if (msg.attachment?.category === 'code') return msg.attachment.textContent || '';
  if (msg.content) return msg.content;
  return msg.attachment?.fileName || '';
}
