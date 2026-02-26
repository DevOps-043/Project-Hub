/**
 * Server-side utility para leer contenido de documentos de Google Drive.
 * Usa Google Drive API v3 para exportar documentos como texto plano.
 */

const EXPORT_MIME_MAP: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

/**
 * Lee el contenido de un documento de Google Drive como texto.
 * Soporta Google Docs, Sheets y Slides.
 */
export async function readGoogleDocument(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  const exportMime = EXPORT_MIME_MAP[mimeType];

  if (exportMime) {
    // Google Workspace files: use export endpoint
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error exporting Google file ${fileId}:`, errorText);
      throw new Error(`No se pudo leer el documento: ${res.status}`);
    }

    return res.text();
  }

  // For non-Google files, try to download directly
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Error downloading file ${fileId}:`, errorText);
    throw new Error(`No se pudo descargar el archivo: ${res.status}`);
  }

  return res.text();
}

/**
 * Lee multiples documentos y retorna un array con su contenido.
 * Los documentos que fallen se omiten silenciosamente.
 */
export async function readMultipleDocuments(
  accessToken: string,
  documents: Array<{ external_id: string; mime_type: string; name: string }>
): Promise<Array<{ name: string; content: string }>> {
  const results: Array<{ name: string; content: string }> = [];

  for (const doc of documents) {
    try {
      const content = await readGoogleDocument(accessToken, doc.external_id, doc.mime_type);
      if (content.trim()) {
        results.push({ name: doc.name, content });
      }
    } catch (err) {
      console.warn(`No se pudo leer documento "${doc.name}":`, err);
    }
  }

  return results;
}
