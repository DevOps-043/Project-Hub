'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { api } from '@/lib/api/client';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    Radar, RadarChart, PolarGrid, PolarAngleAxis,
} from 'recharts';

interface StatCardProps {
    title: string;
    value: React.ReactNode;
    sub?: string;
    icon: React.ReactNode;
    color?: string;
}

const StatCard = ({ title, value, sub, icon, color }: StatCardProps) => (
    <div className="p-6 rounded-2xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/5 shadow-sm">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
                <h3 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${color || 'bg-blue-500/10 text-blue-500'}`}>
                {icon}
            </div>
        </div>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
);

const ActivityHeatmap = ({ data }: { data: { date: string, count: number }[] }) => {
    const today = new Date();
    const days = [];
    for (let i = 364; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const dataMap = data.reduce((acc, curr) => {
        acc[curr.date] = curr.count;
        return acc;
    }, {} as Record<string, number>);

    const getColor = (count: number) => {
        if (!count) return 'bg-gray-100 dark:bg-white/5';
        if (count === 1) return 'bg-[#0e4429] dark:bg-[#0e4429] opacity-40';
        if (count <= 3) return 'bg-[#006d32] dark:bg-[#006d32] opacity-60';
        if (count <= 5) return 'bg-[#26a641] dark:bg-[#26a641] opacity-80';
        return 'bg-[#39d353] dark:bg-[#39d353]';
    };

    return (
        <div className="overflow-x-auto pb-2">
            <div className="flex gap-1 min-w-max">
                <div className="grid grid-rows-7 grid-flow-col gap-1">
                    {days.map(date => {
                        const count = dataMap[date] || 0;
                        return (
                            <div
                                key={date}
                                title={`${date}: ${count} tareas`}
                                className={`w-3 h-3 rounded-sm ${getColor(count)} hover:ring-1 ring-white/50 transition-all`}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="flex justify-end items-center gap-2 mt-2 text-[10px] text-gray-400">
                <span>Menos</span>
                <div className="w-3 h-3 bg-gray-100 dark:bg-white/5 rounded-sm" />
                <div className="w-3 h-3 bg-[#0e4429] opacity-40 rounded-sm" />
                <div className="w-3 h-3 bg-[#26a641] opacity-80 rounded-sm" />
                <div className="w-3 h-3 bg-[#39d353] rounded-sm" />
                <span>Mas</span>
            </div>
        </div>
    );
};

interface WorkspaceAnalyticsData {
    summary: {
        avgCycleTime: number;
        completionRate?: number;
        compilationRate?: number;
        projectHealth?: { on_track: number; at_risk: number; off_track: number; none: number };
    };
    velocity?: Array<{ name: string; points: number }>;
    workload?: Array<{ name: string; tasks: number }>;
    heatmap: Array<{ date: string; count: number }>;
}

export default function WorkspaceAnalyticsPage() {
    const [data, setData] = useState<WorkspaceAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const { isDark } = useTheme();
    const { workspace } = useWorkspace();

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const { data: json, error } = await api.get<WorkspaceAnalyticsData>(`/api/workspaces/${workspace.slug}/analytics`);
                if (!error && json) {
                    setData(json);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchAnalytics();
    }, [workspace.slug]);

    if (loading) return <div className="p-10 text-center animate-pulse">Cargando metricas...</div>;
    if (!data) return <div className="p-10 text-center">No hay datos disponibles</div>;

    const projectHealth = data.summary?.projectHealth || { on_track: 0, at_risk: 0, off_track: 0, none: 0 };
    const projectHealthData = [
        { name: 'On Track', value: projectHealth.on_track || 0, color: '#10B981' },
        { name: 'At Risk', value: projectHealth.at_risk || 0, color: '#F59E0B' },
        { name: 'Off Track', value: projectHealth.off_track || 0, color: '#EF4444' },
        { name: 'None', value: projectHealth.none || 0, color: '#6B7280' }
    ].filter(d => d.value > 0);
    const safeProjectHealthData = projectHealthData.length > 0
        ? projectHealthData
        : [{ name: 'Sin proyectos', value: 1, color: '#6B7280' }];
    const velocityData = data.velocity || [];
    const workloadData = data.workload || [];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn pb-20">
            <div>
                <h1 className="text-3xl font-bold mb-2">Panel de Liderazgo</h1>
                <p className="opacity-60 text-lg">Métricas clave sobre el rendimiento del equipo y salud de proyectos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Cycle Time Promedio"
                    value={data.summary.avgCycleTime}
                    sub="Días desde inicio a fin"
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                    color="bg-blue-500/10 text-blue-500"
                />
                <StatCard
                    title="Tasa de Entrega"
                    value={`${data.summary.completionRate ?? data.summary.compilationRate ?? 0}%`}
                    sub="Tareas completadas vs total"
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                    color="bg-green-500/10 text-green-500"
                />
                <StatCard
                    title="Proyectos en Riesgo"
                    value={(projectHealth.at_risk || 0) + (projectHealth.off_track || 0)}
                    sub={`${projectHealth.on_track || 0} en curso normal`}
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                    color="bg-orange-500/10 text-orange-500"
                />
                <StatCard
                    title="Velocidad Reciente"
                    value={velocityData.length > 0 ? velocityData[velocityData.length - 1].points : 0}
                    sub="Puntos entregados el último ciclo"
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m13 2-2 10h3L11 22"/></svg>}
                    color="bg-yellow-500/10 text-yellow-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <h3 className="font-bold mb-6">Velocidad del Equipo (Puntos por Ciclo)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={velocityData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} opacity={0.6} />
                                <YAxis axisLine={false} tickLine={false} fontSize={12} opacity={0.6} />
                                <Tooltip contentStyle={{ background: isDark ? '#1f2937' : '#fff', borderRadius: '8px', border: 'none' }} />
                                <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                                    {velocityData.map((_, index: number) => (
                                        <Cell key={`cell-${index}`} fill={index === velocityData.length - 1 ? '#00D4B3' : '#3B82F6'} fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <h3 className="font-bold mb-6">Distribución de Carga (Tareas Activas)</h3>
                    <div className="h-72">
                        {workloadData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={workloadData}>
                                    <PolarGrid strokeOpacity={0.1} />
                                    <PolarAngleAxis dataKey="name" fontSize={11} />
                                    <Radar name="Tareas" dataKey="tasks" stroke="#00D4B3" fill="#00D4B3" fillOpacity={0.5} />
                                    <Tooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center opacity-40">No hay tareas asignadas actualmente</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm h-full">
                    <h3 className="font-bold mb-6">Estado de Salud (Proyectos)</h3>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={safeProjectHealthData}
                                    innerRadius={60} 
                                    outerRadius={80} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                >
                                    {safeProjectHealthData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-gray-200 dark:border-white/5 lg:col-span-2 shadow-sm">
                    <h3 className="font-bold mb-4">Eficiencia Diaria (Completitud)</h3>
                    <p className="text-xs opacity-50 mb-6">Intensidad de entregas en los últimos 365 días</p>
                    <ActivityHeatmap data={data.heatmap} />
                </div>
            </div>
        </div>
    );
}
