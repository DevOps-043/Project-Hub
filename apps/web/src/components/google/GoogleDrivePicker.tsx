'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';

export interface PickedFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  iconUrl?: string;
}

interface GoogleDrivePickerProps {
  isOpen: boolean;
  onSelect: (file: PickedFile) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
  /** Filtrar por tipos de archivo especificos. Default: todos */
  filterMimeTypes?: string[];
}

type DriveApiFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
};

const GOOGLE_MIME_TYPES = {
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  DOCUMENT: 'application/vnd.google-apps.document',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  FOLDER: 'application/vnd.google-apps.folder',
  PDF: 'application/pdf',
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Error cargando script: ${src}`));
    document.head.appendChild(script);
  });
}

function getDriveFileUrl(file: DriveApiFile) {
  if (file.webViewLink) return file.webViewLink;
  if (file.mimeType === GOOGLE_MIME_TYPES.FOLDER) {
    return `https://drive.google.com/drive/folders/${file.id}`;
  }
  return `https://drive.google.com/file/d/${file.id}/view`;
}

async function fetchDriveFiles(accessToken: string, filterMimeTypes?: string[]) {
  const searchParams = new URLSearchParams({
    pageSize: '50',
    orderBy: 'modifiedTime desc',
    q: 'trashed = false',
    fields: 'files(id,name,mimeType,webViewLink,iconLink)',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message = payload?.error?.message || 'No se pudieron cargar archivos de Google Drive.';
    throw new Error(message);
  }

  const data = await res.json();
  const files = (data.files || []) as DriveApiFile[];

  if (!filterMimeTypes?.length) {
    return files;
  }

  return files.filter(file => filterMimeTypes.includes(file.mimeType));
}

export function GoogleDrivePicker({ isOpen, onSelect, onCancel, onError, filterMimeTypes }: GoogleDrivePickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingDriveFallback, setUsingDriveFallback] = useState(false);
  const [fallbackFiles, setFallbackFiles] = useState<DriveApiFile[]>([]);
  const pickerOpenedRef = useRef(false);

  const failPicker = useCallback((message: string) => {
    pickerOpenedRef.current = false;
    setError(message);
    onError?.(message);
  }, [onError]);

  const openDriveFallback = useCallback(async (accessToken: string) => {
    setUsingDriveFallback(true);
    setFallbackFiles([]);
    const files = await fetchDriveFiles(accessToken, filterMimeTypes);
    setFallbackFiles(files);
  }, [filterMimeTypes]);

  const openPicker = useCallback(async () => {
    if (pickerOpenedRef.current) return;
    pickerOpenedRef.current = true;
    setIsLoading(true);
    setError(null);
    setUsingDriveFallback(false);
    setFallbackFiles([]);
    let accessTokenForFallback: string | null = null;

    try {
      const { data: tokenData, error: tokenError } = await api.get<{ accessToken?: string }>('/api/auth/google/token');

      if (tokenError || !tokenData?.accessToken) {
        failPicker('No se pudo acceder a Google Drive. Reconecta tu cuenta de Google.');
        return;
      }

      const { accessToken } = tokenData;

      accessTokenForFallback = accessToken;

      if (!GOOGLE_API_KEY) {
        await openDriveFallback(accessToken);
        return;
      }

      await loadScript('https://apis.google.com/js/api.js');

      await new Promise<void>((resolve, reject) => {
        window.gapi.load('picker', { callback: resolve, onerror: reject });
      });

      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setCallback((data: GooglePickerCallbackData) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            onSelect({
              id: doc.id,
              name: doc.name,
              url: doc.url || doc.embedUrl || `https://drive.google.com/file/d/${doc.id}/view`,
              mimeType: doc.mimeType,
              iconUrl: doc.iconUrl,
            });
          } else if (data.action === window.google.picker.Action.CANCEL) {
            onCancel();
          }
          pickerOpenedRef.current = false;
        });

      if (filterMimeTypes && filterMimeTypes.length > 0) {
        const view = new window.google.picker.DocsView();
        view.setMimeTypes(filterMimeTypes.join(','));
        view.setMode(window.google.picker.DocsViewMode.LIST);
        picker.addView(view);
      } else {
        const docsView = new window.google.picker.DocsView();
        docsView.setIncludeFolders(true);
        docsView.setMode(window.google.picker.DocsViewMode.LIST);
        picker.addView(docsView);

        const sheetsView = new window.google.picker.DocsView();
        sheetsView.setMimeTypes(GOOGLE_MIME_TYPES.SPREADSHEET);
        sheetsView.setLabel('Hojas de calculo');
        picker.addView(sheetsView);
      }

      const uploadView = new window.google.picker.DocsUploadView();
      picker.addView(uploadView);

      picker.setTitle('Seleccionar archivo de Google Drive');
      picker.setLocale('es');
      picker.build().setVisible(true);
    } catch (error) {
      console.error('Error abriendo Google Picker:', error);
      if (accessTokenForFallback) {
        try {
          await openDriveFallback(accessTokenForFallback);
          return;
        } catch (fallbackError) {
          console.error('Error abriendo fallback de Drive:', fallbackError);
        }
      }
      failPicker(error instanceof Error ? error.message : 'No se pudo abrir Google Drive.');
    } finally {
      setIsLoading(false);
    }
  }, [failPicker, filterMimeTypes, onSelect, onCancel, openDriveFallback]);

  const closePicker = useCallback(() => {
    pickerOpenedRef.current = false;
    setError(null);
    setUsingDriveFallback(false);
    setFallbackFiles([]);
    onCancel();
  }, [onCancel]);

  const selectFallbackFile = useCallback((file: DriveApiFile) => {
    pickerOpenedRef.current = false;
    setUsingDriveFallback(false);
    setFallbackFiles([]);
    onSelect({
      id: file.id,
      name: file.name,
      url: getDriveFileUrl(file),
      mimeType: file.mimeType,
      iconUrl: file.iconLink,
    });
  }, [onSelect]);

  useEffect(() => {
    if (isOpen) {
      openPicker();
    } else {
      pickerOpenedRef.current = false;
      setIsLoading(false);
      setError(null);
      setUsingDriveFallback(false);
      setFallbackFiles([]);
    }
  }, [isOpen, openPicker]);

  if (!isOpen) return null;

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
          <h3 className="text-base font-semibold text-gray-900">Google Drive no disponible</h3>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <button
            type="button"
            onClick={closePicker}
            className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (usingDriveFallback) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Seleccionar archivo de Google Drive</h3>
              <p className="text-xs text-gray-500">Usando la conexion OAuth activa.</p>
            </div>
            <button type="button" onClick={closePicker} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100">
              Cerrar
            </button>
          </div>

          <div className="min-h-48 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                Cargando archivos...
              </div>
            ) : fallbackFiles.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">No se encontraron archivos compatibles.</p>
            ) : (
              <div className="space-y-1">
                {fallbackFiles.map(file => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => selectFallbackFile(file)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50"
                  >
                    {file.iconLink ? (
                      <img src={file.iconLink} alt="" className="h-5 w-5" />
                    ) : (
                      <div className="h-5 w-5 rounded bg-blue-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="truncate text-xs text-gray-500">{file.mimeType}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 shadow-lg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-700">Abriendo Google Drive...</span>
      </div>
    </div>
  );
}

export { GOOGLE_MIME_TYPES };

interface GooglePickerDoc {
  id: string;
  name: string;
  url?: string;
  embedUrl?: string;
  mimeType: string;
  iconUrl?: string;
}

interface GooglePickerCallbackData {
  action: string;
  docs: GooglePickerDoc[];
}

interface GooglePickerView {
  setMimeTypes(mimeTypes: string): GooglePickerView;
  setMode(mode: unknown): GooglePickerView;
  setIncludeFolders(include: boolean): GooglePickerView;
  setLabel(label: string): GooglePickerView;
}

interface GooglePickerBuilder {
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(cb: (data: GooglePickerCallbackData) => void): GooglePickerBuilder;
  addView(view: GooglePickerView): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  setLocale(locale: string): GooglePickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

declare global {
  interface Window {
    gapi: {
      load: (api: string, options: { callback: () => void; onerror: (err: unknown) => void }) => void;
    };
    google: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new () => GooglePickerView;
        DocsViewMode: { LIST: unknown };
        DocsUploadView: new () => GooglePickerView;
        Action: {
          PICKED: string;
          CANCEL: string;
        };
      };
    };
  }
}
