import { ApiError } from './http';

const MIME_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/gif': ['gif'], 'image/webp': ['webp'],
  'application/pdf': ['pdf'], 'text/plain': ['txt', 'md'], 'text/csv': ['csv'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
};

export function validateFileDeclaration(name: string, mime: string): string {
  const extension = name.split('.').pop()?.toLowerCase() || '';
  if (!MIME_EXTENSIONS[mime]?.includes(extension)) {
    throw new ApiError(400, 'FILE_TYPE_BLOCKED', `Tipo de archivo no permitido: ${name}`);
  }
  return extension;
}

export function validateMagicBytes(mime: string, bytes: Uint8Array): void {
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const valid = mime === 'image/jpeg' ? starts(0xff, 0xd8, 0xff)
    : mime === 'image/png' ? starts(0x89, 0x50, 0x4e, 0x47)
      : mime === 'image/gif' ? starts(0x47, 0x49, 0x46, 0x38)
        : mime === 'image/webp' ? starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45
          : mime === 'application/pdf' ? starts(0x25, 0x50, 0x44, 0x46)
            : mime.includes('openxmlformats') ? starts(0x50, 0x4b, 0x03, 0x04)
              : mime === 'text/plain' || mime === 'text/csv';
  if (!valid) throw new ApiError(422, 'FILE_SIGNATURE_MISMATCH', 'El contenido no coincide con el tipo declarado');
  if ((mime === 'text/plain' || mime === 'text/csv') && bytes.includes(0)) {
    throw new ApiError(422, 'FILE_BINARY_TEXT', 'El archivo de texto contiene datos binarios');
  }
}

