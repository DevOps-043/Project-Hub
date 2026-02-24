# Integración Google Drive & Sheets en Proyectos IRIS

Plan técnico para que los proyectos dentro de IRIS (Project Hub) puedan gestionar documentos, hojas de cálculo y archivos de Google Drive, cumpliendo con la arquitectura **Master–Satélite** del documento maestro.

IMPORTANT

**IRIS = Master (SoR):** solo registra vínculos, no almacena contenido binario.
**Google Drive/Sheets = Satélite:** almacena el contenido real y la edición colaborativa.

---

## Proposed Changes

### Capa de Datos (Database)

#### [NEW]

015_project_documents.sql

Nueva migración para crear la tabla `pm_project_documents`:

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all my-2 rounded-lg bg-list-hover-subtle border border-gray-500/20"><div class="min-h-7 relative box-border flex flex-row items-center justify-between rounded-t border-b border-gray-500/20 px-2 py-0.5"><div class="font-sans text-sm text-ide-text-color opacity-60">sql</div><div class="flex flex-row gap-2 justify-end"><div class="cursor-pointer opacity-70 hover:opacity-100"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-copy h-3.5 w-3.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg></div></div></div><div class="p-3"><div class="w-full h-full text-xs cursor-text"><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk15">CREATE</span><span class="mtk1"></span><span class="mtk15">TABLE</span><span class="mtk1"></span><span class="mtk22">IF</span><span class="mtk1"></span><span class="mtk15">NOT</span><span class="mtk1"></span><span class="mtk15">EXISTS</span><span class="mtk1"></span><span class="mtk18">public</span><span class="mtk1">.</span><span class="mtk18">pm_project_documents</span><span class="mtk1"> (</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1">  id            uuid </span><span class="mtk11 mtki">PRIMARY KEY</span><span class="mtk1"></span><span class="mtk11 mtki">DEFAULT</span><span class="mtk1"> gen_random_uuid</span><span class="mtk24">()</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1">  project_id    uuid </span><span class="mtk15">NOT NULL</span><span class="mtk1"></span><span class="mtk11 mtki">REFERENCES</span><span class="mtk1"></span><span class="mtk18">public</span><span class="mtk1">.</span><span class="mtk18">pm_projects</span><span class="mtk1">(project_id) </span><span class="mtk11 mtki">ON DELETE CASCADE</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk15">name</span><span class="mtk1"></span><span class="mtk10">text</span><span class="mtk1"></span><span class="mtk15">NOT NULL</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1"></span><span class="mtk15">provider</span><span class="mtk1"></span><span class="mtk10">text</span><span class="mtk1"></span><span class="mtk15">NOT NULL</span><span class="mtk1"></span><span class="mtk11 mtki">DEFAULT</span><span class="mtk1"></span><span class="mtk15">'</span><span class="mtk7">google_drive</span><span class="mtk15">'</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk1"></span><span class="mtk11 mtki">CHECK</span><span class="mtk1"> (</span><span class="mtk15">provider</span><span class="mtk1"></span><span class="mtk15">IN</span><span class="mtk1"> (</span><span class="mtk15">'</span><span class="mtk7">google_drive</span><span class="mtk15">'</span><span class="mtk1">, </span><span class="mtk15">'</span><span class="mtk7">google_sheets</span><span class="mtk15">'</span><span class="mtk1">, </span><span class="mtk15">'</span><span class="mtk7">google_docs</span><span class="mtk15">'</span><span class="mtk1">, </span><span class="mtk15">'</span><span class="mtk7">internal</span><span class="mtk15">'</span><span class="mtk1">)),</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk1">  external_id   </span><span class="mtk10">text</span><span class="mtk1"></span><span class="mtk15">NOT NULL</span><span class="mtk1">,            </span><span class="mtk3 mtki">-- Google File ID</span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk1">  external_url  </span><span class="mtk10">text</span><span class="mtk1"></span><span class="mtk15">NOT NULL</span><span class="mtk1">,            </span><span class="mtk3 mtki">-- Link directo al archivo</span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk1">  doc_type      </span><span class="mtk10">text</span><span class="mtk1"></span><span class="mtk15">NOT NULL</span><span class="mtk1"></span><span class="mtk11 mtki">DEFAULT</span><span class="mtk1"></span><span class="mtk15">'</span><span class="mtk7">document</span><span class="mtk15">'</span></div></div><div class="code-line" data-line-number="10" data-line-start="10" data-line-end="10"><div class="line-content"><span class="mtk1"></span><span class="mtk11 mtki">CHECK</span><span class="mtk1"> (doc_type </span><span class="mtk15">IN</span><span class="mtk1"> (</span><span class="mtk15">'</span><span class="mtk7">spreadsheet</span><span class="mtk15">'</span><span class="mtk1">, </span><span class="mtk15">'</span><span class="mtk7">document</span><span class="mtk15">'</span><span class="mtk1">, </span><span class="mtk15">'</span><span class="mtk7">presentation</span><span class="mtk15">'</span><span class="mtk1">, </span><span class="mtk15">'</span><span class="mtk7">folder</span><span class="mtk15">'</span><span class="mtk1">, </span><span class="mtk15">'</span><span class="mtk7">other</span><span class="mtk15">'</span><span class="mtk1">)),</span></div></div><div class="code-line" data-line-number="11" data-line-start="11" data-line-end="11"><div class="line-content"><span class="mtk1">  mime_type     </span><span class="mtk10">text</span><span class="mtk1">,                     </span><span class="mtk3 mtki">-- application/vnd.google-apps.spreadsheet, etc.</span></div></div><div class="code-line" data-line-number="12" data-line-start="12" data-line-end="12"><div class="line-content"><span class="mtk1">  thumbnail_url </span><span class="mtk10">text</span><span class="mtk1">,                     </span><span class="mtk3 mtki">-- URL de miniatura de Google</span></div></div><div class="code-line" data-line-number="13" data-line-start="13" data-line-end="13"><div class="line-content"><span class="mtk1">  created_by    uuid </span><span class="mtk15">NOT NULL</span><span class="mtk1"></span><span class="mtk11 mtki">REFERENCES</span><span class="mtk1"></span><span class="mtk18">public</span><span class="mtk1">.</span><span class="mtk18">account_users</span><span class="mtk1">(user_id),</span></div></div><div class="code-line" data-line-number="14" data-line-start="14" data-line-end="14"><div class="line-content"><span class="mtk1">  metadata      jsonb </span><span class="mtk11 mtki">DEFAULT</span><span class="mtk1"></span><span class="mtk15">'</span><span class="mtk7">{}</span><span class="mtk15">'</span><span class="mtk1">::jsonb,</span></div></div><div class="code-line" data-line-number="15" data-line-start="15" data-line-end="15"><div class="line-content"><span class="mtk1">  created_at    </span><span class="mtk10">timestamptz</span><span class="mtk1"></span><span class="mtk11 mtki">DEFAULT</span><span class="mtk1"></span><span class="mtk15">now</span><span class="mtk24">()</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="16" data-line-start="16" data-line-end="16"><div class="line-content"><span class="mtk1">  updated_at    </span><span class="mtk10">timestamptz</span><span class="mtk1"></span><span class="mtk11 mtki">DEFAULT</span><span class="mtk1"></span><span class="mtk15">now</span><span class="mtk24">()</span></div></div><div class="code-line" data-line-number="17" data-line-start="17" data-line-end="17"><div class="line-content"><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="18" data-line-start="18" data-line-end="18"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="19" data-line-start="19" data-line-end="19"><div class="line-content"><span class="mtk15">CREATE</span><span class="mtk1"></span><span class="mtk15">INDEX</span><span class="mtk1"></span><span class="mtk22">idx_pm_docs_project</span><span class="mtk1"></span><span class="mtk15">ON</span><span class="mtk1"></span><span class="mtk18">public</span><span class="mtk1">.</span><span class="mtk18">pm_project_documents</span><span class="mtk1">(project_id);</span></div></div><div class="code-line" data-line-number="20" data-line-start="20" data-line-end="20"><div class="line-content"><span class="mtk15">CREATE</span><span class="mtk1"></span><span class="mtk15">INDEX</span><span class="mtk1"></span><span class="mtk22">idx_pm_docs_provider</span><span class="mtk1"></span><span class="mtk15">ON</span><span class="mtk1"></span><span class="mtk18">public</span><span class="mtk1">.</span><span class="mtk18">pm_project_documents</span><span class="mtk1">(</span><span class="mtk15">provider</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="21" data-line-start="21" data-line-end="21"><div class="line-content"><span class="mtk15">ALTER</span><span class="mtk1"></span><span class="mtk15">TABLE</span><span class="mtk1"></span><span class="mtk18">public</span><span class="mtk1">.</span><span class="mtk18">pm_project_documents</span><span class="mtk1"></span><span class="mtk15">ENABLE</span><span class="mtk1"></span><span class="mtk15">ROW</span><span class="mtk1"></span><span class="mtk15">LEVEL</span><span class="mtk1"></span><span class="mtk15">SECURITY</span><span class="mtk1">;</span></div></div></div></div></div></div></pre>

---

### Capa API (Backend)

#### [NEW]

route.ts

Endpoints REST para operaciones CRUD de documentos de proyecto:

| Método   | Ruta                                                  | Descripción                  |
| -------- | ----------------------------------------------------- | ---------------------------- |
| `GET`    | `/api/workspaces/:slug/projects/:id/documents`        | Listar documentos vinculados |
| `POST`   | `/api/workspaces/:slug/projects/:id/documents`        | Vincular nuevo documento     |
| `DELETE` | `/api/workspaces/:slug/projects/:id/documents/:docId` | Desvincular documento        |

Cada llamada POST/DELETE registrará un evento de auditoría en el Ledger (`PROJECT_DOCUMENT_LINK` / `PROJECT_DOCUMENT_UNLINK`).

---

### Capa UI (Frontend)

#### [NEW]

ProjectDocumentsTab.tsx

Componente que renderiza la pestaña **"Documentos"** dentro del detalle de un proyecto:

- Lista de documentos vinculados con nombre, tipo, miniatura y fecha.
- Botón **"Adjuntar desde Drive"** que abre el Google Drive Picker.
- Botón **"Crear Hoja de Cálculo"** que crea un Google Sheet desde una plantilla y lo vincula.
- Opción de **previsualización** con iframe embebido de Google Viewer.
- Opción de **desvincular** con confirmación.

#### [NEW]

GoogleDrivePicker.tsx

Componente que carga el SDK de Google Picker y permite seleccionar archivos:

- Carga dinámica del script `https://apis.google.com/js/api.js`.
- Autenticación vía el token OAuth del usuario (almacenado en `calendar_integrations` u `oauth_accounts`).
- Filtros por tipo: Sheets, Docs, PDF, Carpetas.
- Callback `onSelect(file)` que devuelve `{ id, name, url, mimeType }`.

#### [MODIFY] Detalle de proyecto (vista existente)

Se añade la pestaña "Documentos" junto a las pestañas existentes (Tareas, Miembros, etc.) en la vista de detalle del proyecto dentro del admin panel.

---

## Verification Plan

### Manual Verification

NOTE

No existen tests automatizados en este proyecto. La verificación será manual.

1. **Ejecutar la migración** `015_project_documents.sql` en Supabase y verificar que la tabla `pm_project_documents` exista con todas las columnas.
2. **Probar API POST** enviando un body JSON con `{ name, provider, external_id, external_url, doc_type }` y verificar que retorna 201 con el documento creado.
3. **Probar API GET** para listar los documentos de un proyecto y verificar que el documento recién creado aparece en la lista.
4. **Probar API DELETE** para desvincular un documento y verificar que ya no aparece en el GET.
5. **Probar en la UI** que al hacer clic en "Adjuntar desde Drive" se abre el Google Picker, se selecciona un archivo y queda vinculado al proyecto visualmente.
6. **Probar previsualización** de un archivo Google Sheet embebido vía iframe dentro de la pestaña de Documentos.
