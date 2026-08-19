/**
 * API Client con manejo automático de autenticación
 * Intercepta respuestas 401 y renueva tokens automáticamente
 */

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestConfig {
  method?: RequestMethod;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

// Obtener tokens del localStorage
const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
};

const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
};

const setTokens = (accessToken: string, refreshToken: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

const clearTokens = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Renovar tokens
const refreshTokens = async (): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
};

// Flag para evitar múltiples refresh simultáneos
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Cliente API con manejo automático de autenticación
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = config;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  // Construir headers
  const requestHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  };

  // Añadir token de autorización si no se omite
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // Construir opciones del request
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    requestOptions.body = isFormData ? (body as FormData) : JSON.stringify(body);
  }

  try {
    let response = await fetch(endpoint, requestOptions);

    // Si recibimos 401 y no estamos omitiendo auth, intentar refresh
    if (response.status === 401 && !skipAuth) {
      // Evitar múltiples refresh simultáneos
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshTokens();
      }

      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;

      if (refreshed) {
        // Reintentar request con nuevo token
        const newToken = getAccessToken();
        if (newToken) {
          requestHeaders['Authorization'] = `Bearer ${newToken}`;
        }
        response = await fetch(endpoint, {
          ...requestOptions,
          headers: requestHeaders,
        });
      } else {
        // Refresh falló, limpiar tokens
        clearTokens();
        // Redirigir a login si estamos en el cliente
        if (typeof window !== 'undefined') {
          // Plain utility function, not a React component — useRouter() isn't
          // available here. A hard redirect also fully resets client state.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = '/login';
        }
        return {
          data: null,
          error: 'Sesión expirada. Por favor inicia sesión nuevamente.',
          status: 401,
        };
      }
    }

    // Parsear respuesta
    const contentType = response.headers.get('content-type');
    let data: T | null = null;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      return {
        data: null,
        error: (data as { error?: string })?.error || `Error ${response.status}`,
        status: response.status,
      };
    }

    return {
      data,
      error: null,
      status: response.status,
    };
  } catch (error) {
    console.error('API Client Error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Error de conexión',
      status: 0,
    };
  }
}

// Métodos de conveniencia
export const api = {
  get: <T = unknown>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...config, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...config, method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...config, method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...config, method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string, config?: Omit<RequestConfig, 'method'>) =>
    apiClient<T>(endpoint, { ...config, method: 'DELETE' }),
};

export default apiClient;
