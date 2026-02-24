'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

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
  /** Filtrar por tipos de archivo específicos. Default: todos */
  filterMimeTypes?: string[];
}

// Tipos de MIME de Google Workspace
const GOOGLE_MIME_TYPES = {
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  DOCUMENT: 'application/vnd.google-apps.document',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  FOLDER: 'application/vnd.google-apps.folder',
  PDF: 'application/pdf',
};

/**
 * Carga el script de Google API dinámicamente.
 */
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

/**
 * Componente que abre el Google Picker para seleccionar archivos de Drive.
 * Requiere que el usuario tenga Google conectado (access token válido).
 */
export function GoogleDrivePicker({ isOpen, onSelect, onCancel, filterMimeTypes }: GoogleDrivePickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const pickerOpenedRef = useRef(false);

  const openPicker = useCallback(async () => {
    if (pickerOpenedRef.current) return;
    pickerOpenedRef.current = true;
    setIsLoading(true);

    try {
      // 1. Cargar Google API scripts
      await loadScript('https://apis.google.com/js/api.js');

      // 2. Cargar el módulo Picker
      await new Promise<void>((resolve, reject) => {
        window.gapi.load('picker', { callback: resolve, onerror: reject });
      });

      // 3. Obtener access token del usuario
      const tokenFromStorage = localStorage.getItem('accessToken');
      const tokenRes = await fetch('/api/auth/google/token', {
        headers: tokenFromStorage ? { Authorization: `Bearer ${tokenFromStorage}` } : {},
      });

      if (!tokenRes.ok) {
        console.error('No se pudo obtener Google token');
        onCancel();
        return;
      }

      const { accessToken } = await tokenRes.json();

      // 4. Configurar y abrir Picker
      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            onSelect({
              id: doc.id,
              name: doc.name,
              url: doc.url,
              mimeType: doc.mimeType,
              iconUrl: doc.iconUrl,
            });
          } else if (data.action === window.google.picker.Action.CANCEL) {
            onCancel();
          }
          pickerOpenedRef.current = false;
        });

      // Agregar vistas según filtros
      if (filterMimeTypes && filterMimeTypes.length > 0) {
        const view = new window.google.picker.DocsView();
        view.setMimeTypes(filterMimeTypes.join(','));
        view.setMode(window.google.picker.DocsViewMode.LIST);
        picker.addView(view);
      } else {
        // Vista por defecto: Docs, Sheets, Presentations, PDFs
        const docsView = new window.google.picker.DocsView();
        docsView.setIncludeFolders(true);
        docsView.setMode(window.google.picker.DocsViewMode.LIST);
        picker.addView(docsView);

        // Vista de Sheets específica
        const sheetsView = new window.google.picker.DocsView();
        sheetsView.setMimeTypes(GOOGLE_MIME_TYPES.SPREADSHEET);
        sheetsView.setLabel('Hojas de cálculo');
        picker.addView(sheetsView);
      }

      // Permitir subir archivos también
      const uploadView = new window.google.picker.DocsUploadView();
      picker.addView(uploadView);

      picker.setTitle('Seleccionar archivo de Google Drive');
      picker.setLocale('es');
      picker.build().setVisible(true);
    } catch (error) {
      console.error('Error abriendo Google Picker:', error);
      onCancel();
      pickerOpenedRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [onSelect, onCancel, filterMimeTypes]);

  useEffect(() => {
    if (isOpen) {
      openPicker();
    } else {
      pickerOpenedRef.current = false;
    }
  }, [isOpen, openPicker]);

  // No renderiza nada visible, el Picker es un overlay de Google
  if (!isOpen || !isLoading) return null;

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

// Tipos globales para Google Picker API
declare global {
  interface Window {
    gapi: any;
    google: {
      picker: {
        PickerBuilder: any;
        DocsView: any;
        DocsViewMode: any;
        DocsUploadView: any;
        Action: {
          PICKED: string;
          CANCEL: string;
        };
      };
    };
  }
}
