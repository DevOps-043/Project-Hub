import React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

// Definición de tipos duplicada para aislamiento
interface Project {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  icon_name: string;
  icon_color: string;
  health_status: 'on_track' | 'at_risk' | 'off_track' | 'none';
  priority_level: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  lead?: {
    id: string;
    name: string;
    avatar?: string;
    initials: string;
    color: string;
  };
  target_date: string | null;
  completion_percentage: number;
  progress_history: { value: number }[];
  team_name?: string;
}

interface ProjectListViewProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  basePath?: string;
  grouping?: 'none' | 'status' | 'priority';
  showCycles?: boolean;
}

// Sub-components helpers
const ProjectIcons: Record<string, React.ReactNode> = {
  folder: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  rocket: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>,
  target: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  zap: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
};

function PriorityIcon({ priority }: { priority: string }) {
  const colors: any = { urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#6B7280', none: 'transparent' };
  if (priority === 'none') return <span className="w-5" />;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 14V3L8 1L13 3V14L8 12L3 14Z" fill={colors[priority]} stroke={colors[priority]} strokeWidth="1.5" strokeLinejoin="round" />
      {priority === 'urgent' && <text x="8" y="9" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">!</text>}
    </svg>
  );
}

function HealthIndicator({ health }: { health: string }) {
  const colors: any = { 'on_track': '#22C55E', 'at_risk': '#F59E0B', 'off_track': '#EF4444' };
  if (health === 'none' || !colors[health]) return <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-400 opacity-50" />;
  return <div className="w-5 h-5 rounded-full" style={{ backgroundColor: colors[health] }} />;
}

function Avatar({ user }: { user?: any }) {
  if (!user) return <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-[10px] text-gray-500">?</div>;
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shadow-sm" style={{ backgroundColor: user.color || '#6B7280' }} title={user.name}>
      {user.initials}
    </div>
  );
}

function StatusBadge({ status, progressData }: { status: number; progressData: any[] }) {
  const color = status === 100 ? '#22C55E' : status >= 60 ? '#F59E0B' : status > 0 ? '#F59E0B' : '#6B7280';
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium" style={{ color }}>{status === 100 ? '✓' : '○'} {status}%</span>
      <div className="w-16 h-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={progressData}><Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} /></LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Skeleton actualizado
const TableSkeleton = ({ isDark }: { isDark: boolean }) => (
    <div className="animate-pulse space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`flex items-center gap-4 py-3 px-2 border-b ${isDark ? 'border-white/5 bg-white/[0.01]' : 'border-gray-100 bg-white'}`}>
          <div className={`w-6 h-6 rounded ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
          <div className={`flex-1 h-4 rounded w-full max-w-[300px] ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
          <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
          <div className={`w-16 h-4 rounded ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
        </div>
      ))}
    </div>
);

export function ProjectListView({ 
  projects, 
  loading, 
  error, 
  onRefresh, 
  basePath = '/admin',
  grouping = 'none',
  showCycles = false
}: ProjectListViewProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
  const textColor = isDark ? 'text-gray-200' : 'text-gray-900';
  const subTextColor = isDark ? 'text-gray-500' : 'text-gray-500';
  const hoverBg = isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50';

  if (loading) return <TableSkeleton isDark={isDark} />;
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-red-500">
        <p>{error}</p>
        <button onClick={onRefresh} className={`mt-4 px-4 py-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}>Reintentar</button>
      </div>
    );
  }

  if (projects.length === 0) {
     return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <p>No projects found.</p>
        </div>
     )
  }

  // Logic for grouping
  const getGroups = () => {
    if (grouping === 'none') return [{ id: 'all', label: '', projects }];
    
    const groups: Record<string, { label: string, projects: Project[] }> = {};
    
    projects.forEach(p => {
      let key = '';
      let label = '';
      
      if (grouping === 'status') {
        key = p.project_status || 'planning';
        label = key.charAt(0).toUpperCase() + key.slice(1);
      } else if (grouping === 'priority') {
        key = p.priority_level || 'none';
        label = key.charAt(0).toUpperCase() + key.slice(1) + ' Priority';
      }
      
      if (!groups[key]) groups[key] = { label, projects: [] };
      groups[key].projects.push(p);
    });
    
    return Object.entries(groups).map(([id, data]) => ({ id, ...data }));
  };

  const projectGroups = getGroups();

  return (
    <div className={`rounded-xl overflow-hidden ${isDark ? '' : 'bg-white shadow-sm border border-gray-100'}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className={`text-xs font-medium uppercase tracking-wider border-b ${borderColor} ${subTextColor} ${isDark ? 'bg-[#161920]' : 'bg-gray-50'}`}>
            <th className="text-left py-3 px-4 w-1/2">Name</th>
            <th className="text-center py-3 px-2 w-16">Health</th>
            <th className="text-center py-3 px-2 w-16">Priority</th>
            <th className="text-center py-3 px-2 w-16">Lead</th>
            {showCycles && <th className="text-center py-3 px-2 w-24">Cycles</th>}
            <th className="text-left py-3 px-4 w-24">Target date</th>
            <th className="text-left py-3 px-4 w-32">Status</th>
          </tr>
        </thead>
        <tbody>
          {projectGroups.map((group) => (
            <React.Fragment key={group.id}>
              {group.label && (
                <tr className={isDark ? 'bg-white/5' : 'bg-gray-50'}>
                  <td colSpan={showCycles ? 7 : 6} className="py-2 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    {group.label} ({group.projects.length})
                  </td>
                </tr>
              )}
              {group.projects.map((project) => (
                <tr 
                  key={project.project_id}
                  onClick={() => router.push(`${basePath}/projects/${project.project_id}`)}
                  className={`border-b ${borderColor} transition-colors ${hoverBg} cursor-pointer group last:border-0`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${project.icon_color}20`, color: project.icon_color }}>
                        {ProjectIcons[project.icon_name] || ProjectIcons['folder']}
                      </span>
                      <div>
                        <div className={`text-sm font-medium transition-colors ${textColor} group-hover:text-[#00D4B3]`}>{project.project_name}</div>
                        {project.project_description && <div className="text-xs text-gray-400 truncate max-w-[300px]">{project.project_description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center"><div className="flex justify-center"><HealthIndicator health={project.health_status} /></div></td>
                  <td className="py-3 px-2 text-center"><div className="flex justify-center"><PriorityIcon priority={project.priority_level} /></div></td>
                  <td className="py-3 px-2 text-center"><div className="flex justify-center"><Avatar user={project.lead} /></div></td>
                  {showCycles && (
                    <td className="py-3 px-2 text-center">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">Cycle 12</span>
                    </td>
                  )}
                  <td className="py-3 px-4"><span className={`text-sm ${subTextColor}`}>{project.target_date || '—'}</span></td>
                  <td className="py-3 px-4"><StatusBadge status={project.completion_percentage} progressData={project.progress_history} /></td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
