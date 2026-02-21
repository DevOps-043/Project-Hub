'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTheme, themeColors } from '@/contexts/ThemeContext';

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { teamId, memberId, orgSlug } = params as { teamId: string; memberId: string; orgSlug: string };
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  
  const accentColor = '#00D4B3';
  const primaryColor = '#0A2540';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'projects'>('overview');

  const fetchMemberDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members/${memberId}`);
      if (!res.ok) throw new Error('Failed to fetch member details');
      const jsonData = await res.json();
      setData(jsonData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [teamId, memberId]);

  useEffect(() => {
    fetchMemberDetails();
  }, [fetchMemberDetails]);

  if (loading) {
     return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor }} />
      </div>
    );
  }

  if (!data) return null;

  const { user, tasks, projects } = data;

  // Stats Calculation
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.status?.status_type === 'done' || t.status?.name === 'completed').length;
  const pendingTasks = totalTasks - completedTasks;
  const totalProjects = projects.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bgPrimary }}>
       {/* Background Decoration */}
       <div 
          className="absolute top-0 left-0 right-0 h-64 opacity-20 pointer-events-none"
          style={{ 
            background: `linear-gradient(to bottom, ${primaryColor}, transparent)`
          }}
        />

      {/* Header / Breadcrumbs */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 pt-8 pb-6">
         <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: colors.textMuted }}>
            <Link href={`/${orgSlug}/admin/teams/${teamId}/members`} className="hover:text-white transition-colors">Miembros</Link>
            <span>/</span>
            <span style={{ color: colors.textPrimary }}>Perfil de Usuario</span>
         </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pb-12">
        
        {/* Profile Header Card */}
        <div className="rounded-2xl border p-8 mb-8 flex flex-col md:flex-row items-start md:items-center gap-8 backdrop-blur-xl"
             style={{ 
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                borderColor: colors.border,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
             }}
        >
            <div className="relative">
                <div 
                    className="w-32 h-32 rounded-3xl flex items-center justify-center text-4xl font-bold shadow-2xl"
                    style={{ 
                        background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                        color: 'white'
                    }}
                >
                    {user.avatar_url ? (
                        <img src={user.avatar_url} className="w-full h-full object-cover rounded-3xl" />
                    ) : (user.first_name?.[0] || 'U')}
                </div>
                <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-4 ${user.account_status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`} 
                     style={{ borderColor: isDark ? '#0F1419' : '#fff' }} />
            </div>

            <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                        {user.display_name || `${user.first_name} ${user.last_name_paternal}`}
                    </h1>
                     <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border"
                          style={{ 
                            backgroundColor: `${accentColor}15`,
                            color: accentColor,
                            borderColor: `${accentColor}30`
                          }}>
                        {user.role}
                    </span>
                </div>
                
                <p className="text-lg mb-4" style={{ color: colors.textSecondary }}>
                    {user.job_title || 'Sin cargo definido'} • {user.department || 'Sin departamento'}
                </p>

                <div className="flex flex-wrap gap-6 text-sm" style={{ color: colors.textMuted }}>
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Unido: {new Date(user.joined_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        {user.email}
                    </div>
                     {user.phone_number && (
                        <div className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            {user.phone_number}
                        </div>
                    )}
                </div>
            </div>

            {/* <div className="flex flex-col gap-3 min-w-[150px]">
                <button className="px-5 py-2.5 rounded-xl font-medium text-sm text-white transition-all hover:opacity-90 shadow-lg shadow-purple-900/20"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
                    Asignar Tarea
                </button>
                 <button className="px-5 py-2.5 rounded-xl font-medium text-sm border transition-colors hover:bg-white/5"
                    style={{ borderColor: colors.border, color: colors.textPrimary }}>
                    Editar Perfil
                </button>
            </div> */}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title="Total Tareas" value={totalTasks} icon="list" color="#3B82F6" isDark={isDark} colors={colors} />
            <StatCard title="Completadas" value={completedTasks} icon="check" color="#10B981" isDark={isDark} colors={colors} />
            <StatCard title="Pendientes" value={pendingTasks} icon="clock" color="#F59E0B" isDark={isDark} colors={colors} />
            <StatCard title="Proyectos" value={totalProjects} icon="folder" color="#8B5CF6" isDark={isDark} colors={colors} />
        </div>

        {/* Tabs & Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Tasks */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>Tareas Recientes</h2>
                     <button className="text-xs font-bold uppercase tracking-wider hover:underline" style={{ color: accentColor }}>Ver Todas</button>
                </div>

                <div className="space-y-3">
                    {tasks.length > 0 ? (
                        tasks.map((task: any) => (
                             <div key={task.issue_id} className="p-4 rounded-xl border flex items-center gap-4 group transition-all hover:shadow-md hover:border-blue-500/30"
                                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'white', borderColor: colors.border }}>
                                <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0`} style={{ backgroundColor: task.priority?.color || '#ccc' }} />
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono opacity-50">#{task.issue_number}</span>
                                        <h3 className="font-medium text-sm truncate" style={{ color: colors.textPrimary }}>{task.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs opacity-60" style={{ color: colors.textMuted }}>
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.status?.color }}></span>
                                            {task.status?.name}
                                        </span>
                                        {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                                
                                <button className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-white/10 transition-all">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                             </div>
                        ))
                    ) : (
                        <div className="p-8 text-center rounded-xl border border-dashed" style={{ borderColor: colors.border, color: colors.textMuted }}>
                            <p>No hay tareas asignadas</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Projects & Info */}
            <div className="space-y-8">
                 <div>
                     <h2 className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>Proyectos</h2>
                     <div className="space-y-3">
                        {projects.length > 0 ? (
                            projects.map((project: any) => (
                                <div key={project.project_id} className="p-4 rounded-xl border transition-all hover:bg-white/5"
                                     style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'white', borderColor: colors.border }}>
                                    <div className="flex items-center gap-3 mb-2">
                                         <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs"
                                              style={{ backgroundColor: project.icon_color || '#3B82F6' }}>
                                             {project.project_name[0]}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <div className="font-medium text-sm truncate" style={{ color: colors.textPrimary }}>{project.project_name}</div>
                                             <div className="text-xs opacity-50" style={{ color: colors.textMuted }}>{project.project_key}</div>
                                         </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                        <span style={{ color: colors.textMuted }}>Role: <span className="text-white">{project.role}</span></span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-white/10 text-white`}>
                                            {project.project_status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                             <div className="p-6 text-center rounded-xl border border-dashed" style={{ borderColor: colors.border, color: colors.textMuted }}>
                                <p className="text-sm">Sin proyectos</p>
                            </div>
                        )}
                     </div>
                 </div>

                 <div className="p-6 rounded-xl border backdrop-blur-sm"
                      style={{ 
                          backgroundColor: `${primaryColor}10`,
                          borderColor: `${primaryColor}30`
                      }}>
                     <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: primaryColor }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        Seguridad
                     </h3>
                     <div className="space-y-2 text-sm opacity-80" style={{ color: colors.textPrimary }}>
                        <p>Rol: {user.role}</p>
                        <p>Última actividad: {user.last_activity_at ? new Date(user.last_activity_at).toLocaleString() : 'N/A'}</p>
                     </div>
                 </div>
            </div>

        </div>

      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color, isDark, colors }: any) {
    return (
        <motion.div 
            whileHover={{ y: -2 }}
            className="p-5 rounded-xl border backdrop-blur-sm relative overflow-hidden group"
            style={{ 
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
                borderColor: colors.border
            }}
        >
            <div className={`absolute top-0 right-0 p-2 rounded-bl-xl opacity-20 group-hover:opacity-100 transition-opacity`} style={{ backgroundColor: color }}>
                {/* Icon Placeholder depending on string */}
                <div className="w-4 h-4" /> 
            </div>
            
            <p className="text-xs uppercase font-bold tracking-wider mb-1 opacity-60" style={{ color: colors.textMuted }}>{title}</p>
            <h3 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                {value}
            </h3>
            <div className="w-full h-1 mt-3 rounded-full overflow-hidden bg-gray-500/10">
                <div className="h-full rounded-full" style={{ width: '70%', backgroundColor: color }} />
            </div>
        </motion.div>
    )
}
