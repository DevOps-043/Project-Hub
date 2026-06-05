# 🔐 Documentación del Sistema de Autenticación — SofLIA Learning

> **Propósito:** Documentar el flujo completo de auth de SofLIA para diagnosticar el error 401 en **Project Hub (Iris)**.

---

## 1. Visión General

SofLIA Learning usa un **sistema de autenticación triple en capas**, basado en Supabase Auth como fuente primaria y dos mecanismos legacy de sesión para compatibilidad con otros apps del ecosistema PulseHub.

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPAS DE AUTENTICACIÓN                    │
├─────────────────────────────────────────────────────────────┤
│  Capa 1 (Principal): Supabase Auth nativo                    │
│    → supabase.auth.signInWithPassword()                      │
│    → Cookies gestionadas por @supabase/ssr                   │
├─────────────────────────────────────────────────────────────┤
│  Capa 2 (Custom): Refresh Token System                       │
│    → Tabla: refresh_tokens (PostgreSQL/Supabase)             │
│    → Cookie: access_token + refresh_token                    │
├─────────────────────────────────────────────────────────────┤
│  Capa 3 (Legacy): Sesión UUID                                │
│    → Tabla: user_session (PostgreSQL/Supabase)               │
│    → Cookie: aprende-y-aplica-session                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Flujo de REGISTRO

### Archivo: [`register.ts`](file:///c:/Users/fysg5/OneDrive/Escritorio/PulseHub/Soflia-Learning/SofLIA-Learning/apps/web/src/features/auth/actions/register.ts)

```
Usuario llena formulario de registro
         │
         ▼
[1] Verificación humana (CAPTCHA)
         │
         ▼
[2] Validación con Zod Schema
    - firstName, lastName, username
    - email (único), password (strength)
    - countryCode, phoneNumber
    - dateOfBirth, gender
    - acceptTerms = true (obligatorio)
         │
         ▼
[3] Check de contraseña filtrada (HaveIBeenPwned API)
         │
         ▼
[4] Resolución de contexto de organización
    - Si viene con invitationToken → valida invitación individual
    - Si viene con bulkInviteToken → valida invitación masiva
    - Si viene con organizationId → busca email en invitation list
    - Si no hay org → registro normal (cargo_rol = 'Usuario')
         │
         ▼
[5] provisionAuthAccount()
    ├── Verifica duplicados: email y username en tabla `users`
    ├── createProvisionedAuthUser() → Crea usuario en Supabase Auth
    │   └── admin.auth.admin.createUser({
    │         email, password, email_confirm: true,
    │         user_metadata: { display_name, first_name, last_name, username },
    │         app_metadata: { role: cargo_rol, migration_source: 'public.users' }
    │       })
    └── upsertProvisionedProfile() → Inserta en tabla `users` (public)
         │
         ▼
[6] Si hay organización → createOrganizationMembership()
    → INSERT en organization_users
         │
         ▼
[7] Consumir invitación (marcarla como usada)
         │
         ▼
[8] Retorna { success: true, userId, message: 'Cuenta creada exitosamente.' }
    ⚠️  NO crea sesión. El usuario debe hacer login manualmente.
```

### ⚠️ Punto clave para Project Hub

Cuando un usuario se registra en SofLIA, su cuenta queda en:
- **`auth.users`** de Supabase (Supabase Auth) → misma instancia Supabase
- **`public.users`** (tabla custom) → datos de perfil

Si Project Hub usa la **misma instancia de Supabase**, el usuario ya existe en `auth.users`. Si Project Hub usa **otra instancia o su propia tabla de usuarios**, el usuario NO existirá ahí.

---

## 3. Flujo de LOGIN

### Archivo: [`login.ts`](file:///c:/Users/fysg5/OneDrive/Escritorio/PulseHub/Soflia-Learning/SofLIA-Learning/apps/web/src/features/auth/actions/login.ts)

```
Usuario ingresa email/username + contraseña
         │
         ▼
[1] Verificación humana (CAPTCHA obligatorio)
         │
         ▼
[2] Parseo de FormData
    - emailOrUsername (string, trimmed)
    - password (string)
    - rememberMe (boolean)
    - captchaToken (string)
         │
         ▼
[3] Control de lockout (rate limiting por IP/usuario)
    → Tabla: login_lockouts (o similar)
    → Bloqueo tras N intentos fallidos
         │
         ▼
[4] findLoginUser() → Busca usuario en tabla `users`
    → Busca por username (ILIKE) OR email (ILIKE) simultáneamente
    → Columnas: id, username, email, password_hash, email_verified,
                cargo_rol, is_banned, ban_reason, first_name, last_name,
                display_name, profile_picture_url
         │
         ▼
[5] Validaciones de cuenta
    ✗ Usuario no encontrado → error "Credenciales inválidas"
    ✗ is_banned = true → error con ban_reason
         │
         ▼
[6] Check MFA
    → getMfaStatusForLogin(userId) → verifica si tiene factor TOTP activo
    → Si MFA activo:
        a) Valida contraseña primero (sin crear sesión)
        b) Emite MFA challenge token (cookie + JWT)
        c) Retorna { requiresMfa: true, challengeToken }
         │
         ▼
[7] trySupabasePasswordLogin()
    a) ensureSupabaseAuthUserForLegacyProfile()
       → Verifica si existe en auth.users por ID
       → Si NO existe y tiene password_hash → lo crea automáticamente (migración)
    b) authClient.auth.signInWithPassword({ email, password })
       → Si éxito: Supabase establece sus propias cookies de sesión nativa
       → Si fallo: cae al fallback legacy
         │
         ▼
[8] validateCustomOrganizationLogin()
    → Si el usuario pertenece a organización con restricciones SSO
    → Puede bloquear login por email/username
         │
         ▼
[9] ÉXITO - createLoginSessions() (si Supabase Auth falló) O notifyLoginSuccess()
    ├── RefreshTokenService.createSession()
    │   → INSERT en tabla refresh_tokens
    │   → Genera access_token (UUID) + refresh_token (UUID)
    │   → Cookie: access_token (httpOnly, secure, sameSite=lax, 7d)
    │   → Cookie: refresh_token (httpOnly, secure, sameSite=lax)
    └── SessionService.createLegacySession()
        → INSERT en tabla user_session (campo jwt_id = sessionToken UUID)
        → Cookie: aprende-y-aplica-session (httpOnly, secure, sameSite=lax)
         │
         ▼
[10] resolveLoginRedirect()
     → Determina URL de redirección según cargo_rol:
       - 'Admin' → /admin
       - 'Business' → /business-panel
       - 'BusinessUser' → /business-user o /dashboard
       - 'Usuario' → /dashboard
         │
         ▼
[11] Retorna { success: true, redirectTo: '/dashboard' }
     → Cliente navega con window.location.href (navegación completa)
```

---

## 4. Cookies Establecidas al Hacer Login

| Cookie | Valor | httpOnly | secure | sameSite | Duración |
|--------|-------|----------|--------|----------|----------|
| `access_token` | UUID opaco | ✅ Sí | Solo prod | `lax` | 7 días (rememberMe: 30d) |
| `refresh_token` | UUID opaco | ✅ Sí | Solo prod | `lax` | 7 días (rememberMe: 30d) |
| `aprende-y-aplica-session` | UUID opaco | ✅ Sí | Solo prod | `lax` | 7 días (rememberMe: 30d) |
| Cookies Supabase Auth | JWT nativo | ✅ Sí | Solo prod | `lax` | Gestionado por Supabase |

> **Nota crítica:** Todas las cookies son `httpOnly` → **no se pueden leer desde JavaScript** del lado cliente. Esto significa que Project Hub **no puede leer estas cookies** directamente.

---

## 5. Resolución de Sesión (Lectura de Cookies)

### Archivo: [`session.service.ts`](file:///c:/Users/fysg5/OneDrive/Escritorio/PulseHub/Soflia-Learning/SofLIA-Learning/apps/web/src/features/auth/services/session.service.ts) y [`require-user.sessions.ts`](file:///c:/Users/fysg5/OneDrive/Escritorio/PulseHub/Soflia-Learning/SofLIA-Learning/apps/web/src/lib/auth/require-user.sessions.ts)

Cuando una ruta protegida necesita verificar quién es el usuario:

```
resolveAuthenticatedUserId()
    │
    ├─► [Prioridad 1] supabase.auth.getUser()
    │   → Lee cookies nativas de Supabase Auth
    │   → Si encuentra usuario → retorna user.id
    │
    ├─► [Prioridad 2] Cookie aprende-y-aplica-session
    │   → Lee uuid de la cookie
    │   → Busca en tabla user_session WHERE jwt_id = uuid
    │     AND revoked = false AND expires_at > now()
    │   → Si encontrado → retorna user_id
    │
    └─► [Prioridad 3] Cookies access_token + refresh_token
        → Hace SHA-256 del refresh_token
        → Busca en tabla refresh_tokens WHERE token_hash = hash
          AND is_revoked = false AND expires_at > now()
        → Si encontrado → retorna user_id
```

---

## 6. Guard de Rutas API — `requireUser()`

### Archivo: [`requireUser.ts`](file:///c:/Users/fysg5/OneDrive/Escritorio\PulseHub\Soflia-Learning\SofLIA-Learning\apps\web\src\lib\auth\requireUser.ts)

```typescript
// Uso en cualquier API Route de SofLIA:
const auth = await requireUser()
if (auth instanceof NextResponse) return auth  // 401 / 403 / 500

// Si llega aquí, auth = { userId, userEmail, userRole }
```

**Respuestas que genera:**

| Condición | Status | Mensaje |
|-----------|--------|---------|
| No hay sesión válida | `401` | `"No autenticado. Por favor, inicia sesión."` |
| Usuario no encontrado en DB | `401` | `"Usuario no encontrado."` |
| Usuario baneado | `403` | `"Tu cuenta ha sido suspendida."` |
| Error interno | `500` | `"Error interno del servidor."` |

---

## 7. Logout

### Archivo: [`logout.ts`](file:///c:/Users/fysg5/OneDrive/Escritorio/PulseHub/Soflia-Learning/SofLIA-Learning/apps/web/src/features/auth/actions/logout.ts) → [`SessionService.destroySession()`](file:///c:/Users/fysg5/OneDrive/Escritorio/PulseHub/Soflia-Learning/SofLIA-Learning/apps/web/src/features/auth/services/session.service.ts#L274-L363)

```
1. Revoca sesión legacy (UPDATE user_session SET revoked=true)
2. Revoca TODOS los refresh_tokens del usuario (is_revoked=true)
3. authClient.auth.signOut() → elimina sesión Supabase nativa
4. Elimina cookies: aprende-y-aplica-session, access_token, refresh_token
```

---

## 8. OAuth (Google / Microsoft SSO)

### Archivos: [`google-oauth.service.ts`](file:///c:/Users/fysg5/OneDrive/Escritorio/PulseHub/Soflia-Learning/SofLIA-Learning/apps/web/src/features/auth/services/google-oauth.service.ts) | [`oauth.service.ts`](file:///c:/Users/fysg5/OneDrive/Escritorio/PulseHub/Soflia-Learning/SofLIA-Learning/apps/web/src/features/auth/services/oauth.service.ts)

- Flujo estándar OAuth 2.0 via Supabase Auth providers
- Callback en `/api/auth/callback` → establece las mismas 3 cookies

---

## 9. 🔴 Análisis del Error 401 en Project Hub (Iris)

### Error observado:
```
Failed to load resource: the server responded with a status of 401 ()
→ /api/auth/login
```

### Causas probables (ordenadas por probabilidad):

---

### 🔴 Causa #1 (MÁS PROBABLE): Project Hub usa su propia tabla de usuarios

**Diagnóstico:** SofLIA almacena usuarios en `public.users` (tabla custom). Si Project Hub busca el usuario en **su propia tabla de usuarios** (ej. `public.proyecto_hub_users` o diferente schema), el usuario recién registrado en SofLIA **no existirá** en la tabla de Project Hub.

**Evidencia:** El error es 401 en `/api/auth/login` — el endpoint valida credenciales pero no encuentra al usuario.

**Solución:** Project Hub debe:
- A) Compartir la tabla `public.users` de Supabase, O
- B) Sincronizar usuarios via webhook/trigger de Supabase cuando se crea un usuario en `auth.users`, O
- C) Crear el usuario en la tabla de Project Hub durante el flujo de registro de SofLIA (federación de cuentas)

---

### 🔴 Causa #2: Project Hub usa diferente instancia de Supabase

**Diagnóstico:** Si Project Hub tiene su propio proyecto Supabase con sus propias `SUPABASE_URL` y `SUPABASE_ANON_KEY`, compartir usuario es imposible sin sincronización.

**Evidencia visual:** El error muestra que el login con credenciales correctas devuelve 401 — las credenciales son válidas en Supabase de SofLIA pero Project Hub consulta otro proyecto Supabase.

**Solución:** Migrar a una arquitectura de **Single Supabase project** compartido entre SofLIA y Project Hub, o implementar un sistema de identity federation (JWT compartido).

---

### 🟡 Causa #3: Project Hub valida contraseña diferente (hash incompatible)

**Diagnóstico:** SofLIA guarda `password_hash` en `public.users` usando **bcrypt** (`bcryptjs`). Si Project Hub re-hashea con diferente algoritmo o salt, la validación fallará.

**Solución:** Project Hub debe usar `bcrypt.compare(password, user.password_hash)` con el hash existente, NO re-hashear.

---

### 🟡 Causa #4: Project Hub no tiene el usuario en `auth.users` de Supabase

**Diagnóstico:** Cuando SofLIA registra un usuario, llama a `admin.auth.admin.createUser()` que crea el usuario en `auth.users`. Si Project Hub usa `supabase.auth.signInWithPassword()` directamente (como SofLIA), funcionará SOLO si el mismo proyecto Supabase es compartido.

**El registro en SofLIA SÍ crea el usuario en Supabase Auth** (`auth.users`), por lo tanto si Project Hub usa la **misma instancia Supabase** y llama a `signInWithPassword`, debería funcionar.

**Verificar:** ¿Project Hub usa las mismas `SUPABASE_URL` y `SUPABASE_ANON_KEY` que SofLIA?

---

### 🟡 Causa #5: Cookies no compartidas entre dominios

**Diagnóstico:** Las cookies de SofLIA tienen `sameSite: lax`. Si Project Hub está en un dominio diferente (ej. `projecthub.tudominio.com` vs `soflia.tudominio.com`), las cookies de SofLIA NO se envían automáticamente a Project Hub.

**Nota:** El error es en `/api/auth/login` (no en una ruta protegida), por lo que esto aplicaría solo si Project Hub intenta reutilizar la sesión de SofLIA directamente. Si Project Hub tiene su propio login, este no es el problema.

---

## 10. 📋 Checklist de Diagnóstico para Project Hub

Para identificar exactamente qué está fallando, verificar en Project Hub:

```
□ 1. ¿Cuál es la SUPABASE_URL y SUPABASE_ANON_KEY de Project Hub?
     → ¿Son las MISMAS que SofLIA o diferentes?

□ 2. ¿Project Hub busca usuarios en qué tabla?
     → ¿public.users (igual que SofLIA)?
     → ¿Otra tabla propia?

□ 3. ¿El endpoint /api/auth/login de Project Hub qué hace exactamente?
     → ¿Llama a supabase.auth.signInWithPassword()?
     → ¿Hace query a su propia tabla y valida bcrypt?
     → ¿Llama a algún endpoint externo?

□ 4. ¿El 401 viene antes o después de buscar al usuario?
     → Log en Project Hub: console.log('user found?', user)

□ 5. Verificar en Supabase Dashboard → Authentication → Users
     → ¿Aparece el email del usuario que falla?
     → Si SÍ aparece → el problema es en Project Hub (tabla o password)
     → Si NO aparece → el problema es que son proyectos Supabase distintos
```

---

## 11. Arquitectura Resumida en Diagrama

```
REGISTRO en SofLIA
─────────────────────────────────────────────────────────
FormData → Zod Validate → CAPTCHA → Check duplicados
    → admin.auth.admin.createUser() [Supabase Auth]
    → INSERT public.users [Custom table]
    → (opcional) INSERT organization_users
    → Retorna { success: true }  ← NO crea sesión

LOGIN en SofLIA
─────────────────────────────────────────────────────────
FormData → CAPTCHA → findLoginUser() [public.users]
    → validateBan → checkMFA
    → signInWithPassword() [Supabase Auth]
    │    ├── [ÉXITO] Supabase cookies nativas
    │    └── [FALLO] legacy fallback session
    → INSERT refresh_tokens
    → INSERT user_session
    → Set cookies: access_token, refresh_token, aprende-y-aplica-session
    → Redirect al dashboard

LOGIN en Project Hub
─────────────────────────────────────────────────────────
FormData → /api/auth/login [Project Hub API]
    → ??? (desconocido - necesita revisión)
    → 401 ← ERROR AQUÍ
```

---

## 12. Tablas de Base de Datos Involucradas

| Tabla | Propósito | Relevancia |
|-------|-----------|------------|
| `auth.users` | Usuarios Supabase Auth (nativo) | Credenciales email/password |
| `public.users` | Perfil de usuario SofLIA | datos del usuario, password_hash, cargo_rol |
| `public.user_session` | Sesiones legacy | Cookie `aprende-y-aplica-session` |
| `public.refresh_tokens` | Tokens custom | Cookies `access_token` + `refresh_token` |
| `public.organization_users` | Membresía org | Roles en organizaciones |

---

## 13. Recomendación Final

> [!IMPORTANT]
> El error 401 en Project Hub al hacer `/api/auth/login` sugiere fuertemente que **Project Hub no comparte la base de datos de usuarios con SofLIA**. El usuario puede loguearse en SofLIA porque sus datos están en la instancia Supabase de SofLIA. Project Hub falla porque busca el usuario en su propio sistema y no lo encuentra.

**Acción inmediata recomendada:**

1. Abrir el código de Project Hub en `apps/` o su repositorio equivalente
2. Localizar el handler del endpoint `POST /api/auth/login`  
3. Verificar: ¿de dónde lee los usuarios? ¿misma Supabase URL?
4. Si usa tabla propia → agregar lógica para buscar también en `public.users` de SofLIA O crear un servicio compartido de autenticación

**Solución arquitectónica a largo plazo:**
Implementar un **Auth Service compartido** en el backend Express (`apps/api`) que maneje login para todos los productos del ecosistema PulseHub, evitando duplicación de lógica de autenticación.
