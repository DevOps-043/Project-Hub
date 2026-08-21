'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle2, Download, FileBarChart2, FileSpreadsheet, FolderKanban, RefreshCw, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react';
import { Document, Page, PDFDownloadLink, StyleSheet, Text, View } from '@react-pdf/renderer';
import { useOptionalWorkspace } from '@/contexts/WorkspaceContext';
import { api } from '@/lib/api/client';
import { EmptyState, LoadingState, MetricStrip, PageHero, ProductPage, ProductSurface, productControlClass, productPrimaryControlClass, type ProductMetric } from '@/components/product';
import styles from './ReportsDashboard.module.css';

type ReportData = {
  projects?: { total?: number; active?: number; planning?: number; completed?: number; onHold?: number; atRisk?: number };
  tasks?: { total?: number; completionRate?: number; overdue?: number; open?: number; completed?: number; completedThisWeek?: number; completedThisMonth?: number; avgCompletionDays?: number };
  teams?: { total?: number; totalMembers?: number }; users?: { active?: number }; cycles?: { active?: number };
  riskAnalysis?: { level?: string; factors?: string[]; recommendations?: string[] };
  topContributors?: Array<{ name: string; completed: number }>;
};
type PredictiveAnalysis = { risk_level?: string; risk_summary?: string; predictions?: string[]; actions?: string[] };

const pdf = StyleSheet.create({ page: { padding: 34, color: '#0A2540', fontFamily: 'Helvetica' }, header: { paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: '#00D4B3' }, title: { fontSize: 25, fontWeight: 700 }, subtitle: { marginTop: 6, color: '#64748B', fontSize: 9 }, section: { marginTop: 20 }, sectionTitle: { marginBottom: 9, color: '#008F7F', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { width: '48%', padding: 12, backgroundColor: '#F4F7F9', borderRadius: 7 }, metricValue: { fontSize: 21, fontWeight: 700 }, metricLabel: { marginTop: 3, color: '#64748B', fontSize: 8 }, row: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' }, label: { flex: 1, color: '#64748B', fontSize: 9 }, value: { fontSize: 9, fontWeight: 700 }, bullet: { marginBottom: 6, color: '#334155', fontSize: 9, lineHeight: 1.45 }, footer: { position: 'absolute', bottom: 24, left: 34, right: 34, paddingTop: 8, color: '#94A3B8', borderTopWidth: 1, borderTopColor: '#E9ECEF', fontSize: 7, textAlign: 'center' } });

function ExecutiveDocument({ data, label }: { data: ReportData; label: string }) {
  return <Document><Page size="A4" style={pdf.page}><View style={pdf.header}><Text style={pdf.title}>Resumen ejecutivo</Text><Text style={pdf.subtitle}>{label} · {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</Text></View><View style={pdf.section}><Text style={pdf.sectionTitle}>Indicadores principales</Text><View style={pdf.metrics}><PdfMetric label="Proyectos" value={data.projects?.total || 0} /><PdfMetric label="Tareas" value={data.tasks?.total || 0} /><PdfMetric label="Finalización" value={`${data.tasks?.completionRate || 0}%`} /><PdfMetric label="Vencidas" value={data.tasks?.overdue || 0} /></View></View><View style={pdf.section}><Text style={pdf.sectionTitle}>Operación</Text><PdfRow label="Proyectos activos" value={data.projects?.active || 0} /><PdfRow label="Proyectos en riesgo" value={data.projects?.atRisk || 0} /><PdfRow label="Tareas abiertas" value={data.tasks?.open || 0} /><PdfRow label="Completadas esta semana" value={data.tasks?.completedThisWeek || 0} /><PdfRow label="Tiempo promedio de cierre" value={`${data.tasks?.avgCompletionDays || 0} días`} /></View><View style={pdf.section}><Text style={pdf.sectionTitle}>Riesgos y recomendaciones</Text>{(data.riskAnalysis?.factors || []).map((item) => <Text key={item} style={pdf.bullet}>• {item}</Text>)}{(data.riskAnalysis?.recommendations || []).map((item) => <Text key={item} style={pdf.bullet}>→ {item}</Text>)}</View><Text style={pdf.footer}>Documento confidencial · Project Hub by SofLIA</Text></Page></Document>;
}
function PredictiveDocument({ analysis, label }: { analysis: PredictiveAnalysis; label: string }) { return <Document><Page size="A4" style={pdf.page}><View style={pdf.header}><Text style={pdf.title}>Análisis predictivo</Text><Text style={pdf.subtitle}>{label} · Generado con SofLIA</Text></View><View style={pdf.section}><Text style={pdf.sectionTitle}>Nivel de riesgo</Text><Text style={pdf.metricValue}>{analysis.risk_level || 'Sin clasificación'}</Text><Text style={[pdf.bullet, { marginTop: 10 }]}>{analysis.risk_summary || 'Sin resumen disponible.'}</Text></View><View style={pdf.section}><Text style={pdf.sectionTitle}>Predicciones</Text>{(analysis.predictions || []).map((item) => <Text key={item} style={pdf.bullet}>• {item}</Text>)}</View><View style={pdf.section}><Text style={pdf.sectionTitle}>Acciones sugeridas</Text>{(analysis.actions || []).map((item) => <Text key={item} style={pdf.bullet}>→ {item}</Text>)}</View><Text style={pdf.footer}>Documento confidencial · Project Hub by SofLIA</Text></Page></Document>; }
function PdfMetric({ label, value }: { label: string; value: string | number }) { return <View style={pdf.metric}><Text style={pdf.metricValue}>{value}</Text><Text style={pdf.metricLabel}>{label}</Text></View>; }
function PdfRow({ label, value }: { label: string; value: string | number }) { return <View style={pdf.row}><Text style={pdf.label}>{label}</Text><Text style={pdf.value}>{value}</Text></View>; }

function downloadCsv(rows: Record<string, unknown>[], fileName: string) {
  if (!rows.length) return;
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [columns.map(escape).join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}

export function ReportsDashboard({ scope }: { scope: 'global' | 'workspace' }) {
  const workspaceContext = useOptionalWorkspace(); const workspace = workspaceContext?.workspace;
  const [mounted, setMounted] = useState(false); const [data, setData] = useState<ReportData | null>(null); const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true); const [tasksLoading, setTasksLoading] = useState(true); const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<PredictiveAnalysis | null>(null); const [aiLoading, setAiLoading] = useState(false);
  const label = scope === 'global' ? 'Project Hub global' : workspace?.name || 'Organización';
  const load = useCallback(async () => {
    const reportEndpoint = scope === 'global' ? '/api/admin/reports/executive-summary' : workspace ? `/api/workspaces/${workspace.slug}/reports/executive-summary` : '';
    const tasksEndpoint = scope === 'global' ? '/api/admin/tasks/export?limit=5000' : workspace ? `/api/workspaces/${workspace.slug}/tasks/export?limit=2000` : '';
    if (!reportEndpoint || !tasksEndpoint) return;
    setLoading(true); setTasksLoading(true); setError('');
    const [report, taskExport] = await Promise.all([api.get<ReportData>(reportEndpoint), api.get<{ tasks?: Record<string, unknown>[] }>(tasksEndpoint)]);
    if (report.error || !report.data) setError(report.error || 'No fue posible generar el resumen.'); else setData(report.data);
    setTasks(taskExport.data?.tasks || []); setLoading(false); setTasksLoading(false);
  }, [scope, workspace]);
  useEffect(() => { setMounted(true); load(); }, [load]);
  const generateAnalysis = async () => { setAiLoading(true); const response = await api.post<PredictiveAnalysis>('/api/ai/predictive-report'); if (response.error || !response.data) setError(response.error || 'SofLIA no pudo completar el análisis.'); else setAnalysis(response.data); setAiLoading(false); };
  if (loading) return <LoadingState label="Preparando el centro de reportes…" />;
  if (error && !data) return <EmptyState icon={TriangleAlert} title="No pudimos preparar los reportes" description={error} action={<button className={productControlClass} onClick={load}><RefreshCw size={15} aria-hidden /> Reintentar</button>} />;
  if (!data) return null;
  const metrics: ProductMetric[] = [ { label: 'Proyectos', value: data.projects?.total || 0, icon: FolderKanban }, { label: 'Tareas', value: data.tasks?.total || 0, icon: CheckCircle2, tone: 'info' }, { label: 'Finalización', value: `${data.tasks?.completionRate || 0}%`, icon: FileBarChart2, tone: 'success' }, { label: 'Vencidas', value: data.tasks?.overdue || 0, icon: ShieldAlert, tone: (data.tasks?.overdue || 0) > 0 ? 'error' : 'success' } ];
  return <ProductPage><PageHero eyebrow="Inteligencia ejecutiva" title="Centro de reportes" description={`Genera entregables claros y exportaciones verificables con datos reales de ${label}.`} icon={FileBarChart2} actions={<button className={productControlClass} onClick={load}><RefreshCw size={15} aria-hidden /> Actualizar</button>} /><MetricStrip metrics={metrics} />
    <section className={styles.cards}>
      <ReportCard icon={FileBarChart2} eyebrow="PDF" title="Resumen ejecutivo" description="Indicadores, riesgo operativo y recomendaciones en un documento listo para compartir.">{mounted ? <PDFDownloadLink document={<ExecutiveDocument data={data} label={label} />} fileName={`ProjectHub_Resumen_${new Date().toISOString().slice(0, 10)}.pdf`} className={productPrimaryControlClass}>{({ loading: building }) => <><Download size={15} aria-hidden />{building ? 'Generando…' : 'Descargar PDF'}</>}</PDFDownloadLink> : null}</ReportCard>
      <ReportCard icon={FileSpreadsheet} eyebrow="Datos" title="Exportación de tareas" description={`${tasks.length} registros disponibles para análisis en Excel, Sheets o BI.`}><button className={productControlClass} disabled={tasksLoading || !tasks.length} onClick={() => downloadCsv(tasks, `ProjectHub_Tareas_${new Date().toISOString().slice(0, 10)}.csv`)}><Download size={15} aria-hidden />{tasksLoading ? 'Preparando…' : tasks.length ? 'Descargar CSV' : 'Sin registros'}</button></ReportCard>
      <ReportCard icon={Bot} eyebrow="SofLIA" title="Análisis predictivo" description="Detecta patrones, anticipa bloqueos y propone acciones concretas para el siguiente ciclo.">{analysis && mounted ? <PDFDownloadLink document={<PredictiveDocument analysis={analysis} label={label} />} fileName={`ProjectHub_Predictivo_${new Date().toISOString().slice(0, 10)}.pdf`} className={productPrimaryControlClass}>{({ loading: building }) => <><Download size={15} aria-hidden />{building ? 'Generando…' : 'Descargar análisis'}</>}</PDFDownloadLink> : <button className={productPrimaryControlClass} disabled={aiLoading} onClick={generateAnalysis}><Sparkles size={15} aria-hidden />{aiLoading ? 'Analizando…' : 'Analizar con SofLIA'}</button>}</ReportCard>
    </section>
    {analysis ? <ProductSurface padded className={styles.analysis}><header><span><Sparkles size={16} aria-hidden /></span><div><small>Lectura predictiva</small><h2>{analysis.risk_level || 'Análisis completado'}</h2><p>{analysis.risk_summary}</p></div></header><div><div><h3>Predicciones</h3><ul>{(analysis.predictions || []).map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Acciones sugeridas</h3><ul>{(analysis.actions || []).map((item) => <li key={item}>{item}</li>)}</ul></div></div></ProductSurface> : null}
  </ProductPage>;
}

function ReportCard({ icon: Icon, eyebrow, title, description, children }: { icon: typeof FileBarChart2; eyebrow: string; title: string; description: string; children: React.ReactNode }) { return <ProductSurface padded className={styles.card}><span className={styles.cardIcon}><Icon size={21} strokeWidth={1.7} aria-hidden /></span><small>{eyebrow}</small><h2>{title}</h2><p>{description}</p><div>{children}</div></ProductSurface>; }
