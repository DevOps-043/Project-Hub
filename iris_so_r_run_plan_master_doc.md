# IRIS como System of Record (SoR)
## Master Document para Generación de Run Plan (Claude)

---

# 1. Contexto Estratégico

IRIS ha sido definido como el **System of Record (SoR) único para la operación** dentro de Pulse Hub / SofLIA.

Esto implica que:
- Todo estado operativo vive en IRIS.
- Todas las decisiones relevantes se registran en IRIS.
- Todas las tareas, responsables y cambios de estado pasan por IRIS.
- Toda aprobación crítica se ejecuta en IRIS.
- Toda evidencia externa se referencia desde IRIS.

Otros sistemas (WhatsApp, Meet, Google Docs, Drive, Web Agent) funcionan como:
- Superficie de interacción
- Captura de intención
- Generación de contenido

Pero **no son fuente oficial de verdad operativa**.

---

# 2. Stack Actual Consolidado

## IRIS
- Project Hub (teams, projects, issues, cycles, milestones)
- Estados, prioridades, labels
- Comentarios
- Soporte para acciones deterministas (create_issue, update_issue, add_comment)

## SofLIA Extension
- Web Agent (observe → act → verify)
- Deep Research
- Meeting Intelligence (Meet → transcripción → acciones)
- Ejecución de acciones IRIS vía bloques estructurados

## SofLIA Hub
- WhatsApp como canal operativo
- Creación / actualización de issues
- Cambio de estado / prioridad
- Allowlist y controles en grupos

## Google Workspace
- Docs (conocimiento)
- Drive (evidencia)
- Meet (captura operativa)

## Infraestructura
- Supabase multi-tenant
- RLS
- Modelo de autonomía L0–L3
- Policy Gate (en proceso)
- Ledger / audit_events (en proceso)
- Write Gateway (en proceso)
- SAFE actions (definición inicial)
- Eventing (Outbox/Webhooks)
- FinOps por workflow

---

# 3. Modelo Operativo de Autonomía

L0 — Read
- Solo lectura
- Construcción de contexto

L1 — Draft
- Genera borradores
- No ejecuta writes

L2 — Write con aprobación
- Plan → Preview → Approve → Execute
- Aplica a la mayoría de flujos críticos

L3 — Auto SAFE
- Solo acciones reversibles
- Presupuestadas
- Con límites
- Con auditoría completa

Regla base: ningún WRITE crítico sin Policy Gate + registro en Ledger.

---

# 4. Flujos Operativos Inmediatos por Área

## Dirección / PMO
- Meet → minuta → tareas en IRIS
- WhatsApp → captura de pendientes
- Registro de decisiones como issues
- Cierre semanal (actualización de estados)
- Seguimiento de OKRs como issues

## Ventas (AVI)
- Intake de lead por WhatsApp
- Discovery (Meet) → tareas
- Follow-up automático (tasks con due date)
- Generación de propuesta + tarea asociada
- Pipeline simple por etiquetas

## Marketing (DIM)
- Calendario editorial en IRIS
- Brief de campaña + tareas
- Research competitivo → tareas
- Checklist SOP de publicación
- Reunión creativa → backlog priorizado

## Delivery / Servicio
- Onboarding por milestones
- Incidencias por WhatsApp → issue
- Weekly status report
- QBR mensual → plan de acción
- Evidencia en Drive vinculada a issues

## Administración / Finanzas
- Cuentas por cobrar como issues
- Solicitudes de gasto con aprobación
- Cierre quincenal checklist
- Reporte de caja simple

## Talento / RRHH
- Pipeline de contratación
- Onboarding colaborador
- 1:1 → compromisos
- Offboarding checklist

Todos estos flujos se reducen a:
- Crear issue
- Actualizar issue
- Cambiar estado
- Asignar responsable
- Adjuntar evidencia

No requieren desarrollo complejo adicional.

---

# 5. Top 10 Quick Wins (Impacto Alto / Complejidad Baja)

1. Meet → minuta → action items → IRIS
2. WhatsApp → captura de pendientes
3. Soporte por WhatsApp → issue priorizado
4. Intake de lead por WhatsApp
5. Onboarding cliente por milestones
6. Calendario de contenido en IRIS
7. Registro formal de decisiones
8. Cierre semanal estructurado
9. Cuentas por cobrar como tasks
10. Onboarding colaborador con checklist

Estos permiten vender IRIS como:
"Sistema operativo de la empresa en 30 días"

---

# 6. Capacidades Mínimas Requeridas (Hardening Necesario)

Para que los Quick Wins sean seguros y vendibles:

## Gobernanza
- RBAC efectivo
- Tenant isolation
- Separation of duties (cuando aplique)

## Control de escritura
- Write Gateway centralizado
- Idempotency keys

## Autonomía
- Lista SAFE actions cerrada
- Política por canal (WA grupos restringido)

## Auditoría
- audit_events append-only
- workflow_runs (costo tokens, modelo, latencia)
- evidence_refs (links Drive/Meet)

## Aprobaciones
- Entidad approvals vinculada a writes críticos

---

# 7. Arquitectura Master–Satélite

IRIS = Master (SoR)
- Estado
- Decisiones
- Aprobaciones
- Auditoría

Satélites:
- WhatsApp → Captura
- Meet → Captura
- Docs/Drive → Conocimiento / Evidencia
- Web Agent → Ejecución controlada

Reglas:
1. Ningún satélite cambia estado sin pasar por Write Gateway.
2. Todo artefacto externo se registra como evidence_ref.
3. Dashboards se calculan desde IRIS.

---

# 8. Plan de Despliegue (30 Días)

## Semana 1
- Activar proyectos base (OPS, SALES, DELIVERY)
- Definir estados y prioridades mínimos
- Lanzar Meet → Tasks
- Plantillas operativas en Tool Library

## Semana 2
- Activar WhatsApp operativo
- Captura de pendientes
- Intake de leads
- Incidencias soporte

## Semana 3
- Estandarizar evidencia mínima
- Onboarding clientes formalizado
- Follow-ups estructurados en ventas

## Semana 4
- Medir KPIs:
  - % acciones registradas en IRIS
  - Tiempo de ciclo
  - Tiempo de respuesta
  - Seguimiento de leads
- Empaquetar oferta comercial 30 días

---

# 9. KPIs Iniciales

- % decisiones registradas en IRIS
- % tareas con evidencia vinculada
- Tiempo promedio de cierre
- Tiempo promedio de respuesta soporte
- % leads con siguiente acción registrada

---

# 10. Posicionamiento Comercial

IRIS como sistema operativo empresarial ofrece:

1. Operación móvil (WhatsApp)
2. Reuniones accionables (Meet)
3. Evidencia ordenada (Drive)
4. Trazabilidad audit-ready (Ledger)
5. Control multi-tenant enterprise

Propuesta vendible:
"Implementamos el sistema operativo de tu empresa en 30 días."

---

# 11. Siguiente Paso para Claude (Run Plan Generator)

Instrucciones para generar run plan:

1. Convertir cada Quick Win en épica dentro de IRIS.
2. Descomponer en stories técnicas (Backend / Middleware / IA / Seguridad).
3. Agregar criterios de aceptación auditables.
4. Asignar nivel de autonomía L1/L2/L3.
5. Definir dependencias entre Epics.
6. Generar cronograma de 4 semanas con responsables.
7. Identificar riesgos técnicos y mitigaciones.

---

Este documento consolida toda la investigación y análisis realizados para transformar IRIS en un SoR operativo real y vendible.

Puede utilizarse directamente como input para que Claude genere:
- Roadmap técnico
- Plan de implementación
- Backlog detallado
- Plan comercial
- Matriz de riesgos

Fin del documento.

