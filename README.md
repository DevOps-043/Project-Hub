# 🌟 Project Hub - Plataforma de Gestión de Proyectos con IA

> Plataforma educativa y de gestión moderna con **Inteligencia Artificial integrada** para una experiencia de aprendizaje y colaboración sin precedentes.

---

## 📋 Tabla de Contenidos

- [Visión General del Proyecto](#-visión-general-del-proyecto)
- [Arquitectura Multi-Tenant (Organizaciones y Slugs)](#-arquitectura-multi-tenant-organizaciones-y-slugs)
- [Características Principales](#-características-principales)
- [ARIA: Tu Agente de IA](#-aria-tu-agente-de-ia)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura (Screaming Architecture)](#-arquitectura-screaming-architecture)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Variables de Entorno](#-variables-de-entorno)
- [Scripts Disponibles](#-scripts-disponibles)

---

## 🔭 Visión General del Proyecto

**Project Hub** es una plataforma centralizada que redefine la colaboración en equipo, uniendo la gestión de tareas, el análisis de rendimiento y la integración de inteligencia artificial reactiva. Ha sido concebida para servir como un centro neurálgico o **Dashboard Administrativo**, fusionando herramientas de administración y aprendizaje con un agente de IA embebido en los procesos operativos.

---

## 🏢 Arquitectura Multi-Tenant (Organizaciones y Slugs)

Una de las piezas fundamentales de Project Hub es su arquitectura orientada a la segmentación mediante **Organizaciones (Tenants)**:

- **Bases de Datos Aisladas Lógicamente**: Toda la información de proyectos, tareas, dashboards y usuarios está atada al identificador de su Organización (`organization_id`), garantizando la máxima privacidad y un control de accesos perimetral.
- **Acceso por Slugs Personalizados**: Las empresas integradas en la plataforma accederán a través de URL semánticas dedicadas mediante su **Slug de Organización** (ej. `app.midominio.com/[mi-empresa-slug]/dashboard`). Esto dinamiza el enrutamiento y la personalización gráfica (branding) para múltiples clientes desde una sola base de código (Next.js).
- **Gestión de Planes de Suscripción**: Cada organización tiene su propio control de suscripción (Team, Business, Enterprise) y estados de salud (Activa, Trial o Suspendida).

---

## ✨ Características Principales

### 📊 Gestión de Proyectos (Project Hub)

El corazón aplicativo del sistema está basado en metodologías ágiles y seguimiento avanzado:

- **Creación de Proyectos Aislados**: Organiza el trabajo en proyectos específicos, vinculados al contexto estricto de la Organización actual.
- **Tablero de Tareas y Tickets**: Flujos Kanban para el seguimiento interactivo de actividades, donde las tareas fluyen a través de estados configurables (ej. "En progreso" a "Completado").
- **Sistema de Estimaciones**: Incorporación de _puntos de historia_ (story points) para evaluar carga laboral, permitiendo una planificación eficiente de sprints y medición del rendimiento.

### 👥 Gestión de Equipos y Jerarquía

Administración robusta para cualquier tamaño de escuadrón:

- **Roles y Permisos Múltiples**: Control de acceso granular y seguro para niveles de "Propietario" (Owner), "Administrador" (Admin) y "Miembro" (Member) confinados dentro de la Organización.
- **Perfiles de Usuario Completos**: Cada miembro posee control sobre sus datos personales, historial y actualización de avatares.
- **Consola de Administración**: Altas, bajas y modificaciones (ABM) de usuarios e invitaciones mediante una interfaz central.

### 🎨 Experiencia de Usuario (UX) Premium

El aspecto visual obedece a directrices modernas y dinámicas:

- **Diseño Ultra Responsivo**: Adaptabilidad perfecta a ecosistemas de escritorio, tableta y móvil con Tailwind CSS.
- **Tema Oscuro/Claro**: Alternancia fluida gestionada en persistencia de forma nativa.
- **Micro-interacciones Dinámicas**: Comportamientos kinésicos sofisticados mediante **Framer Motion** para dar _feedback_ visual a cada clic y transición de página.

### 🛠 Dashboard Administrativo de Alto Nivel

Un panel de control para operadores globales:

- **Analytics Core**: Visualización interactiva y en tiempo real de los KPIs de la organización (progreso del equipo, accesos y consumo de recursos).
- **Gestión Unificada**: Operaciones rápidas sobre herramientas y reportes estadísticos exportables.

---

## 🤖 ARIA: Tu Agente de IA

En Project Hub, el puente entre datos y productividad natural es la inteligencia artificial integrada.

**ARIA** (Automated Reasoning and Interactive Assistant) no es un simple bot conversacional, es un **Agente Activo con Capacidad de Ejecución**. Emplea el motor _Gemini 2.0 Flash_, con la facultad de utilizar _Function Calling_ directamente en el backend para realizar acciones reales conectadas estrictamente al contorno de la base de datos de tu **Organización**.

### Habilidades Actuales e Integración (Tools)

ARIA expone herramientas programáticas y deterministas al modelo de lenguaje para operar la plataforma como si fuera un administrador humano:

| Categoría     | Acción en Código       | Descripción del Propósito en el Entorno                                                                  |
| ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Tareas**    | `create_task`          | Genera y asigna nuevas tareas interpretando parámetros como prioridad, puntos e iteraciones del usuario. |
| **Tareas**    | `update_task_status`   | Actualiza estados de ticket (ej. arrastrar de "Doing" a "Done") por conversación natural.                |
| **Tareas**    | `update_task_priority` | Ajuste en tiempo real de urgencias de un ticket si cambia el contexto.                                   |
| **Proyectos** | `create_project`       | Inicia un bloque completo de proyecto infiriendo el dominio y contexto requerido.                        |
| **Equipo**    | `manage_team_member`   | Administra acceso corporativo, roles y suspensiones de forma automatizada mediante diálogo.              |
| **Perfil**    | `update_user_avatar`   | Transforma y actualiza variables de usuario basándose en peticiones naturales.                           |

**Flexibilidad Avanzada:**

- **Inyección de Contexto Tenant**: ARIA sabe perfectamente en qué Organización e interfaz te ubicas al enviarle un requerimiento.
- **Multimodalidad**: ARIA procesa y analiza tanto texto como adjuntos visuales e imágenes relevantes para la ejecución.
- **Streaming Bidireccional**: Rendimiento en tiempo real utilizando el SDK de Vercel AI / Generative AI SDK, evitando cuellos de botella para el usuario.
- **Niveles de Razonamiento**: Configuración ajustable (`thinkingLevel`) a nivel de aplicación para tareas o respuestas de lógica deductiva profunda.

---

## 🛠 Stack Tecnológico

El producto ha sido forjado con un stack full TypeScript para garantizar _Type Safety end-to-end_, velocidad y una experiencia de desarrollo limpia.

### Ecosistema Frontend (`apps/web`)

- **Routing & Framework**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript 5
- **Estilos y Componentes**: TailwindCSS 3 + Radix UI Primitives / CVA
- **Gestión de Estado**: Zustand y manejadores nativos React.
- **Capa Visual Reactiva**: Framer Motion
- **Inteligencia Artificial**: `@google/generative-ai`

### Ecosistema Backend (`apps/api`)

- **Servidor y API**: Express 4 con enrutamiento de microservicios y _Rate Limiting_.
- **Lenguaje**: TypeScript 5
- **Garantía y Esquematización**: Zod
- **Autenticación y Seguridad**: JWT, Bcrypt, Helmet + Supabase Auth.
- **Motor Relacional**: Supabase (Base de datos PostgreSQL).

### Base de Código Compartida (Monorepo)

- El código implementa repositorios gestionados (`Workspaces`) para aislar funciones bajo el área `packages/shared`, maximizando el re-uso de validaciones e interfaces (`interfaces`, `enums`) compartidos entre Front y API.

---

## 📐 Arquitectura (Screaming Architecture)

La plataforma modela su sistema de repositorios utilizando **Screaming Architecture**, en la cual los dominios de la lógica del negocio determinan inequívocamente la distribución en carpetas superior:

```text
Project-Hub/
├── apps/
│   ├── web/                 # Aplicación del Cliente Next.js
│   │   └── src/
│   │       ├── app/         # Enrutador App Router (Dashboards Dinámicos con Slug, Proyectos, Auth)
│   │       ├── features/    # Módulos Exclusivos de Negocio
│   │       │   ├── auth/    # Login, Roles, y Tenant Context
│   │       │   └── tools/   # Herramientas AI
│   │       ├── shared/      # Librería Interna (Botones, UX)
│   │       ├── core/        # Mutaciones Globales y Stores (Zustand)
│   │       └── lib/         # Controladores externos (Gemini AI, Supabase Client)
│   │
│   └── api/                 # Capa de Procesamiento y Servicios
│       └── src/
│           ├── features/    # Controladores, Repositorios por Entidad (Organization, Projects)
│           └── core/        # Middlewares de Organización, JWT y Seguridad
│
└── packages/                # Abstracciones Globales
    └── shared/              # End-to-end Zod schemas y Tipado Compartido TS
```

---

## 🚀 Instalación y Configuración

### Prerrequisitos del Sistema

- **Node.js** (Versión recomendada: >= 22.0.0)
- Instancia activa en **Supabase** (Base de datos PostgreSQL migrada).
- **API Key de Google Gemini** activa.

### Pasos Iniciales

1. **Clonar e instalar dependencias**

   ```bash
   git clone <repo> Project-Hub
   cd Project-Hub
   npm install
   ```

2. **Entorno del Backend (Capa Lógica)**

   ```bash
   cd apps/api
   cp .env.example .env
   ```

3. **Entorno del Frontend (Capa Visual)**

   ```bash
   cd apps/web
   cp .env.example .env.local
   ```

4. **Ejecutar Aplicativo Multiservicio**
   ```bash
   npm run dev
   ```

El Frontend inicializa en `localhost:3000` y el interceptor API en `localhost:4000`.

---

## 🔐 Variables de Entorno

### Configuración de Frontend (`apps/web/.env.local`)

```env
# Enrutamiento y Base de datos Segura
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SUPABASE_URL=<< URL DE TU BACKEND SUPABASE >>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<< TU LLAVE PÚBLICA SUPABASE >>

# Inteligencia Artificial
GOOGLE_API_KEY=<< TU CLAVE DE GOOGLE AI STUDIO >>
GEMINI_MODEL=gemini-2.0-flash
GEMINI_MAX_TOKENS=8192
GEMINI_TEMPERATURE=0.7
GEMINI_THINKING_LEVEL=medium
```

### Configuración del Servidor (`apps/api/.env`)

```env
PORT=4000
JWT_SECRET=<< SECRETO PARA AUTENTICACIÓN >>
SUPABASE_URL=<< URL DE TU BACKEND >>
SUPABASE_SERVICE_ROLE_KEY=<< LLAVE BYPASS DE ADMINISTRADOR BASE DE DATOS >>
```

---

## 📜 Scripts Disponibles

| Comando         | Acción Principal                                                                  |
| :-------------- | :-------------------------------------------------------------------------------- |
| `npm run dev`   | Instancia interactiva de desarrollo en tiempo real.                               |
| `npm run build` | Compila TypeScript y dependencias listas para despliegue.                         |
| `npm run start` | Arranca la distribución compilada optimizada de los servicios nativos producidos. |

---

_Creado con ❤️ por el equipo de **Project Hub** - Forjando plataformas ágiles y cognitivas._
