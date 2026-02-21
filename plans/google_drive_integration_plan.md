# Plan de Implementación: Integración de Documentación y Excel (Google Drive) en Proyectos IRIS

Este plan detalla la ejecución técnica para transformar a IRIS en el **System of Record (SoR) definitivo**, permitiendo que los proyectos gestionen documentos internos y hojas de cálculo (Excel/Google Sheets) mediante la arquitectura Master-Satellite.

---

## 1. Épicas de Implementación

### Épica 1: Infraestructura de Evidencia (SoR Core)

**Autonomía:** L0 (Read) → L3 (Auto SAFE)  
**Dependencias:** Ninguna.

- **Story 1.1 (DB):** Migración de tabla `pm_project_documents` para almacenamiento de `evidence_ref`.
- **Story 1.2 (Security):** Implementación de RLS (Row Level Security) basado en membresía de proyecto y organización.
- **Criterio de Aceptación:** Tablas creadas en Supabase y `audit_events` registrando cada operación INSERT/DELETE.

### Épica 2: Conector Universal Google Workspace (Satellite UI)

**Autonomía:** L1 (Draft)  
**Dependencias:** Épica 1.

- **Story 2.1 (Auth):** Configuración de OAuth2 con scopes `drive.file` y `spreadsheets`.
- **Story 2.2 (Picker):** Implementación de componente `GoogleDrivePicker` para selección de archivos existentes.
- **Criterio de Aceptación:** Capacidad de seleccionar un archivo de Drive desde la UI de IRIS y persistir su ID.

### Épica 3: Automatización de "Project Sheets" (Quick Win)

**Autonomía:** L2 (Write con Aprobación)  
**Dependencias:** Épica 2.

- **Story 3.1 (Templates):** Repositorio de plantillas Google Sheets para presupuestos, KPIs y cronogramas.
- **Story 3.2 (Flow):** Botón "Crear Excel del Proyecto" que clona una plantilla y la vincula automáticamente.
- **Criterio de Aceptación:** Creación de un archivo en Drive desde IRIS con nombre estandarizado (ej: `[PROJ-KEY] Master Sheet`) en < 3s.

### Épica 4: Visualización y Preview Directo

**Autonomía:** L0 (Read)  
**Dependencias:** Épica 2.

- **Story 4.1 (Viewer):** Integración de Google Docs/Sheets Viewer vía iframe seguro.
- **Story 4.2 (Tab):** Creación de la pestaña "Documentación" en el panel de detalle del proyecto.
- **Criterio de Aceptación:** Previsualización funcional del contenido del Excel sin redirección externa.

---

## 2. Cronograma de 4 Semanas

| Semana | Épica     | Responsable    | Entregable Clave                                     |
| :----- | :-------- | :------------- | :--------------------------------------------------- |
| **1**  | [Épica 1] | Backend/DB     | Schema migrado + API v1 funcional.                   |
| **2**  | [Épica 2] | Frontend       | Componente Picker integrado y autenticado.           |
| **3**  | [Épica 3] | IA/Automations | Flujo de clonación de plantillas Sheets.             |
| **4**  | [Épica 4] | Frontend/QA    | Tab de Documentos + Auditoría integral en el Ledger. |

---

## 3. Matriz de Riesgos y Mitigaciones

| Riesgo                                            | Impacto | Mitigación                                                                                |
| :------------------------------------------------ | :------ | :---------------------------------------------------------------------------------------- |
| **Token Expiry:** Pérdida de conexión con Google. | Alto    | Implementar gestión de refresh tokens y UI de "Reconexión Necesaria".                     |
| **Shadow Truth:** Ediciones fuera de IRIS.        | Medio   | IRIS actúa como SoR del _vínculo_. El satélite (Drive) es dueño del _contenido dinámico_. |
| **Privacy Leak:** Acceso no autorizado.           | Crítico | Forzar el uso de Carpetas de Equipo (Shared Drives) para centralizar permisos.            |

---

## 4. Gobernanza y Auditoría

Cualquier vinculación de documento se registrará en el **Ledger append-only**:

- **Acción:** `PROJECT_DOCUMENT_LINK` / `PROJECT_DOCUMENT_UNLINK`
- **Metadatos:** `google_file_id`, `user_id`, `project_id`.
- **Nivel de Autonomía:** L3 (Auto SAFE) debito a que la desvinculación es una acción reversible.

Este plan materializa la visión de IRIS como el "Sistema Operativo de la Empresa" integrando el conocimiento disperso en Google Workspace de forma estructurada.
