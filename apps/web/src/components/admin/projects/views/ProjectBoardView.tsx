import React from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface Project {
  project_id: string;
  project_name: string;
  project_key: string;
  project_status: string; // planning, active, etc.
  priority_level: string;
  target_date: string | null;
  lead?: { name: string; avatar?: string; color: string; initials: string };
  icon_color: string;
}

interface ProjectBoardViewProps {
  projects: Project[];
  basePath?: string;
  onAddProject?: (status: string) => void;
}

const COLUMN_CONFIG = [
  { id: 'planning', label: 'Planned', color: '#D1D5DB' }, // gray-300
  { id: 'active', label: 'In Progress', color: '#F59E0B' }, // amber-500
  { id: 'completed', label: 'Completed', color: '#3B82F6' }, // blue-500
  { id: 'cancelled', label: 'Canceled', color: '#EF4444' }, // red-500
];

export function ProjectBoardView({ projects, basePath = '/admin', onAddProject }: ProjectBoardViewProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  // Estilos dinámicos
  const textColor = isDark ? 'text-gray-200' : 'text-gray-900';
  const subTextColor = isDark ? 'text-gray-500' : 'text-gray-500';
  
  // Card Styles
  const cardBg = isDark ? 'bg-[#1E2329]' : 'bg-white';
  const cardBorder = isDark ? 'border-white/5' : 'border-gray-200';
  const cardHoverBorder = isDark ? 'hover:border-gray-600' : 'hover:border-blue-400';
  const cardShadow = isDark ? 'shadow-sm' : 'shadow-sm';

  // Agrupar proyectos por columna
  const columns = COLUMN_CONFIG.map(col => ({
    ...col,
    items: projects.filter(p => {
        if (col.id === 'planning' && (p.project_status === 'planning' || p.project_status === 'on_hold')) return true;
        if (col.id === 'cancelled' && (p.project_status === 'cancelled' || p.project_status === 'archived')) return true;
        return p.project_status === col.id;
    })
  }));

  return (
    <div className="flex h-full overflow-x-auto pb-4 gap-6 min-w-full">
      {columns.map(col => (
        <div key={col.id} className="min-w-[280px] w-[280px] shrink-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full border-2" 
                style={{ borderColor: col.color }} 
              />
              <span className={`font-medium text-sm ${textColor}`}>{col.label}</span>
              <span className="text-xs text-gray-400 ml-1">{col.items.length}</span>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => onAddProject?.(col.id)}
                className={`text-gray-400 hover:text-gray-500 p-1 rounded ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-200'} transition-colors`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Cards Container */}
          <div className="flex flex-col gap-3 min-h-[50px]">
            {col.items.map(project => (
              <div
                key={project.project_id}
                onClick={() => router.push(`${basePath}/projects/${project.project_id}`)}
                className={`group relative ${cardBg} border ${cardBorder} p-3 rounded-lg ${cardShadow} ${cardHoverBorder} transition-all cursor-pointer flex flex-col gap-2`}
              >
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="font-mono opacity-70">{project.project_key}</span>
                    </div>
                </div>
                
                <div className={`font-medium text-sm ${textColor} leading-snug`}>
                    {project.project_name}
                </div>

                {/* Footer: Priority, Date, Lead */}
                <div className="mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         {/* Priority Indicator */}
                         <div className={`w-4 h-4 rounded flex items-center justify-center border ${isDark ? 'border-white/10' : 'border-black/5'} ${
                            project.priority_level === 'urgent' ? 'bg-red-500/20 text-red-500' :
                            project.priority_level === 'high' ? 'bg-orange-500/20 text-orange-500' :
                            isDark ? 'bg-gray-700/30 text-gray-500' : 'bg-gray-100 text-gray-600'
                         }`}>
                             <span className="text-[8px] font-bold uppercase">{project.priority_level?.[0] || '-'}</span>
                         </div>
                         {/* Target Date */}
                         {project.target_date && (
                            <span className={`text-[10px] ${subTextColor}`}>
                                {new Date(project.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                         )}
                    </div>

                    {/* Lead Avatar */}
                    {project.lead && (
                        <div 
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white border ${isDark ? 'border-[#1E2329]' : 'border-white'}`}
                            style={{ backgroundColor: project.lead.color }}
                            title={project.lead.name}
                        >
                            {project.lead.initials}
                        </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
