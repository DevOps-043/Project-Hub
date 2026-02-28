# 🌟 Project Hub - Plataforma de Gestión de Proyectos con IA

> Plataforma educativa y de gestión moderna con **Inteligencia Artificial integrada**, **Google Drive nativo** y un **Bridge MCP** para conectar agentes externos — todo en una experiencia de colaboración sin precedentes.

---

## 📋 Tabla de Contenidos

- [Visión General del Proyecto](#-visión-general-del-proyecto)
- [Arquitectura Multi-Tenant (Organizaciones y Slugs)](#-arquitectura-multi-tenant-organizaciones-y-slugs)
- [Arquitectura Multi-Supabase](#-arquitectura-multi-supabase)
- [Características Principales](#-características-principales)
- [ARIA: Tu Agente de IA](#-aria-tu-agente-de-ia)
- [Google Drive & Documentos](#-google-drive--documentos)
- [Bridge MCP & API Keys](#-bridge-mcp--api-keys)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura (Screaming Architecture)](#-arquitectura-screaming-architecture)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Variables de Entorno](#-variables-de-entorno)
- [Scripts Disponibles](#-scripts-disponibles)

---

## 🔭 Visión General del Proyecto

**Project Hub** es una plataforma centralizada que redefine la colaboración en equipo, uniendo la gestión de tareas, el análisis de rendimiento, la integración de inteligencia artificial reactiva y la conexión con herramientas externas como **Google Drive** y **agentes MCP**. Ha sido concebida para servir como un centro neurálgico o **Dashboard Administrativo**, fusionando herramientas de administración y aprendizaje con un agente de IA embebido en los procesos operativos.

---

## 🏢 Arquitectura Multi-Tenant (Organizaciones y Slugs)

Una de las piezas fundamentales de Project Hub es su arquitectura orientada a la segmentación mediante **Organizaciones (Tenants)**:

- **Bases de Datos Aisladas Lógicamente**: Toda la información de proyectos, tareas, dashboards y usuarios está atada al identificador de su Organización (`organization_id`), garantizando la máxima privacidad y un control de accesos perimetral.
- **Acceso por Slugs Personalizados**: Las empresas integradas en la plataforma accederán a través de URL semánticas dedicadas mediante su **Slug de Organización** (ej. `app.midominio.com/[mi-empresa-slug]/dashboard`). Esto dinamiza el enrutamiento y la personalización gráfica (branding) para múltiples clientes desde una sola base de código (Next.js).
- **Gestión de Planes de Suscripción**: Cada organización tiene su propio control de suscripción (Team, Business, Enterprise) y estados de salud (Activa, Trial o Suspendida).

---

## 🔗 Arquitectura Multi-Supabase

Project Hub opera con **múltiples instancias Supabase** conectadas para separar responsabilidades:

```
┌─────────────────┐      ┌───────────────────┐
│  SOFIA Supabase  │      │  Project Hub Supa  │
│  (Auth Master)   │      │  (Data DB)         │
├─────────────────┤      ├───────────────────┤
│ users            │─────>│ account_users      │
│ organization_users│───>│ workspace_members  │
│ organizations    │─────>│ workspaces         │
└─────────────────┘      └───────────────────┘
       │                          │
       │                   ┌──────┴───────────┐
       │                   │ Content Generator │
       │                   │ (Contenido IA)    │
       │                   └──────────────────┘
       │
 ┌─────┴──────────┐
 │  LIA Extension  │
 │ (Conversaciones)│
 └────────────────┘
```

- **SOFIA**: Autenticación, usuarios, organizaciones (fuente de verdad).
- **Project Hub**: Datos de negocio, proyectos, tareas, workspaces, documentos, API keys.
- **Content Generator**: Contenido educativo generado por IA.
- **LIA Extension**: Datos de la extensión de escritorio (conversaciones, meetings).
- Al hacer login, se sincronizan datos de SOFIA a Project Hub automáticamente.

---

## ✨ Características Principales

### 📊 Gestión de Proyectos (Project Hub)

El corazón aplicativo del sistema está basado en metodologías ágiles y seguimiento avanzado:

- **Creación de Proyectos Aislados**: Organiza el trabajo en proyectos específicos, vinculados al contexto estricto del workspace actual.
- **Tablero de Tareas y Tickets**: Flujos Kanban para el seguimiento interactivo de actividades, donde las tareas fluyen a través de estados configurables (ej. "En progreso" a "Completado").
- **Sistema de Estimaciones**: Incorporación de _puntos de historia_ (story points) para evaluar carga laboral, permitiendo una planificación eficiente de sprints y medición del rendimiento.
- **Ciclos y Milestones**: Gestión de sprints/ciclos y milestones asociados a proyectos para tracking temporal avanzado.
- **Documentos Vinculados**: Cada proyecto e issue puede tener documentos de Google Drive/Sheets/Docs vinculados directamente, con preview embebido y análisis con IA.

### 👥 Gestión de Equipos y Jerarquía

Administración robusta para cualquier tamaño de escuadrón:

- **Roles y Permisos Múltiples (5 niveles)**: Control de acceso granular con roles de Owner, Admin, Manager, Leader y Member — cada uno con permisos independientes configurables por workspace.
- **Perfiles de Usuario Completos**: Cada miembro posee control sobre sus datos personales, historial y actualización de avatares.
- **Consola de Administración**: Altas, bajas y modificaciones (ABM) de usuarios e invitaciones mediante una interfaz central.
- **Sincronización con SOFIA**: Los miembros de la organización se sincronizan automáticamente desde SOFIA, mientras que los roles de Project Hub (`iris_role`) se editan de forma independiente.

### 🎨 Experiencia de Usuario (UX) Premium

El aspecto visual obedece a directrices modernas y dinámicas:

- **Diseño Ultra Responsivo**: Adaptabilidad perfecta a ecosistemas de escritorio, tableta y móvil con Tailwind CSS.
- **Tema Oscuro/Claro**: Alternancia fluida gestionada en persistencia de forma nativa con colores del sistema SOFIA.
- **Micro-interacciones Dinámicas**: Comportamientos kinésicos sofisticados mediante **Framer Motion** para dar _feedback_ visual a cada clic y transición de página.

### 🛠 Dashboard Administrativo de Alto Nivel

Un panel de control para operadores globales y para cada workspace:

- **Analytics Core**: Visualización interactiva y en tiempo real de los KPIs de la organización (progreso del equipo, accesos y consumo de recursos) con **Recharts**.
- **Gestión Unificada**: Operaciones rápidas sobre herramientas y reportes estadísticos exportables en PDF y CSV.
- **Reportes Ejecutivos**: Generación de reportes completos con `@react-pdf/renderer` y exportación CSV.
- **Heatmap de Actividad**: Visualización de actividad del equipo con mapas de calor interactivos.

---

## 🤖 ARIA: Tu Agente de IA

En Project Hub, el puente entre datos y productividad natural es la inteligencia artificial integrada.

**ARIA** (Automated Reasoning and Interactive Assistant) no es un simple bot conversacional, es un **Agente Activo con Capacidad de Ejecución**. Emplea el motor _Gemini 2.0 Flash_, con la facultad de utilizar _Function Calling_ directamente en el backend para realizar acciones reales conectadas estrictamente al contorno de la base de datos de tu **Organización**.

### Habilidades Actuales e Integración (Tools)

ARIA expone herramientas programáticas y deterministas al modelo de lenguaje para operar la plataforma como si fuera un administrador humano:

| Categoría      | Acción en Código       | Descripción del Propósito en el Entorno                                                                  |
| -------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Tareas**     | `create_task`          | Genera y asigna nuevas tareas interpretando parámetros como prioridad, puntos e iteraciones del usuario. |
| **Tareas**     | `update_task_status`   | Actualiza estados de ticket (ej. arrastrar de "Doing" a "Done") por conversación natural.                |
| **Tareas**     | `update_task_priority` | Ajuste en tiempo real de urgencias de un ticket si cambia el contexto.                                   |
| **Proyectos**  | `create_project`       | Inicia un bloque completo de proyecto infiriendo el dominio y contexto requerido.                        |
| **Equipo**     | `manage_team_member`   | Administra acceso corporativo, roles y suspensiones de forma automatizada mediante diálogo.              |
| **Perfil**     | `update_user_avatar`   | Transforma y actualiza variables de usuario basándose en peticiones naturales.                           |
| **Documentos** | `analyze_documents`    | Lee documentos vinculados de Google Drive y genera issues automáticamente con IA.                        |

### Herramientas de IA Adicionales

| Herramienta           | Endpoint                    | Descripción                                                 |
| --------------------- | --------------------------- | ----------------------------------------------------------- |
| **Agile Advisor**     | `/api/ai/agile-advisor`     | Recomienda metodología ágil basada en contexto y documentos |
| **Diagram Generator** | `/api/ai/diagram-generator` | Genera diagramas Mermaid automáticamente                    |
| **Predictive Report** | `/api/ai/predictive-report` | Genera reportes predictivos del proyecto                    |
| **Analyze Documents** | `/api/ai/analyze-documents` | Analiza documentos de Google Drive y crea issues con IA     |

**Flexibilidad Avanzada:**

- **Inyección de Contexto Tenant**: ARIA sabe perfectamente en qué Organización e interfaz te ubicas al enviarle un requerimiento.
- **Multimodalidad**: ARIA procesa y analiza tanto texto como adjuntos visuales, documentos de Google Drive e imágenes relevantes para la ejecución.
- **Streaming Bidireccional**: Rendimiento en tiempo real utilizando el SDK de Vercel AI / Generative AI SDK, evitando cuellos de botella para el usuario.
- **Niveles de Razonamiento**: Configuración ajustable (`thinkingLevel`) a nivel de aplicación para tareas o respuestas de lógica deductiva profunda.

---

## 📎 Google Drive & Documentos

Project Hub incorpora una integración nativa completa con **Google Drive**, **Google Sheets**, **Google Docs** y **Google Slides**:

### Conexión OAuth 2.0

- **Flujo OAuth2 seguro**: Los usuarios conectan su cuenta de Google mediante un flujo estándar con scopes de Drive, Sheets y perfil.
- **Tokens encriptados**: Los access/refresh tokens de Google se almacenan encriptados con AES-256-GCM en la tabla `auth_oauth_providers`.
- **Auto-refresh**: Los tokens se refrescan automáticamente cuando expiran (con margen de 5 minutos).

### Funcionalidades de Documentos

| Funcionalidad           | Descripción                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| **Google Drive Picker** | Selector nativo para elegir archivos de Drive directamente.            |
| **Vincular Documentos** | Asociar documentos de Drive a proyectos e issues específicos.          |
| **Preview Embebido**    | Vista previa inline de Docs, Sheets y Slides con iframe embed.         |
| **Subir Archivos**      | Upload directo de archivos al Drive del usuario desde la plataforma.   |
| **Crear Spreadsheets**  | Crear Google Spreadsheets vacíos o desde templates.                    |
| **Leer Documentos**     | Exportar contenido de Docs/Sheets/Slides como texto para análisis.     |
| **Análisis con IA**     | Enviar documentos vinculados a Gemini para generar issues automáticos. |
| **Pegar URLs**          | Parseo automático de URLs de Google para vincular documentos.          |

### Rutas OAuth de Google

| Método | Endpoint                      | Descripción                                  |
| ------ | ----------------------------- | -------------------------------------------- |
| `GET`  | `/api/auth/google/connect`    | Inicia flujo OAuth2 de Google                |
| `GET`  | `/api/auth/callback/google`   | Callback OAuth2, almacena tokens encriptados |
| `GET`  | `/api/auth/google/status`     | Verifica si la cuenta está conectada         |
| `POST` | `/api/auth/google/disconnect` | Desconecta cuenta y revoca tokens            |
| `GET`  | `/api/auth/google/token`      | Obtiene access token válido (auto-refresh)   |

---

## 🔌 Bridge MCP & API Keys

Project Hub expone un **Bridge API** que permite a agentes externos (como extensiones MCP, VS Code extensions o bots) conectarse y operar sobre los datos del workspace.

### Sistema de API Keys

- **Generación segura**: Keys con prefijo `phub_` (32 bytes aleatorios = 64 chars hex), hasheadas con HMAC-SHA256 antes de almacenar.
- **Scopes configurables**: Cada key tiene scopes (`read`, `write`) que limitan las operaciones permitidas.
- **Soft revoke**: Las keys se desactivan sin eliminar del registro para auditoría.
- **Tracking de uso**: Cada request actualiza `last_used_at` y `total_requests` atómicamente.
- **Expiración opcional**: Las keys pueden tener fecha de expiración.

### Endpoints del Bridge

| Método | Endpoint         | Auth    | Descripción                                                                                                         |
| ------ | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/ai/bridge` | API Key | Obtiene contexto completo del workspace (proyectos, tareas, miembros, schema)                                       |
| `POST` | `/api/ai/bridge` | API Key | Ejecuta acciones: `create_task`, `update_task`, `delete_task`, `update_project`, `create_milestone`, `create_cycle` |

### Endpoints Externos (LIA Extension)

| Método | Endpoint            | Descripción                      |
| ------ | ------------------- | -------------------------------- |
| `GET`  | `/api/ext/projects` | Lista proyectos para extensiones |
| `GET`  | `/api/ext/issues`   | Lista issues para extensiones    |

### Gestión de API Keys

| Método   | Endpoint                             | Descripción                  |
| -------- | ------------------------------------ | ---------------------------- |
| `GET`    | `/api/workspaces/:slug/api-keys`     | Lista API keys del workspace |
| `POST`   | `/api/workspaces/:slug/api-keys`     | Genera nueva API key         |
| `DELETE` | `/api/workspaces/:slug/api-keys/:id` | Revoca API key               |

---

## 🛠 Stack Tecnológico

El producto ha sido forjado con un stack full TypeScript para garantizar _Type Safety end-to-end_, velocidad y una experiencia de desarrollo limpia.

### Ecosistema Frontend (`apps/web`)

- **Routing & Framework**: Next.js 15+ (App Router)
- **Lenguaje**: TypeScript 5
- **Estilos y Componentes**: TailwindCSS 3 + Radix UI Primitives / CVA
- **Gestión de Estado**: Zustand 5 y manejadores nativos React
- **Capa Visual Reactiva**: Framer Motion 12
- **Inteligencia Artificial**: `@google/generative-ai` (Gemini 2.0 Flash)
- **Formularios**: React Hook Form 7 + Zod
- **Gráficas**: Recharts 3
- **Diagramas**: Mermaid 11
- **PDFs**: `@react-pdf/renderer`
- **Google Integration**: Google Drive/Sheets/Docs API via REST + OAuth2

### Ecosistema Backend (`apps/api`)

- **Servidor y API**: Express 4 con enrutamiento de microservicios y _Rate Limiting_.
- **Lenguaje**: TypeScript 5
- **Garantía y Esquematización**: Zod
- **Autenticación y Seguridad**: JWT, Bcrypt, Helmet + Supabase Auth + Token Encryption (AES-256-GCM).
- **Motor Relacional**: Supabase (Base de datos PostgreSQL) — Multi-instancia (SOFIA, Project Hub, ContentGen, LIA).

### Base de Código Compartida (Monorepo)

- El código implementa repositorios gestionados (`Workspaces`) para aislar funciones bajo el área `packages/shared`, maximizando el re-uso de validaciones e interfaces (`interfaces`, `enums`) compartidos entre Front y API.
- Incluye `@modelcontextprotocol/sdk` para integración MCP.

---

## 📐 Arquitectura (Screaming Architecture)

La plataforma modela su sistema de repositorios utilizando **Screaming Architecture**, en la cual los dominios de la lógica del negocio determinan inequívocamente la distribución en carpetas superior:

```text
Project-Hub/
├── apps/
│   ├── web/                     # Aplicación del Cliente Next.js
│   │   └── src/
│   │       ├── app/
│   │       │   ├── [orgSlug]/   # Páginas workspace (dashboard, projects, teams, analytics, etc.)
│   │       │   │   ├── admin/   # Sub-panel admin dentro del workspace
│   │       │   │   ├── projects/[id]/ # Detalle de proyecto con documentos
│   │       │   │   └── teams/[teamId]/ # Detalle de equipo
│   │       │   ├── admin/       # Páginas admin global (super_admin/admin only)
│   │       │   ├── api/
│   │       │   │   ├── auth/    # Auth routes + Google OAuth (connect, callback, status, token)
│   │       │   │   ├── admin/   # Admin API routes
│   │       │   │   ├── workspaces/ # Workspace API routes (scoped por workspace)
│   │       │   │   ├── ai/      # AI routes (agile-advisor, analyze-documents, bridge, diagram, predictive)
│   │       │   │   └── ext/     # API para extensiones externas (LIA)
│   │       │   └── unauthorized/
│   │       ├── components/
│   │       │   ├── admin/       # Componentes del panel admin
│   │       │   ├── google/      # GoogleDrivePicker, CollapsibleDocumentEmbed
│   │       │   ├── guards/      # Guards de permisos
│   │       │   └── tasks/       # Componentes de tareas
│   │       ├── features/        # Módulos de negocio (auth, dashboard, notifications, tools)
│   │       ├── shared/          # Utilidades compartidas (hooks, utils)
│   │       ├── core/            # Stores Zustand y servicios
│   │       ├── lib/
│   │       │   ├── auth/        # JWT, passwords, SOFIA auth, token-encryption
│   │       │   ├── supabase/    # Clientes multi-Supabase (server, sofia, content-gen, config)
│   │       │   ├── services/    # workspace-service, api-key-service, iris-data
│   │       │   ├── google/      # drive-service, drive-reader, document-utils
│   │       │   ├── ai/          # Gemini integration
│   │       │   └── notifications/
│   │       └── contexts/        # ThemeContext, WorkspaceContext
│   │
│   └── api/                     # Capa de Procesamiento y Servicios (Express)
│       └── src/
│           ├── core/            # Middlewares de Organización, JWT y Seguridad
│           └── features/        # Controladores, Repositorios por Entidad
│
└── packages/
    └── shared/                  # End-to-end Zod schemas y Tipado Compartido TS
```

---

## 🚀 Instalación y Configuración

### Prerrequisitos del Sistema

- **Node.js** (Versión recomendada: >= 22.0.0)
- **npm** (>= 10.5.1)
- Instancia activa en **Supabase** (Base de datos PostgreSQL migrada).
- **API Key de Google Gemini** activa.
- **(Opcional)** Credenciales de Google OAuth para integración con Drive.

### Pasos Iniciales

1. **Clonar e instalar dependencias**

   ```bash
   git clone <repo> Project-Hub
   cd Project-Hub
   npm install
   ```

2. **Configurar variables de entorno**

   Crear un archivo `.env` en la raíz del proyecto con las variables necesarias (ver sección de Variables de Entorno).

3. **Ejecutar Aplicativo Multiservicio**
   ```bash
   npm run dev
   ```

El Frontend inicializa en `localhost:3000` y el interceptor API en `localhost:4000`.

---

## 🔐 Variables de Entorno

### Configuración principal (`.env` en raíz)

```env
# ── API Configuration ──
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_NAME=Project Hub

# ── Supabase Principal (Project Hub - BD principal) ──
NEXT_PUBLIC_SUPABASE_URL=<< URL DE TU BACKEND SUPABASE >>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<< TU LLAVE PÚBLICA SUPABASE >>
SUPABASE_SERVICE_ROLE_KEY=<< LLAVE BYPASS DE ADMINISTRADOR >>

# ── SOFIA Supabase (Auth Master + Organizaciones) ──
NEXT_PUBLIC_SOFIA_SUPABASE_URL=<< URL DE SOFIA SUPABASE >>
NEXT_PUBLIC_SOFIA_SUPABASE_ANON_KEY=<< LLAVE PÚBLICA SOFIA >>

# ── LIA Extension Supabase (conversaciones, meetings) ──
NEXT_PUBLIC_LIA_SUPABASE_URL=<< URL DE LIA SUPABASE >>
NEXT_PUBLIC_LIA_SUPABASE_ANON_KEY=<< LLAVE PÚBLICA LIA >>

# ── Content Generator Supabase (contenido generado IA) ──
NEXT_PUBLIC_CONTENT_GEN_SUPABASE_URL=<< URL DE CONTENT GEN >>
NEXT_PUBLIC_CONTENT_GEN_SUPABASE_ANON_KEY=<< LLAVE PÚBLICA CONTENT GEN >>

# ── JWT ──
JWT_SECRET=<< SECRETO PARA AUTENTICACIÓN >>

# ── Google AI (Gemini) ──
NEXT_PUBLIC_GOOGLE_AI_KEY=<< TU CLAVE DE GOOGLE AI STUDIO >>

# ── Google OAuth & Drive Integration (Opcional) ──
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<< TU CLIENT ID DE GOOGLE >>
GOOGLE_CLIENT_SECRET=<< TU CLIENT SECRET >>
NEXT_PUBLIC_GOOGLE_API_KEY=<< TU API KEY DE GOOGLE >>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
```

### Configuración del Servidor Express (`apps/api/.env`)

```env
PORT=4000
API_VERSION=v1
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
JWT_SECRET=<< SECRETO PARA AUTENTICACIÓN >>
```

---

## 📜 Scripts Disponibles

| Comando           | Acción Principal                                                                     |
| :---------------- | :----------------------------------------------------------------------------------- |
| `npm run dev`     | Instancia interactiva de desarrollo multi-servicio (Frontend + Backend en paralelo). |
| `npm run dev:web` | Ejecuta solo el frontend (Next.js) en modo desarrollo.                               |
| `npm run dev:api` | Ejecuta solo el backend (Express) en modo desarrollo.                                |
| `npm run build`   | Compila TypeScript y dependencias listas para despliegue.                            |
| `npm run lint`    | Ejecuta linting en todos los workspaces.                                             |

---

_Creado con ❤️ por el equipo de **Project Hub** - Forjando plataformas ágiles y cognitivas._
