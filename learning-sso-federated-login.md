# Inicio de sesión federado con SofLIA Learning

Estado: vigente. Documenta el sistema tal como está implementado en este
repositorio (Pulse Hub, escritorio Electron). Fecha: 2026-08-19.

Propósito de este documento: servir de referencia completa y portable para
implementar el mismo tipo de inicio de sesión federado en **Project Hub**.
La sección [Guía de portabilidad a Project Hub](#guía-de-portabilidad-a-project-hub)
adapta el diseño a una aplicación web, que es el caso confirmado.

Fuentes canónicas relacionadas (no duplicar, solo referenciar):

- `openspec/changes/federate-learning-sso-desktop/proposal.md` — por qué y qué cambia.
- `openspec/changes/federate-learning-sso-desktop/design.md` — decisiones y alternativas descartadas.
- `openspec/changes/federate-learning-sso-desktop/specs/learning-sso-desktop-session/spec.md` — contrato en formato SHALL/MUST con escenarios.
- `openspec/changes/federate-sofia-lia-session/design.md` — patrón de federación entre dos proyectos Supabase distintos (relevante para la portabilidad si Project Hub usa un proyecto propio).
- `docs/operations/auth-migration.md` — contexto histórico de la migración de login a Supabase Auth.
- `docs/operations/configuration.md` — variables de entorno documentadas.

## 1. Resumen ejecutivo

SofLIA Learning es dueño de la identidad: ejecuta su propio SSO de Google y
Microsoft, intercambia el código con el proveedor en su servidor y nunca
delega ese paso en el cliente. El Hub de escritorio **no implementa OAuth**;
en su lugar, abre el paso de identidad en el navegador del sistema y recibe
de vuelta un **ticket de un solo uso** que canjea por una sesión Supabase
ordinaria sobre el mismo proyecto de identidad (SOFIA).

El problema que resuelve: las cuentas dadas de alta por Google/Microsoft en
Learning se crean en `auth.users` **sin contraseña**. El Hub solo sabía
autenticar con `signInWithPassword`, así que esas cuentas quedaban
completamente excluidas del escritorio, sin ninguna vía de entrada.

La pieza de diseño no obvia es esta: el canal de retorno al escritorio es un
**esquema de URL personalizado** (`soflia://`), y en Windows cualquier
aplicación local puede registrar ese mismo esquema. Por lo tanto el ticket,
por sí solo, **no es prueba de nada** — se liga criptográficamente a la
instancia que inició el flujo mediante PKCE (RFC 7636 / RFC 8252), igual que
hace un cliente OAuth público sin `client_secret`.

## 2. Actores y sistemas

| Actor | Rol |
|---|---|
| **Hub (escritorio, Electron)** | Inicia el flujo, abre el navegador del sistema, recibe el deep link, canjea el ticket, produce sesión SOFIA. |
| **SofLIA Learning (web)** | Dueño del SSO real con Google/Microsoft. Emite el ticket al cerrar su propio callback OAuth. Expone el endpoint de canje. |
| **Proyecto Supabase SOFIA** (`mrqnnmuckznvukjvfkly`) | Instancia de identidad compartida por Learning y el Hub. Aloja `auth.users`, el perfil/membresías y la tabla de tickets. Learning tiene `service_role` sobre ella; el Hub solo el cliente anónimo. |
| **Navegador del sistema** | Ejecuta el paso de identidad. El navegador integrado del Hub **nunca** participa: los proveedores de identidad rechazan user-agents embebidos y el escritorio no debe ver el formulario de credenciales. |

## 3. Flujo completo, paso a paso

1. **Inicio.** El usuario pulsa "Continuar con SofLIA Learning" en la pantalla de login del Hub (`src/components/auth/AuthSsoButton.tsx`).
2. **Generación de la solicitud (renderer).** `createLearningSsoRequest()` en `src/services/learning-sso.ts` genera en memoria del renderer:
   - `state`: 16 bytes aleatorios, base64url (correlación).
   - `code_verifier`: 32 bytes aleatorios, base64url — **nunca sale del renderer ni se escribe a disco**.
   - `code_challenge`: SHA-256(`code_verifier`) en base64url (PKCE S256).
3. **Apertura del navegador (IPC → main).** El renderer invoca `auth:open-sso` con solo `{ state, codeChallenge }` — nunca una URL. El proceso main (`electron/learning-sso.ts`) construye la URL final a partir de su propia configuración (`VITE_LEARNING_BASE_URL` en tiempo de build) para que un renderer comprometido no pueda usar el canal para abrir una dirección arbitraria. Solo acepta `https:`, salvo `localhost`/`127.0.0.1` en desarrollo. Abre con `shell.openExternal`, nunca en una vista embebida.
4. **SSO real en Learning (navegador del sistema).** Learning ejecuta su propio intercambio OAuth con Google/Microsoft, con su `client_secret`, fuera de la vista del Hub. Si la persona ya tiene sesión web abierta en Learning, no se le vuelve a pedir credenciales.
5. **Emisión del ticket (Learning, servidor).** Al cerrar su callback OAuth, Learning ya conoce al usuario autenticado. Genera un ticket de un solo uso, guarda su **hash** (nunca el valor en claro) junto con el `code_challenge` recibido, el `user_id` y una expiración corta (del orden de un minuto), en `public.desktop_sso_tickets` del proyecto SOFIA.
6. **Retorno al escritorio (deep link).** Learning redirige el navegador del sistema a `soflia://auth/callback?state=...&ticket=...` (o `...&error=...` si el usuario canceló o fue denegado). El destino se construye **en el servidor de Learning**; ningún parámetro del cliente influye en él — es la defensa contra convertir el modo escritorio en un redirector abierto.
7. **Recepción del deep link (main process).**
   - `electron/app-protocol.ts` (`parseAppProtocolCommand`) valida el esquema (`soflia:`), el host (`auth`) y el path (`callback`), y produce un `AuthCallbackPayload { ticket, state, error }`. Descarta silenciosamente cualquier retorno sin `ticket` ni `error`.
   - En Windows/Linux llega como argumento de un segundo proceso (`app.on('second-instance')`, `electron/main/app-lifecycle.ts`); en macOS, el proceso no se relanza y llega por `app.on('open-url')` — sin ese handler el flujo falla en silencio en macOS.
   - `controls.routeAuthCallbackToRenderer()` (`electron/main/window-controls.ts`) guarda el payload en `state.pendingAuthCallback` (`electron/main/runtime-state.ts`) y lo envía por el canal `app:auth-callback` si la ventana ya existe; si no, crea la ventana. Esto cubre el caso de **arranque en frío**: la app pudo abrirse por el propio deep link antes de que el renderer existiera.
8. **Consumo en el renderer.** `useLearningSso` (`src/contexts/auth/useLearningSso.ts`) se suscribe a `app:auth-callback` y también llama a `app:get-pending-auth-callback` al montar, por si el retorno llegó en frío. Compara el `state` recibido contra el de la solicitud viva guardada en un `ref`; si no coincide o no hay solicitud viva, **descarta el retorno sin tocar la sesión**. Esto es lo que impide que un deep link ajeno (de otra app que registró el mismo esquema) arrastre al Hub a un canje que nadie pidió.
9. **Canje del ticket (HTTPS directo Hub → Learning).** `exchangeTicketForSofiaSession(ticket, codeVerifier)` en `src/services/learning-sso.ts` hace `POST {VITE_LEARNING_BASE_URL}/api/auth/desktop/exchange` con `{ ticket, code_verifier }`, `credentials: 'omit'` (el endpoint se autentica por el ticket + verificador, no por cookie). Reintenta con backoff (250ms, 750ms) solo errores de red/5xx; **401/403 no se reintentan**.
10. **Validación en Learning (servidor).** Learning localiza el ticket por el hash del valor recibido, ejecuta el consumo atómico (`consume_desktop_sso_ticket`, ver §6), compara el `code_challenge` guardado contra SHA-256(`code_verifier` recibido), comprueba `organization_users.status = 'active'` para el `user_id` del ticket, y si todo es válido llama a `admin.auth.admin.generateLink({ type: 'magiclink', email })` sobre el proyecto SOFIA. Devuelve **únicamente** `{ tokenHash }`, con cabeceras que impiden caché.
11. **Sesión Supabase (renderer).** El Hub canjea `tokenHash` con `sofiaSupa.auth.verifyOtp({ token_hash, type: 'magiclink' })` sobre el cliente anónimo — el mismo patrón que ya usa `lia-session-exchange.ts` para federar hacia el proyecto Lia. Obtiene una `Session` de Supabase Auth **indistinguible** de la que produce `signInWithPassword`, con el mismo `user.id` que ya existía.
12. **Resolución de perfil (camino común).** `sofiaAuth.completeSofiaSsoSession(session)` (`src/services/sofia-auth.ts`) resuelve la fila de `public.users` por correo, verifica que su `id` coincida con `session.user.id` (si no coincide, la identidad no es la misma y se aborta), y llama a `completeAuthenticatedSession()` — **la misma función que usa el login por contraseña** para resolver membresía activa, perfil y sesión local. Si no hay membresía activa, cierra la sesión de Supabase Auth recién creada antes de devolver el error: **nunca queda una sesión parcial abierta**.
13. **Federación a Lia.** `ensureLiaSession(email, accessToken)` sigue exactamente el mismo camino que el login por contraseña — sin cambios, sin una segunda credencial.

## 4. Inventario de código (Hub, Electron)

### Proceso principal (main)

| Archivo | Responsabilidad |
|---|---|
| `electron/learning-sso.ts` | Construye la URL de inicio desde configuración de build; valida `state`/`code_challenge`; abre `shell.openExternal`. Nunca acepta una URL del renderer. |
| `electron/app-protocol.ts` + `electron/app-protocol/types.ts` | Parsea `soflia://auth/callback` a un `AuthCallbackPayload` tipado; valida forma, no autoriza nada. |
| `electron/main/runtime-state.ts` | Estado del proceso main; `pendingAuthCallback` retiene el retorno de un arranque en frío. |
| `electron/main/window-controls.ts` (`routeAuthCallbackToRenderer`) | Entrega el payload al renderer por `app:auth-callback`, creando/enfocando la ventana si hace falta. |
| `electron/main/app-lifecycle.ts` | Enruta el deep link desde `second-instance` (Windows/Linux) y `open-url` (macOS). |
| `electron/main/service-ipc.ts` | Handlers `auth:open-sso` y `app:get-pending-auth-callback`. |
| `electron/main/bootstrap.ts` | `app.setAsDefaultProtocolClient('soflia', ...)` — registro del esquema en el SO. |

### Preload (allowlist IPC)

| Archivo | Responsabilidad |
|---|---|
| `electron/preload/channel-group-1.ts` | Declara `auth:open-sso`, `app:get-pending-auth-callback`, `app:auth-callback` en la allowlist expuesta al renderer. Sin esta lista el renderer no puede invocar ni escuchar estos canales aunque el código los referencie. |

### Renderer — servicios

| Archivo | Responsabilidad |
|---|---|
| `src/services/learning-sso.ts` | Genera `state`/`code_verifier`/`code_challenge`; invoca `auth:open-sso`; se suscribe a `app:auth-callback`; canjea el ticket por `tokenHash` y luego por sesión vía `verifyOtp`; taxonomía de errores (`LearningSsoError`) y política de reintento. |
| `src/services/sofia-auth.ts` (`completeSofiaSsoSession`) | Cierra el camino común con el login por contraseña: perfil, membresía, sesión local. |
| `src/config.ts` (`LEARNING_SSO`, `isLearningSsoConfigured`) | Interruptor de configuración; ninguna de las dos variables es secreta. |

### Renderer — estado y UI

| Archivo | Responsabilidad |
|---|---|
| `src/contexts/auth/useLearningSso.ts` | Orquesta el flujo desde React: guarda la solicitud viva en un `ref` (no en estado, para que el suscriptor del deep link siempre lea la vigente), compara `state`, maneja arranque en frío, expone `signInWithLearningSso`/`cancelLearningSso`/`ssoPending`/`ssoError`. |
| `src/components/auth/AuthSsoButton.tsx` | Botón "Continuar con SofLIA Learning"; convive con el formulario de contraseña; oculto si el interruptor está apagado. |

### Pruebas existentes (referencia de comportamiento esperado)

`electron/__tests__/learning-sso.test.ts`, `electron/__tests__/app-protocol.test.ts`,
`electron/__tests__/preload/channel-cases.ts`, `src/__tests__/services/learning-sso.test.ts`,
`src/__tests__/contexts/use-learning-sso.test.tsx`, `src/__tests__/services/sofia-auth-login.test.ts`.

## 5. Contrato del backend (SofLIA Learning)

Learning implementa dos endpoints nuevos (fuera de este repositorio, especificados
en `openspec/changes/federate-learning-sso-desktop/tasks.md` y el spec de §"Fuentes"):

### `GET /api/auth/desktop/start`

Query params: `state`, `code_challenge`.

Comportamiento: ejecuta (o reutiliza) el SSO web de Learning con Google/Microsoft.
Al completarse, genera el ticket, lo guarda hasheado junto al `code_challenge` y al
`user_id` autenticado, y redirige a `soflia://auth/callback?state=<mismo state>&ticket=<ticket>`
(o `&error=<código>` si falla/cancela). El destino de la redirección está fijo en
el servidor — no es configurable por query param.

### `POST /api/auth/desktop/exchange`

Body: `{ ticket, code_verifier }`. Sin cookies (`credentials: 'omit'` en el cliente).

Comportamiento:

1. Hashea el `ticket` recibido y llama al consumo atómico (ver §6) — inválido,
   expirado o ya consumido son indistinguibles entre sí (todos `invalid_ticket`).
2. Compara `SHA-256(code_verifier)` contra el `code_challenge` guardado.
3. Comprueba `organization_users.status = 'active'` para el `user_id` del ticket.
4. Si todo es válido: `admin.auth.admin.generateLink({ type: 'magiclink', email })`
   sobre el proyecto SOFIA y responde `{ tokenHash }` con `Cache-Control: no-store`.

Respuestas de error (status → código en el cliente):

| HTTP | Código cliente | Reintentable |
|---|---|---|
| 400 / 401 | `invalid_ticket` | No |
| 403 | `access_denied` | No |
| 429 / 5xx | `exchange_unavailable` | Sí (backoff acotado) |
| red (sin status) | `exchange_unavailable` | Sí |

## 6. Modelo de datos: tickets de un solo uso

Migración de referencia: `database/sofia-learning/migrations/desktop-sso-tickets.sql`
(ejecutar en el proyecto Supabase de **identidad**, no en un proyecto de datos de
producto).

```sql
CREATE TABLE public.desktop_sso_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,          -- SHA-256 hex; el ticket en claro nunca se persiste
  code_challenge text NOT NULL CHECK (length(btrim(code_challenge)) > 0),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Puntos de diseño que no son obvios leyendo solo el DDL:

- **RLS activa y sin políticas** (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`,
  sin `CREATE POLICY`): la postura por defecto es negar todo. Solo `service_role`
  (que no pasa por RLS) puede tocar la tabla — ninguna sesión de usuario, ni
  siquiera la propietaria del ticket, puede leerla ni escribirla.
- **Consumo atómico**: `consume_desktop_sso_ticket(p_token_hash)` es un
  `UPDATE ... SET consumed_at = now() WHERE token_hash = $1 AND consumed_at IS NULL
  AND expires_at > now() RETURNING user_id, code_challenge`, `SECURITY DEFINER`.
  El bloqueo de fila de Postgres garantiza que dos canjes concurrentes del mismo
  ticket no puedan prosperar ambos, sin coordinación adicional. Devuelve el
  `code_challenge` **junto con** el consumo — el verificador se compara *después*
  de haber quemado el ticket, así que un verificador incorrecto también invalida
  el ticket (deseable frente a un atacante que lo interceptó e intenta adivinar).
- **Limpieza**: `purge_desktop_sso_tickets()` borra filas de más de 1 día (margen
  para auditar un incidente reciente). La tabla no participa en ninguna consulta
  de producto, así que no hay coste de mantenerla vacía agresivamente.
- **Rollback sin migración inversa**: ningún UUID de usuario depende de esta
  tabla; se puede eliminar sin efecto en datos de producto.

## 7. Decisiones de seguridad (con su porqué)

- **PKCE (S256) en vez de confiar en el esquema `soflia://`.** El esquema de URL
  personalizado no es un canal confidencial en Windows: cualquier aplicación
  local puede registrarlo e interceptar el retorno. El `code_verifier` nunca
  cruza al proceso main ni se persiste; solo vive en memoria del renderer. Quien
  intercepte el ticket no tiene con qué canjearlo. Esto es exactamente lo que
  RFC 8252 exige para esquemas de uso privado.
- **Servidor local (`http://127.0.0.1:<puerto>`) descartado deliberadamente**,
  aunque RFC 8252 lo prefiera (nadie puede secuestrar un puerto ya enlazado).
  Se descartó porque exige levantar un servidor efímero por intento y dispara el
  diálogo de firewall de Windows en el primer uso. Queda como mejora posterior
  si aparece evidencia de secuestro del esquema.
- **El destino de la redirección está fijo en el servidor de Learning.** Ningún
  parámetro del cliente lo influye — es la única defensa efectiva contra
  convertir el modo escritorio en un redirector abierto que exfiltre tickets.
- **El ticket se guarda hasheado, nunca en claro**, y su ventana de validez es
  corta (~1 minuto) porque solo tiene que sobrevivir un redirect y una llamada
  inmediata.
- **La identidad sale siempre del estado de sesión que Learning ya estableció**,
  nunca de un correo o UUID que el cliente proponga en el cuerpo de la petición.
- **Taxonomía de error indistinguible.** Ticket inexistente, expirado, ya
  consumido o con verificador incorrecto devuelven todos `invalid_ticket`.
  Distinguirlos permitiría a un atacante con un ticket interceptado averiguar si
  sigue vivo.
- **Sin sesión parcial ante fallo.** Cualquier fallo de autorización posterior a
  `verifyOtp` (sin membresía activa, identidad no coincide) cierra la sesión de
  Supabase Auth recién creada antes de devolver el error.
- **Nada se registra**: ni el ticket, ni el verificador, ni el `tokenHash`, ni
  el correo, en ningún log de éxito o fallo. Los registros distinguen éxito de
  fallo por código, no por contenido.
- **El navegador integrado nunca ejecuta el paso de identidad.** Los
  proveedores de identidad rechazan user-agents embebidos, y el escritorio no
  debe tener oportunidad de ver el formulario de credenciales.

## 8. Configuración

| Variable | Dónde se lee | Naturaleza | Efecto si falta |
|---|---|---|---|
| `VITE_LEARNING_BASE_URL` | `electron/learning-sso.ts` (main, en build) y `src/config.ts` (renderer) | Pública | La entrada federada no se ofrece; el inicio por contraseña no cambia. |
| `VITE_LEARNING_SSO_ENABLED` | `src/config.ts` | No secreta — es el interruptor de rollback | Ausente o distinto de `'true'`: la entrada no se monta y **cualquier retorno del flujo se ignora**. |

Nota de implementación no obvia: en `electron/learning-sso.ts`, `VITE_LEARNING_BASE_URL`
se lee de `process.env` como **expresión literal**, porque el bundler del proceso
main sustituye esa expresión textualmente en tiempo de build
(`config/vite/env-defines.mts`). Leerla indirectamente a través de un objeto la
esquiva, y en la app empaquetada eso devuelve vacío porque ahí `process.env` solo
trae el entorno del sistema operativo — el `.env` del entorno de build no viaja
al equipo del usuario.

Ninguna clave del proveedor de identidad (Google/Microsoft) llega nunca a este
repositorio: vive únicamente en Learning, porque toda variable con prefijo
`VITE_` viaja en claro dentro del bundle distribuido.

## 9. Guía de portabilidad a Project Hub

Contexto confirmado con el usuario: **Project Hub es una aplicación web**, no un
cliente de escritorio, y aún no está confirmado si comparte la instancia
Supabase SOFIA o si vive en un proyecto propio (p. ej. IRIS,
`VITE_IRIS_SUPABASE_URL`, que en este repositorio ya es una instancia distinta
de SOFIA). Esta sección cubre ambos escenarios.

### 9.1. Qué NO trasladar tal cual

Buena parte de la complejidad de este diseño (deep link, PKCE con verificador en
memoria, tabla de tickets hasheados, arranque en frío, `open-url` de macOS)
existe **específicamente** porque el canal de retorno de un cliente de
escritorio (`soflia://...`) no es confidencial: cualquier proceso local puede
registrar el mismo esquema. Una aplicación web con dominio propio y TLS **no
tiene ese problema** — su redirección HTTPS de vuelta ya es confidencial y ya
está ligada a su origen por el navegador. Copiar el mecanismo de ticket +
deep link a una app web sería sobre-ingeniería: añade una tabla, un hash y un
endpoint que el flujo estándar de redirección no necesita.

### 9.2. Flujo recomendado para Project Hub (web)

Es el patrón OAuth de "autorización delegada" estándar, con Learning en el rol
de proveedor de identidad y Project Hub en el rol de cliente confidencial (si
tiene backend propio) o público (si el intercambio ocurre solo en el navegador):

1. Project Hub redirige (o abre en la misma pestaña) a un endpoint de Learning
   equivalente a `/api/auth/desktop/start`, pero orientado a web — por ejemplo
   `/api/auth/web/start` — pasando `redirect_uri` (la URL de callback propia de
   Project Hub, que Learning debe tener en una **lista blanca** de orígenes
   permitidos) y un `state` de correlación generado por Project Hub.
2. Learning ejecuta su SSO real con Google/Microsoft (sin cambios respecto al
   flujo de escritorio: esa pieza se reutiliza tal cual, es agnóstica del
   cliente).
3. Learning redirige de vuelta a `redirect_uri` con un código de un solo uso
   (puede ser el mismo mecanismo de ticket corto que ya existe, o un
   `authorization_code` estándar — la elección es de Learning, no de Project
   Hub) y el `state`.
4. El backend de Project Hub (o el propio navegador si no hay backend) canjea
   ese código por un `tokenHash` en un endpoint de intercambio de Learning,
   igual que hace `exchangeTicketForSofiaSession` hoy.
5. A partir de aquí, la rama se bifurca según la instancia Supabase de Project
   Hub — ver 9.3 y 9.4.

PKCE sigue siendo buena práctica incluso en web (protege contra fuga del código
por el historial del navegador o por un `referrer` mal configurado), pero ya no
es la única defensa: la confidencialidad de TLS + el `redirect_uri` en lista
blanca son la primera línea, no el verificador en memoria.

**`state` sigue siendo obligatorio** en cualquier variante: es la defensa
estándar contra CSRF en flujos de redirección OAuth, independiente de si el
transporte es un deep link o un `redirect_uri` HTTPS.

### 9.3. Escenario A — Project Hub usa el mismo proyecto Supabase que SOFIA/Learning

Este es el caso simple: reutilizar el endpoint de canje de Learning y
`verifyOtp({ token_hash, type: 'magiclink' })` **tal cual**, apuntando al mismo
proyecto (`mrqnnmuckznvukjvfkly`). El `user.id` resultante ya es el correcto
para las políticas RLS de Project Hub, porque es la misma instancia de
identidad. Este es literalmente el mismo paso 11 del flujo de escritorio
(§3), solo que ejecutado desde un navegador con `redirect_uri` en vez de un
proceso Electron con deep link.

### 9.4. Escenario B — Project Hub usa un proyecto Supabase propio (p. ej. IRIS)

Aquí no basta con `verifyOtp` contra SOFIA: eso produce una sesión **del
proyecto SOFIA**, no una sesión válida contra las políticas RLS del proyecto
propio de Project Hub. Se necesita un segundo salto de federación, que este
mismo repositorio ya resolvió para el caso análogo Hub↔Lia — ver
`openspec/changes/federate-sofia-lia-session/design.md` — y que se traslada así:

1. Project Hub completa el paso 9.3 y obtiene un JWT SOFIA válido (`access_token`).
2. Una función de servidor propia de Project Hub (Edge Function o equivalente)
   recibe `Authorization: Bearer <JWT SOFIA>`, y:
   - Valida el token llamando a `sofia.auth.getUser(token)` — **nunca** decodifica
     el JWT sin verificar ni acepta un `user_id`/correo enviado en el cuerpo.
   - Comprueba membresía activa (`organization_users.status = 'active'`) con el
     mismo JWT, bajo RLS de SOFIA.
   - Usa su propio cliente administrativo (`service_role` **del proyecto de
     Project Hub**, nunca el de SOFIA) para `generateLink({ type: 'magiclink', email })`
     sobre su propio proyecto, creando el usuario si es la primera vez que
     entra por esta vía (`generateLink` es idempotente por correo).
   - Devuelve únicamente `{ tokenHash }`, con `Cache-Control: no-store`.
3. El cliente de Project Hub canjea ese `tokenHash` con `verifyOtp` sobre **su
   propio** proyecto y obtiene una sesión nativa de su propia base.

Esto preserva la propiedad más valiosa del diseño original: el `service_role`
de cada proyecto queda confinado a su propio backend, y ningún secreto
administrativo llega nunca al cliente. El UUID de Project Hub no tiene que
coincidir con el de SOFIA — solo el correo, que es lo que ata ambas
identidades.

### 9.5. Checklist de implementación para Project Hub

- [ ] Confirmar con Learning si expondrá un `redirect_uri` en lista blanca por
      cliente, o si reutiliza el mismo esquema de ticket con un `redirect_uri`
      añadido al payload — cualquiera de las dos formas es válida siempre que
      el destino final no lo decida el cliente en un parámetro libre.
- [ ] Confirmar el escenario 9.3 vs 9.4 (instancia Supabase de Project Hub).
- [ ] Si es 9.4: desplegar la función de intercambio con `verify_jwt = false`
      en el gateway (el JWT es de SOFIA, no del proyecto propio) pero
      autenticación obligatoria dentro del handler — igual que
      `federate-sofia-lia-session`.
- [ ] Decidir dónde vive el `state`/PKCE en una app web: `sessionStorage` (no
      `localStorage`, para que no sobreviva más de la pestaña) es el análogo
      web del `ref` en memoria del renderer de escritorio.
- [ ] Definir la taxonomía de error igual de indistinguible que el desktop
      (`invalid_ticket` / `access_denied` / `exchange_unavailable`) y la misma
      política de reintento (no reintentar 401/403, sí red/5xx con backoff).
- [ ] No registrar ticket, código, `tokenHash` ni correo en logs de éxito o
      fallo — mismo estándar que el escritorio.
- [ ] Verificar con las mismas cuentas de control que usó el rollout de
      escritorio: cuenta solo-SSO sin contraseña, cuenta con contraseña, cuenta
      sin membresía activa, código reutilizado, código expirado, verificador/
      `redirect_uri` incorrecto.
- [ ] Mantener el inicio por contraseña existente de Project Hub (si lo tiene)
      como camino alterno, detrás de un interruptor de configuración
      independiente — mismo patrón de reversión sin publicar versión.

## 10. Fuera de alcance / deuda conocida

El inicio de sesión por WhatsApp del Hub (`electron/iris/auth/`) sigue
exigiendo contraseña; las cuentas solo-SSO no pueden autenticarse por ese
canal. Es una consecuencia conocida y documentada, no resuelta por este
sistema. Si Project Hub tiene un canal de autenticación equivalente por fuera
del navegador, hereda la misma limitación salvo que se resuelva aparte.

---

## 11. Contrato web confirmado — implementado en Project Hub

Esta sección deja de ser guía general (§9) y pasa a ser el contrato concreto
que **Project Hub ya implementa** en su lado. El equipo de Learning necesita
implementar el lado servidor descrito aquí para que el flujo funcione
end-to-end; hasta entonces, el botón "Continuar con SofLIA Learning" existe
en Project Hub pero el intercambio fallará con `exchange_unavailable`.

Para entregar esto al equipo de Learning como ticket de implementación, usar
`learning-web-sso-spec.md` (mismo repo) — es la versión autocontenida de lo
que sigue en esta sección, con contratos HTTP completos, ejemplos de
request/response y checklist de verificación, pensada para no requerir leer
el resto de este documento.

### 11.1. Decisión sobre el checklist de §9.5

- **Escenario confirmado:** 9.3 simplificado. Project Hub usa su propia
  Supabase (`IRIS_SUPABASE`) para datos de producto, pero **no usa sesiones
  de Supabase Auth para sí mismo** — tiene su propio sistema de JWT
  (`lib/auth/jwt.ts`). SOFIA solo se usa para verificar identidad. Esto
  significa que no hace falta el segundo salto de federación de §9.4: basta
  con validar la identidad SOFIA (vía `verifyOtp` + `auth.getUser`) y
  alimentarla al mismo pipeline que ya usa el login por password
  (sincronizar espejo local, emitir JWT propio).
- **Mecanismo de retorno:** se reutiliza el mismo mecanismo de ticket corto
  que ya existe para escritorio (`desktop_sso_tickets`, `consume_desktop_sso_ticket`),
  sin tabla ni esquema nuevo — solo cambia el parámetro `redirect_uri` y el
  destino final de la redirección.
- **`state`/PKCE:** el `code_verifier` viaja dentro de un `state` firmado
  (HMAC-SHA256, expira a los 10 minutos) que Project Hub genera y verifica
  en su propio servidor — no se usa cookie ni `sessionStorage` porque el
  intercambio con Learning ocurre server-to-server en el callback.
- **Taxonomía de error:** idéntica a la del escritorio
  (`invalid_ticket` / `access_denied` / `exchange_unavailable`), más
  `invalid_state` para el anti-CSRF propio del callback web.
- **Reintentos:** mismo backoff acotado que el Hub (250ms / 750ms) en
  errores de red o 5xx/429; 401/403 no se reintentan.
- **Logging:** mismo estándar — ni ticket, ni verificador, ni `tokenHash`,
  ni correo, en logs de éxito o fallo.

### 11.2. Lo que Learning debe exponer

- `GET /api/auth/web/start?state=<opaco>&redirect_uri=<url>&code_challenge=<b64url>`
  — mismo comportamiento que `/api/auth/desktop/start`, con dos diferencias:
  1. `redirect_uri` reemplaza al deep link fijo como destino de la
     redirección final: `{redirect_uri}?state=<mismo state>&ticket=<ticket>`
     (o `&error=access_denied` si el usuario cancela/es denegado).
  2. `redirect_uri` **debe validarse contra una lista blanca** de orígenes
     de Project Hub antes de ejecutar el SSO real. Valores a registrar:
     - Dev: `http://localhost:3000/api/auth/callback/learning`
     - Prod: `TODO — dominio real de Project Hub una vez desplegado`
- `POST /api/auth/web/exchange` con `{ ticket, code_verifier }` — **idéntico**
  al `/api/auth/desktop/exchange` existente (mismo `consume_desktop_sso_ticket`,
  misma tabla, mismo `generateLink({type:'magiclink'})` sobre SOFIA, misma
  respuesta `{tokenHash}` con `Cache-Control: no-store`, misma taxonomía de
  error del §5).

No se requiere ningún cambio de esquema en `desktop_sso_tickets`: la tabla
no distingue "para qué cliente" se pidió el ticket, así que el mismo
mecanismo sirve para escritorio y web sin modificación.

### 11.3. Lo que Project Hub ya implementa (este repositorio)

| Archivo | Responsabilidad |
|---|---|
| `lib/auth/learning-sso-state.ts` | Firma/verifica el `state` (HMAC), que lleva el `code_verifier` PKCE. |
| `lib/auth/sofia-auth.ts` (`authenticateSofiaSsoSession`, `exchangeSofiaMagicLink`) | Canjea el `tokenHash` por sesión SOFIA (`verifyOtp` con cliente anon) y valida el `access_token` resultante (`auth.getUser`). |
| `lib/auth/sofia-login-pipeline.ts` (`completeSofiaLogin`) | Pipeline compartido con el login por password: sincroniza `account_users`, trae workspaces, emite JWT propio, crea sesión. |
| `lib/auth/post-login-redirect.ts` | Decide el destino post-login (dashboard único / select-organization / admin), igual para password y SSO. |
| `app/api/auth/learning/start/route.ts` | Genera PKCE + `state`, redirige a `{LEARNING_BASE_URL}/api/auth/web/start`. |
| `app/api/auth/callback/learning/route.ts` | Recibe el retorno de Learning, hace el exchange server-to-server, valida con SOFIA, completa el login y entrega la sesión al navegador. |
| `app/auth/sign-in/page.tsx` | Botón "Continuar con SofLIA Learning", detrás de `NEXT_PUBLIC_LEARNING_SSO_ENABLED`. |

Variables de entorno nuevas (ver `.env.example`): `LEARNING_BASE_URL`,
`LEARNING_REDIRECT_URI`, `LEARNING_SSO_ENABLED` (servidor, autoridad real),
`NEXT_PUBLIC_LEARNING_SSO_ENABLED` (solo gatea si se pinta el botón).
