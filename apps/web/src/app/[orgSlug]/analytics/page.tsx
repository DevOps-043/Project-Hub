'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Legend
} from 'recharts';

const StatCard = ({ title, value, sub, icon, color }: any) => (
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

export default function WorkspaceAnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { isDark } = useTheme();
    const { workspace } = useWorkspace();

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                const res = await fetch(`/api/workspaces/${workspace.slug}/analytics`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchAnalytics();
    }, [workspace.slug]);

    if (loading) return <div className="p-10 text-center animate-pulse">Cargando metricas...</div>;
    if (!data) return <div className="p-10 text-center">No hay datos disponibles</div>;

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
            <div>
                <h1 className="text-3xl font-bold mb-2">Analiticas</h1>
                <p className="opacity-60">Vision general del rendimiento del equipo y uso del sistema.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Tareas Totales"
                    value={data.tasks.total}
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
                    color="bg-blue-500/10 text-blue-500"
                />
                <StatCard
                    title="Proyectos Activos"
                    value={data.projects.active}
                    sub={`${data.projects.completed} Completados`}
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}
                    color="bg-purple-500/10 text-purple-500"
                />
                <StatCard
                    title="Tasa de Completitud"
                    value={`${data.tasks.total > 0 ? Math.round((data.tasks.distribution.find((d:any) => d.name === 'Completadas')?.value || 0) / data.tasks.total * 100) : 0}%`}
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                    color="bg-green-500/10 text-green-500"
                />
                <StatCard
                    title="Uso de Tokens (Hoy)"
                    value={data.ariaUsage?.length > 0 ? data.ariaUsage[data.ariaUsage.length - 1].tokens : 0}
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.93 4.93 14.14 14.14"/><path d="m19.07 4.93-14.14 14.14"/></svg>}
                    color="bg-[#00D4B3]/10 text-[#00D4B3]"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-gray-200 dark:border-white/5 lg:col-span-1 shadow-sm">
                    <h3 className="font-bold mb-6">Estado de Tareas</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={data.tasks.distribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {data.tasks.distribution.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: isDark ? '#1f2937' : '#fff', borderRadius: '8px', border: 'none' }} itemStyle={{ color: isDark ? '#fff' : '#000' }} />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-gray-200 dark:border-white/5 lg:col-span-2 shadow-sm">
                    <h3 className="font-bold mb-6">Top Productividad (Usuarios)</h3>
                    <div className="space-y-4">
                        {data.leaderboard.map((item: any, i: number) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${i === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-200 dark:bg-zinc-800'}`}>
                                    {i + 1}
                                </div>
                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden relative">
                                    {item.user.avatar_url ? (
                                        <img src={item.user.avatar_url} className="object-cover w-full h-full" alt="avatar" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold text-xs">
                                            {item.user.full_name?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm">{item.user.full_name}</h4>
                                    <p className="text-xs opacity-50">{item.user.email}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block font-bold text-lg text-[#00D4B3]">{item.count}</span>
                                    <span className="text-xs opacity-50">tareas</span>
                                </div>
                            </div>
                        ))}
                        {data.leaderboard.length === 0 && (
                            <div className="text-center py-10 opacity-50">No hay datos suficientes aun</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold">Mapa de Actividad</h3>
                </div>
                <ActivityHeatmap data={data.heatmap} />
            </div>

            {data.ariaUsage?.length > 0 && (
                <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <h3 className="font-bold mb-6">Consumo de IA (Tokens)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.ariaUsage}>
                                <defs>
                                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00D4B3" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#00D4B3" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} opacity={0.5} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} opacity={0.5} />
                                <Tooltip contentStyle={{ background: isDark ? '#1f2937' : '#fff', borderRadius: '8px', border: 'none' }} itemStyle={{ color: '#00D4B3' }} />
                                <CartesianGrid vertical={false} strokeOpacity={0.1} />
                                <Area type="monotone" dataKey="tokens" stroke="#00D4B3" fillOpacity={1} fill="url(#colorTokens)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
