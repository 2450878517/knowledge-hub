const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_DOC_SIZE = 1024 * 1024;
const MAX_CODE_SIZE = 500 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'cpp', 'cc', 'c', 'h',
  'cs', 'php', 'swift', 'kt', 'sql', 'sh', 'bash', 'zsh', 'json', 'xml', 'html',
  'htm', 'css', 'scss', 'md', 'yaml', 'yml', 'toml', 'vue', 'dockerfile', 'txt',
]);

function getFileExtension(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

function categorizeFile(file) {
  if (IMAGE_TYPES.includes(file.type)) return 'image';
  const ext = getFileExtension(file.name);
  if (CODE_EXTENSIONS.has(ext) || file.type.startsWith('text/')) return 'code';
  return 'document';
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

async function processFileForUpload(file) {
  const category = categorizeFile(file);

  if (category === 'image') {
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error('图片不能超过 2MB');
    }
    const data = await readFileAsDataURL(file);
    return {
      category: 'image',
      fileName: file.name,
      mimeType: file.type,
      data,
      size: file.size,
    };
  }

  if (category === 'code') {
    if (file.size > MAX_CODE_SIZE) {
      throw new Error('代码文件不能超过 500KB');
    }
    const textContent = await readFileAsText(file);
    if (!textContent.trim()) {
      throw new Error('文件内容为空');
    }
    return {
      category: 'code',
      fileName: file.name,
      mimeType: file.type || 'text/plain',
      language: detectLanguage(file.name),
      textContent,
      size: file.size,
    };
  }

  if (file.size > MAX_DOC_SIZE) {
    throw new Error('文件不能超过 1MB');
  }
  const data = await readFileAsDataURL(file);
  return {
    category: 'document',
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    data,
    size: file.size,
  };
}

function getAttachmentPreviewLabel(attachment) {
  if (!attachment) return '';
  if (attachment.category === 'image') return `🖼️ ${attachment.fileName}`;
  if (attachment.category === 'code') return `💻 ${attachment.fileName}`;
  return `📎 ${attachment.fileName}`;
}
