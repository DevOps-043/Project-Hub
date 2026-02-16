/**
 * Middleware de Next.js para protección de rutas
 * Se ejecuta en el edge antes de que se procese cada request
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas que no requieren autenticación
const PUBLIC_PATHS = [
  '/',                    // Página principal
  '/auth',                // Todas las rutas de auth
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/reset-test-user', // Solo desarrollo
  '/api/ai',              // AI Services (Agile Advisor, etc)
  '/api/focus',           // Focus Mode
  '/api/search',          // Global Search
  '/api/notifications',   // Notifications
  '/api/ext',             // Extension API (SOFLIA - auth propia en cada route)
  '/api/workspaces',      // Workspaces API (auth propia en cada route)
  '/_next',
  '/favicon.ico',
  '/public',
  '/images',
  '/fonts',
];

// Rutas que son solo para invitados (redirige a dashboard si está autenticado)
const GUEST_ONLY_PATHS = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/login',
  '/register',
];

// Rutas que requieren rol de admin
const ADMIN_PATHS = [
  '/admin',
  '/api/admin',
];

// Rutas protegidas (requieren auth, no admin) - incluye rutas de org con slug
// Las rutas /{orgSlug}/* se protegen automáticamente porque no están en PUBLIC_PATHS

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir archivos estáticos siempre
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') && !pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // Permitir rutas públicas
  const isPublicPath = PUBLIC_PATHS.some(path => 
    pathname === path || pathname.startsWith(`${path}/`) || pathname.startsWith(`${path}?`)
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Obtener token de la cookie o del header Authorization
  const token = request.cookies.get('accessToken')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');

  // Si no hay token y no es ruta pública, redirigir a login
  if (!token) {
    // Para rutas de API, retornar 401
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'No autorizado', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Para rutas de página, redirigir a sign-in
    const loginUrl = new URL('/auth/sign-in', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verificar si el token tiene formato JWT válido (3 partes separadas por puntos)
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Token inválido', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/auth/sign-in', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Decodificar payload del token para verificar expiración
  try {
    const payload = JSON.parse(atob(tokenParts[1]));
    const now = Math.floor(Date.now() / 1000);

    // Token expirado
    if (payload.exp < now) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          { error: 'Token expirado', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/auth/sign-in', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verificar rutas de admin
    const isAdminPath = ADMIN_PATHS.some(path => 
      pathname === path || pathname.startsWith(`${path}/`)
    );

    if (isAdminPath) {
      const permissionLevel = payload.permissionLevel || payload.role;
      if (permissionLevel !== 'super_admin' && permissionLevel !== 'admin') {
        if (pathname.startsWith('/api')) {
          return NextResponse.json(
            { error: 'Acceso denegado', code: 'FORBIDDEN' },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    // Si el usuario autenticado intenta acceder a rutas de solo invitados
    const isGuestOnlyPath = GUEST_ONLY_PATHS.some(path => pathname === path);
    if (isGuestOnlyPath) {
      return NextResponse.redirect(new URL('/select-organization', request.url));
    }

    // Token válido, continuar
    return NextResponse.next();

  } catch (error) {
    console.error('Error parsing token:', error);
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Token inválido', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/auth/sign-in', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

// Configurar en qué rutas se ejecuta el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - images
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|images/).*)',
  ],
};

