'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';
import { api } from '@/lib/api/client';

// --- STYLES FOR PDF ---
const styles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 30, fontFamily: 'Helvetica' },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#00D4B3', paddingBottom: 15 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#0A2540' },
  subtitle: { fontSize: 11, color: '#666', marginTop: 6 },
  section: { marginTop: 15, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 10, color: '#00D4B3', textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 6 },
  label: { width: '50%', fontSize: 10, color: '#555' },
  value: { width: '50%', fontSize: 10, fontWeight: 'bold', color: '#111' },
  valueHighlight: { width: '50%', fontSize: 10, fontWeight: 'bold', color: '#00D4B3' },
  valueDanger: { width: '50%', fontSize: 10, fontWeight: 'bold', color: '#EF4444' },
  footer: { position: 'absolute', bottom: 25, left: 30, right: 30, textAlign: 'center', fontSize: 8, color: '#AAA', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  metricBox: { width: '48%', marginRight: '2%', marginBottom: 10, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 6 },
  metricValue: { fontSize: 22, fontWeight: 'bold', color: '#0A2540' },
  metricLabel: { fontSize: 9, color: '#666', marginTop: 3 },
  riskBadge: { padding: '4 10', borderRadius: 12, fontSize: 10, fontWeight: 'bold' },
  listItem: { flexDirection: 'row', marginBottom: 4, paddingLeft: 10 },
  bullet: { width: 15, fontSize: 10, color: '#00D4B3' },
  listText: { flex: 1, fontSize: 10, color: '#444', lineHeight: 1.4 },
  contributorRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  contributorName: { flex: 1, fontSize: 10, color: '#333' },
  contributorValue: { width: 60, fontSize: 10, fontWeight: 'bold', color: '#00D4B3', textAlign: 'right' }
});

interface WorkspaceReportData {
  projects?: {
    total?: number;
    active?: number;
    planning?: number;
    completed?: number;
    onHold?: number;
    atRisk?: number;
  };
  tasks?: {
    total?: number;
    completionRate?: number;
    overdue?: number;
    open?: number;
    completed?: number;
    completedThisWeek?: number;
    completedThisMonth?: number;
    avgCompletionDays?: number;
  };
  riskAnalysis?: {
    level?: string;
    factors?: string[];
    recommendations?: string[];
  };
  topContributors?: Array<{ name: string; completed: number }>;
}

interface PredictiveAnalysis {
  risk_level?: string;
  risk_summary?: string;
  predictions?: string[];
  actions?: string[];
}

// --- PDF TEMPLATE ---
const ExecutiveReport = ({ data }: { data: WorkspaceReportData | null }) => {
  const riskLevel = data?.riskAnalysis?.level || 'Bajo';
  const riskColor = riskLevel === 'Alto' ? '#EF4444' : riskLevel === 'Medio' ? '#F59E0B' : '#22C55E';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Project Hub Executive Summary</Text>
          <Text style={styles.subtitle}>Reporte generado el {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metricas Clave</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricBox}><Text style={styles.metricValue}>{data?.projects?.total || 0}</Text><Text style={styles.metricLabel}>Proyectos Totales</Text></View>
            <View style={styles.metricBox}><Text style={styles.metricValue}>{data?.tasks?.total || 0}</Text><Text style={styles.metricLabel}>Tareas Totales</Text></View>
            <View style={styles.metricBox}><Text style={[styles.metricValue, { color: '#00D4B3' }]}>{data?.tasks?.completionRate || 0}%</Text><Text style={styles.metricLabel}>Tasa de Finalizacion</Text></View>
            <View style={styles.metricBox}><Text style={[styles.metricValue, { color: (data?.tasks?.overdue ?? 0) > 5 ? '#EF4444' : '#0A2540' }]}>{data?.tasks?.overdue || 0}</Text><Text style={styles.metricLabel}>Tareas Vencidas</Text></View>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de Proyectos</Text>
          <View style={styles.row}><Text style={styles.label}>Proyectos Activos</Text><Text style={styles.valueHighlight}>{data?.projects?.active || 0}</Text></View>
          <View style={styles.row}><Text style={styles.label}>En Planificacion</Text><Text style={styles.value}>{data?.projects?.planning || 0}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Completados</Text><Text style={styles.value}>{data?.projects?.completed || 0}</Text></View>
          <View style={styles.row}><Text style={styles.label}>En Pausa</Text><Text style={styles.value}>{data?.projects?.onHold || 0}</Text></View>
          <View style={styles.row}><Text style={styles.label}>En Riesgo</Text><Text style={(data?.projects?.atRisk ?? 0) > 0 ? styles.valueDanger : styles.value}>{data?.projects?.atRisk || 0}</Text></View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rendimiento de Tareas</Text>
          <View style={styles.row}><Text style={styles.label}>Tareas Abiertas</Text><Text style={styles.value}>{data?.tasks?.open || 0}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Tareas Completadas</Text><Text style={styles.valueHighlight}>{data?.tasks?.completed || 0}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Completadas esta semana</Text><Text style={styles.valueHighlight}>{data?.tasks?.completedThisWeek || 0}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Completadas este mes</Text><Text style={styles.valueHighlight}>{data?.tasks?.completedThisMonth || 0}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Tiempo promedio de cierre</Text><Text style={styles.value}>{data?.tasks?.avgCompletionDays || 0} dias</Text></View>
        </View>
        <Text style={styles.footer}>Documento confidencial - Project Hub Management System</Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}><Text style={[styles.title, { fontSize: 20 }]}>Analisis y Recomendaciones</Text></View>
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Evaluacion de Riesgo: </Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor + '20' }]}><Text style={{ color: riskColor, fontWeight: 'bold', fontSize: 10 }}>{riskLevel}</Text></View>
          </View>
          {(data?.riskAnalysis?.factors?.length ?? 0) > 0 ? (
            data!.riskAnalysis!.factors!.map((factor, i) => (
              <View key={i} style={styles.listItem}><Text style={styles.bullet}>-</Text><Text style={styles.listText}>{factor}</Text></View>
            ))
          ) : (
            <Text style={{ fontSize: 10, color: '#22C55E' }}>No se identificaron riesgos significativos.</Text>
          )}
        </View>
        {(data?.riskAnalysis?.recommendations?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recomendaciones</Text>
            {data!.riskAnalysis!.recommendations!.map((rec, i) => (
              <View key={i} style={styles.listItem}><Text style={[styles.bullet, { color: '#0A2540', fontWeight: 'bold' }]}>{i + 1}.</Text><Text style={styles.listText}>{rec}</Text></View>
            ))}
          </View>
        )}
        {(data?.topContributors?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Contribuidores del Mes</Text>
            {data!.topContributors!.map((contributor, i) => (
              <View key={i} style={styles.contributorRow}><Text style={styles.contributorName}>{i + 1}. {contributor.name}</Text><Text style={styles.contributorValue}>{contributor.completed} tareas</Text></View>
            ))}
          </View>
        )}
        <Text style={styles.footer}>Documento confidencial - Project Hub Management System</Text>
      </Page>
    </Document>
  );
};

// --- AI Predictive Report PDF ---
const PredictiveReport = ({ analysis }: { analysis: PredictiveAnalysis | null }) => (
  <Document>
    <Page size="A4" style={styles.page}>
        <View style={styles.header}>
            <Text style={styles.title}>Project Hub Predictive Intelligence</Text>
            <Text style={{ fontSize: 10, color: '#00D4B3', fontWeight: 'bold' }}>POWERED BY AI</Text>
            <Text style={styles.subtitle}>Generado el {new Date().toLocaleDateString()}</Text>
        </View>
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Evaluacion de Riesgo: {analysis?.risk_level || 'N/A'}</Text>
            <Text style={{ fontSize: 11, color: '#444', lineHeight: 1.6 }}>{analysis?.risk_summary || 'No risk summary available.'}</Text>
        </View>
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Proyecciones Futuras</Text>
            {analysis?.predictions?.map((p: string, i: number) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}><Text style={{ width: 15, color: '#666' }}>-</Text><Text style={{ flex: 1, fontSize: 10, color: '#333' }}>{p}</Text></View>
            ))}
        </View>
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recomendaciones Tacticas</Text>
            {analysis?.actions?.map((a: string, i: number) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}><Text style={{ width: 15, color: '#00D4B3', fontWeight: 'bold' }}>{i + 1}.</Text><Text style={{ flex: 1, fontSize: 10, color: '#333' }}>{a}</Text></View>
            ))}
        </View>
        <View style={{ position: 'absolute', bottom: 30, left: 30, right: 30, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 }}>
            <Text style={{ fontSize: 8, color: '#999', textAlign: 'center' }}>Este reporte fue generado por inteligencia artificial. Las proyecciones son estimaciones basadas en datos historicos.</Text>
        </View>
    </Page>
  </Document>
);

// --- CSV GENERATOR ---
const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
    if (!data || data.length === 0) { alert('No hay datos para exportar'); return; }
    const escapeValue = (value: unknown) => {
        const text = value === null || value === undefined ? '' : String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const headers = Object.keys(data[0] || {});
    const rows = data.map(obj => headers.map(header => escapeValue(obj[header])).join(',')).join('\r\n');
    const blob = new Blob([`﻿${headers.join(',')}\r\n${rows}`], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

/**
 * Vista de Centro de Reportes del workspace. Compartida entre /[orgSlug]/reports
 * y /[orgSlug]/admin/reports, que eran implementaciones duplicadas idénticas.
 */
export default function WorkspaceReportsView() {
    const { isDark } = useTheme();
    const colors = isDark ? themeColors.dark : themeColors.light;
    const { workspace } = useWorkspace();
    const [isMounted, setIsMounted] = useState(false);

    const [reportData, setReportData] = useState<WorkspaceReportData | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<PredictiveAnalysis | null>(null);
    const [tasksData, setTasksData] = useState<Record<string, unknown>[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [tasksExportError, setTasksExportError] = useState<string | null>(null);

    const fetchReportData = useCallback(async () => {
        setLoadingData(true);
        try {
            const { data, error } = await api.get<WorkspaceReportData>(`/api/workspaces/${workspace.slug}/reports/executive-summary`);
            if (!error && data) setReportData(data);
        } catch (error) {
            console.error('Error fetching report data:', error);
        } finally { setLoadingData(false); }
    }, [workspace.slug]);

    const fetchTasksForExport = useCallback(async () => {
        setTasksLoading(true);
        setTasksExportError(null);
        try {
            const { data, error } = await api.get<{ tasks?: Record<string, unknown>[] }>(`/api/workspaces/${workspace.slug}/tasks/export?limit=2000`);
            if (error) {
                throw new Error(error || 'No se pudieron cargar las tareas');
            }
            setTasksData(data?.tasks || []);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setTasksData([]);
            setTasksExportError(error instanceof Error ? error.message : 'No se pudieron cargar las tareas');
        } finally {
            setTasksLoading(false);
        }
    }, [workspace.slug]);

    useEffect(() => {
        setIsMounted(true);
        fetchReportData();
        fetchTasksForExport();
    }, [workspace.slug, fetchReportData, fetchTasksForExport]);

    const generatePredictiveReport = async () => {
        setAiLoading(true);
        try {
            const { data, error } = await api.post<PredictiveAnalysis>('/api/ai/predictive-report');
            if (!error && data) setAiAnalysis(data);
            else alert('No se pudo conectar con el servicio de IA.');
        } catch (e) { console.error(e); }
        finally { setAiLoading(false); }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen animate-fadeIn space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" style={{ color: colors.textPrimary }}>Centro de Reportes</h1>
                <p style={{ color: colors.textMuted }}>Genera, previsualiza y descarga informes detallados con datos reales.</p>
            </div>

            {!loadingData && reportData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,212,179,0.1)' : 'rgba(0,212,179,0.05)', border: `1px solid ${isDark ? 'rgba(0,212,179,0.2)' : 'rgba(0,212,179,0.15)'}` }}>
                        <p className="text-2xl font-bold" style={{ color: '#00D4B3' }}>{reportData.projects?.total}</p>
                        <p className="text-sm" style={{ color: colors.textMuted }}>Proyectos</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)', border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}` }}>
                        <p className="text-2xl font-bold" style={{ color: '#3B82F6' }}>{reportData.tasks?.total}</p>
                        <p className="text-sm" style={{ color: colors.textMuted }}>Tareas</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)', border: `1px solid ${isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.15)'}` }}>
                        <p className="text-2xl font-bold" style={{ color: '#22C55E' }}>{reportData.tasks?.completionRate}%</p>
                        <p className="text-sm" style={{ color: colors.textMuted }}>Completado</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ backgroundColor: (reportData.tasks?.overdue ?? 0) > 5 ? (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)') : (isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'), border: `1px solid ${(reportData.tasks?.overdue ?? 0) > 5 ? 'rgba(239,68,68,0.2)' : colors.border}` }}>
                        <p className="text-2xl font-bold" style={{ color: (reportData.tasks?.overdue ?? 0) > 5 ? '#EF4444' : colors.textPrimary }}>{reportData.tasks?.overdue}</p>
                        <p className="text-sm" style={{ color: colors.textMuted }}>Vencidas</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Executive Summary */}
                <div className="p-6 rounded-2xl border shadow-sm hover:border-blue-500 transition-colors group" style={{ backgroundColor: isDark ? '#161b22' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#e5e7eb' }}>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </div>
                    <h3 className="font-bold text-lg mb-2" style={{ color: colors.textPrimary }}>Resumen Ejecutivo</h3>
                    <p className="text-sm mb-6" style={{ color: colors.textMuted }}>Informe PDF completo con metricas reales, analisis de riesgos y recomendaciones.</p>
                    {loadingData ? (
                        <div className="w-full py-3 rounded-xl bg-gray-200 dark:bg-zinc-800 text-center text-sm" style={{ color: colors.textMuted }}>Cargando datos...</div>
                    ) : isMounted && reportData ? (
                        <PDFDownloadLink
                            document={<ExecutiveReport data={reportData} />}
                            fileName={`ProjectHub_Executive_Summary_${new Date().toISOString().split('T')[0]}.pdf`}
                            className="flex items-center justify-center w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all"
                        >
                            {({ loading }) => (loading ? 'Generando PDF...' : 'Descargar PDF')}
                        </PDFDownloadLink>
                    ) : (
                        <div className="w-full py-3 rounded-xl bg-gray-200 dark:bg-zinc-800 text-center text-sm" style={{ color: colors.textMuted }}>Preparando...</div>
                    )}
                </div>

                {/* Task Export */}
                <div className="p-6 rounded-2xl border shadow-sm hover:border-green-500 transition-colors group" style={{ backgroundColor: isDark ? '#161b22' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#e5e7eb' }}>
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>
                    </div>
                    <h3 className="font-bold text-lg mb-2" style={{ color: colors.textPrimary }}>Exportar Tareas</h3>
                    <p className="text-sm mb-6" style={{ color: colors.textMuted }}>Listado de tareas en CSV ({tasksData.length} registros disponibles).</p>
                    <button
                        onClick={() => downloadCSV(tasksData, `projecthub_tasks_export_${new Date().toISOString().split('T')[0]}.csv`)}
                        disabled={tasksLoading || tasksData.length === 0}
                        className="flex items-center justify-center w-full py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', color: colors.textPrimary }}
                    >
                        {tasksLoading ? 'Cargando tareas...' : tasksData.length > 0 ? 'Descargar CSV' : 'Sin tareas para exportar'}
                    </button>
                    {tasksExportError && <p className="text-xs text-red-500 mt-2">{tasksExportError}</p>}
                </div>

                {/* AI Predictive */}
                <div className="p-6 rounded-2xl border shadow-sm hover:border-[#00D4B3] transition-colors group" style={{ backgroundColor: isDark ? '#161b22' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#e5e7eb' }}>
                    <div className="w-12 h-12 rounded-xl bg-[#00D4B3]/10 text-[#00D4B3] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </div>
                    <h3 className="font-bold text-lg mb-2" style={{ color: colors.textPrimary }}>Analisis Predictivo IA</h3>
                    <p className="text-sm mb-6" style={{ color: colors.textMuted }}>La IA analiza patrones, detecta bloqueos futuros y sugiere mejoras estrategicas.</p>
                    {!aiAnalysis ? (
                        <button
                            onClick={generatePredictiveReport}
                            disabled={aiLoading}
                            className="flex items-center justify-center w-full py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
                            style={{ background: isDark ? 'linear-gradient(135deg, #fff, #e5e7eb)' : 'linear-gradient(135deg, #111, #333)', color: isDark ? '#111' : '#fff' }}
                        >
                            {aiLoading ? 'Analizando...' : 'Generar Analisis'}
                        </button>
                    ) : (
                        isMounted ? (
                        <PDFDownloadLink
                            document={<PredictiveReport analysis={aiAnalysis} />}
                            fileName={`ProjectHub_AI_Analysis_${new Date().toISOString().split('T')[0]}.pdf`}
                            className="flex items-center justify-center w-full py-3 rounded-xl bg-[#00D4B3] hover:bg-[#00bda0] text-black font-bold transition-all"
                        >
                            {({ loading }) => (loading ? 'Creando PDF...' : 'Descargar Reporte IA')}
                        </PDFDownloadLink>
                        ) : null
                    )}
                </div>
            </div>

            <div className="p-6 rounded-2xl" style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)', border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'}` }}>
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-500 rounded-lg text-white mt-1">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                    </div>
                    <div>
                        <h4 className="font-bold" style={{ color: isDark ? '#93C5FD' : '#1E40AF' }}>Datos en Tiempo Real</h4>
                        <p className="text-sm mt-1" style={{ color: isDark ? '#60A5FA' : '#3B82F6' }}>
                            Los reportes muestran datos reales de tu workspace. El Resumen Ejecutivo incluye metricas de proyectos, tareas, equipos, analisis de riesgos y recomendaciones.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
