# 🌟 IRIS - Plataforma de Gestión de Proyectos con IA

> Plataforma educativa y de gestión moderna con **Inteligencia Artificial integrada** para una experiencia de aprendizaje y colaboración sin precedentes.

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Lia: Tu Agente de IA](#-lia-tu-agente-de-ia)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura](#-arquitectura)
- [Instalación](#-instalación)
- [Variables de Entorno](#-variables-de-entorno)
- [Estructura del Proyecto](#-estructura-del-proyecto)

---

## ✨ Características Principales

### 🧠 Inteligencia Artificial Avanzada

- **Asistente Virtual (Lia)**: Un agente contextual que vive en tu plataforma.
- **Multimodalidad**: Capacidad para entender texto e imágenes (adjuntos).
- **Razonamiento Profundo**: Configuración de `thinkingLevel` para respuestas complejas y analíticas.
- **Streaming en Tiempo Real**: Respuestas fluidas y naturales sin esperas.

### 📊 Gestión de Proyectos (Project Hub)

- **Creación de Proyectos**: Organiza el trabajo en proyectos específicos con claves únicas.
- **Tablero de Tareas**: Gestión completa de tickets con estados, prioridades y asignaciones.
- **Estimaciones**: Sistema de puntos de historia para metodologías ágiles.

### 👥 Gestión de Equipos

- **Roles y Permisos**: Control de acceso granular (Admin, Miembro, etc.).
- **Perfiles de Usuario**: Gestión de avatares y datos personales.
- **Administración de Miembros**: Invitar, suspender o cambiar roles de usuarios fácilmente.

### 🎨 Experiencia de Usuario (UX) Premium

- **Diseño Responsivo**: Funciona en todos los dispositivos.
- **Tema Oscuro/Claro**: Alternancia nativa con persistencia.
- **Micro-interacciones**: Animaciones fluidas con **Framer Motion**.
- **Interfaz Moderna**: Estética limpia utilizando **TailwindCSS**.

### 🛠 Dashboard Administrativo

Panel centralizado para la gestión total de la plataforma:

- **Analytics**: Visualización de datos clave.
- **Usuarios y Equipos**: ABM completo.
- **Herramientas y Reportes**: Zona dedicada para utilidades del sistema.

---

## 🤖 Lia: Tu Agente de IA

Lia no es solo un chatbot; es un agente con **capacidad de ejecución (Function Calling)**. Puede interactuar directamente con la base de datos y la lógica de negocio para realizar tareas por ti.

### Habilidades Actuales (Tools)

| Categoría     | Acción                 | Descripción                                                         |
| ------------- | ---------------------- | ------------------------------------------------------------------- |
| **Tareas**    | `create_task`          | Crea nuevas tareas con título, prioridad, puntos y fecha límite.    |
|               | `update_task_status`   | Mueve tareas entre estados (ej. de "In Progress" a "Done").         |
|               | `update_task_priority` | Ajusta la prioridad de los tickets urgentes.                        |
| **Proyectos** | `create_project`       | Inicializa nuevos espacios de trabajo para equipos.                 |
| **Equipo**    | `manage_team_member`   | Añade, remueve o actualiza roles de miembros del equipo.            |
| **Perfil**    | `update_user_avatar`   | Actualiza la foto de perfil del usuario basado en imágenes subidas. |

---

## 🛠 Stack Tecnológico

### Frontend (`apps/web`)

- **Framework**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript 5
- **Estilos**: TailwindCSS 3
- **Estado**: Zustand
- **Animaciones**: Framer Motion
- **IA Integration**: Google Generative AI SDK (Gemini 2.0 Flash)

### Backend (`apps/api`)

- **Server**: Express 4
- **Lenguaje**: TypeScript 5
- **Seguridad**: Helmet, Zod (Validación)
- **Base de Datos**: Supabase (PostgreSQL)

### Infraestructura

- **Repo**: Monorepo (Workspaces)
- **Deploy**: Vercel / Netlify compatible

---

## 📐 Arquitectura

Este proyecto sigue estrictamente la **Screaming Architecture**, donde la estructura de carpetas grita la intención del negocio.

```
IRIS/
├── apps/
│   ├── web/                 # Frontend Next.js
│   │   └── src/
│   │       ├── app/         # Router y Vistas
│   │       ├── features/    # Módulos de Negocio (Auth, Lia, Dashboard)
│   │       ├── shared/      # UI Kit reutilizable (Botones, Inputs)
│   │       ├── core/        # Lógica central (Stores, Services)
│   │       └── lib/         # Integraciones (AI, Supabase)
│   │
│   └── api/                 # Backend Express
│       └── src/
│           ├── features/    # Endpoints por módulo
│           └── core/        # Middlewares y Configuración
│
└── packages/                # Librerías compartidas
    └── shared/              # Tipos e interfaces comunes
```

---

## 🚀 Instalación

### Prerrequisitos

- Node.js >= 22.0.0
- Acceso a una instancia de Supabase
- API Key de Google Gemini

### Pasos

1. **Clonar y preparar:**

```bash
git clone <repo-url>
cd IRIS
npm install
```

2. **Backend Setup:**

```bash
cd apps/api
cp .env.example .env
# Configurar credenciales de Supabase y Puerto
```

3. **Frontend Setup:**

```bash
cd apps/web
cp .env.example .env.local
# Configurar credenciales de Supabase y Gemini AI
```

4. **Ejecutar en Desarrollo:**
   Desde la raíz del proyecto:

```bash
npm run dev
```

Esto iniciará tanto el frontend (localhost:3000) como el backend (localhost:4000).

---

## 🔐 Variables de Entorno

### Frontend (.env.local)

**Conexión y API:**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SUPABASE_URL=<TU_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<TU_SUPABASE_ANON_KEY>
```

**Inteligencia Artificial (Gemini):**

```env
GOOGLE_API_KEY=<TU_GEMINI_API_KEY>
GEMINI_MODEL=gemini-2.0-flash
GEMINI_MAX_TOKENS=8192
GEMINI_TEMPERATURE=0.7
GEMINI_THINKING_LEVEL=medium
```

### Backend (.env)

```env
PORT=4000
JWT_SECRET=<TU_SECRETO_JWT>
SUPABASE_URL=<TU_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=<TU_SERVICE_ROLE_KEY>
```

---

## 📜 Scripts Disponibles

| Script            | Descripción                                   |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Inicia todo el ecosistema en modo desarrollo. |
| `npm run dev:web` | Inicia solo el frontend.                      |
| `npm run dev:api` | Inicia solo el backend.                       |
| `npm run build`   | Construye la aplicación para producción.      |
| `npm run start`   | Inicia la versión de producción construida.   |

---

## 📁 Estructura Principal

- **`apps/web/src/features/lia`**: Lógica del agente de IA, hooks y componentes de chat.
- **`apps/web/src/lib/ai`**: Configuración del cliente Gemini y definiciones de herramientas (`tools`).
- **`apps/web/src/app/admin`**: Páginas del dashboard administrativo.
- **`database/migrations`**: Archivos SQL para la estructura de la base de datos.
- **`packages/shared`**: Tipos compartidos entre Front y Back para Type Safety total.

---

Creado con ❤️ por el equipo de **IRIS**.
