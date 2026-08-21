export const ATTACHMENT_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.txt',
  '.md',
  '.zip',
].join(',');

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_FILES_PER_SELECTION = 10;
const ALLOWED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'ppt', 'pptx', 'csv', 'txt', 'md', 'zip',
]);

export function collectAttachmentFiles(fileList: FileList | null): { files: File[]; error?: string } {
  const selected = Array.from(fileList || []);
  if (selected.length > MAX_FILES_PER_SELECTION) {
    return { files: [], error: `Puedes adjuntar hasta ${MAX_FILES_PER_SELECTION} archivos a la vez.` };
  }

  for (const file of selected) {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return { files: [], error: `“${file.name}” no es un formato permitido.` };
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { files: [], error: `“${file.name}” supera el límite de 20 MB.` };
    }
  }

  return { files: selected };
}
