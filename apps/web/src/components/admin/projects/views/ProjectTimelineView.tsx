import React, { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

interface Project {
  project_id: string;
  project_name: string;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  icon_color: string;
  lead?: { avatar?: string; color: string; initials: string };
}

interface ProjectTimelineViewProps {
  projects: Project[];
  basePath?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = new Date().getFullYear();
const CELL_WIDTH = 120; // Ancho fijo por mes para mejor control

// Helper para calcular posición (0 a 100% dentro del año o píxeles absolutos)
function getPosition(dateStr: string | null, fallbackDate: string) {
    let d = new Date(dateStr || fallbackDate);
    const startOfYear = new Date(CURRENT_YEAR, 0, 1);
    
    if (d.getFullYear() < CURRENT_YEAR) d = startOfYear;
    
    const diffTime = Math.abs(d.getTime() - startOfYear.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Simplificación visual
    const month = d.getMonth();
    const day = d.getDate();
    return (month * CELL_WIDTH) + (day * (CELL_WIDTH / 30));
}

export function ProjectTimelineView({ projects, basePath = '/admin' }: ProjectTimelineViewProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Calcular posición de "Hoy"
  const todayX = getPosition(new Date().toISOString(), new Date().toISOString());

  // Scroll inicial a "Hoy" (centrado)
  useEffect(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = todayX - 300; // Centrar un poco
    }
  }, [todayX]);

  // Estilos dinámicos
  const bgMain = isDark ? 'bg-[#0F1419]' : 'bg-white';
  const bgHeader = isDark ? 'bg-[#161920]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
  const textColor = isDark ? 'text-gray-300' : 'text-gray-900';
  const subTextColor = isDark ? 'text-gray-500' : 'text-gray-500';
  const todayLineColor = isDark ? 'bg-blue-500' : 'bg-blue-600';
  const gridLineColor = isDark ? 'border-white/[0.03]' : 'border-gray-100';

  return (
    <div className={`flex flex-col h-full ${bgMain} rounded-xl border ${borderColor} overflow-hidden shadow-sm`}>
      
      {/* 1. Header Row (Sticky Titles) */}
      <div className={`flex border-b ${borderColor} ${bgHeader} z-10`}>
        {/* Project Column Header */}
        <div className={`w-64 flex-shrink-0 p-3 text-xs font-semibold uppercase tracking-wider ${subTextColor} border-r ${borderColor} flex items-center ${bgHeader} z-20 shadow-[4px_0_24px_rgba(0,0,0,0.05)]`}>
            Active Projects
        </div>
        
        {/* Months Header Scrollable Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-x-auto hide-scrollbar flex relative">
            {MONTHS.map((m, i) => (
               <div 
                 key={m} 
                 className={`flex-shrink-0 text-xs font-medium ${subTextColor} border-r ${isDark ? 'border-white/5' : 'border-gray-200'} py-3 text-center ${bgHeader}`}
                 style={{ width: CELL_WIDTH }}
               >
                   {m} <span className="opacity-50 font-normal">{CURRENT_YEAR}</span>
               </div>
            ))}
            {/* Indicador de HOY en el header */}
            <div 
                className={`absolute top-0 bottom-0 w-px ${todayLineColor} z-10 pointer-events-none`}
                style={{ left: todayX, height: '100%' }}
            >
                <div className={`${todayLineColor} text-[9px] font-bold text-white px-1 rounded-sm absolute -top-0 -translate-x-1/2`}>
                    TODAY
                </div>
            </div>
        </div>
      </div>

      {/* 2. Body Area */}
      <div className="flex-1 overflow-y-auto relative flex">
         
         {/* Fixed Column: Project Names */}
         <div className={`w-64 flex-shrink-0 z-10 ${bgMain} border-r ${borderColor} shadow-[4px_0_24px_rgba(0,0,0,0.05)]`}>
             {projects.map(project => (
                 <div 
                    key={project.project_id} 
                    className={`h-12 border-b ${isDark ? 'border-white/5' : 'border-gray-100'} flex items-center px-4 gap-3 cursor-pointer ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50'} transition-colors group`}
                    onClick={() => router.push(`${basePath}/projects/${project.project_id}`)}
                 >
                     <div className="w-2.5 h-2.5 rounded-sm shadow-sm flex-shrink-0" style={{ backgroundColor: project.icon_color || '#3B82F6' }} />
                     <div className="min-w-0">
                         <div className={`text-sm ${textColor} font-medium truncate group-hover:text-blue-500 transition-colors`}>
                             {project.project_name}
                         </div>
                     </div>
                 </div>
             ))}
         </div>

         {/* Scrollable Column: Timeline Bars */}
          <div 
            className="flex-1 overflow-x-auto custom-scrollbar relative"
            onScroll={(e) => {
                if (scrollContainerRef.current && e.currentTarget) {
                    scrollContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
            }}
          >
             <div className="relative min-w-max">
                 {/* Background Grid (Full Height) */}
                 <div className="absolute inset-0 flex pointer-events-none z-0">
                     {MONTHS.map((m, i) => (
                         <div 
                             key={m} 
                             className={`flex-shrink-0 border-r ${gridLineColor} h-full ${i % 2 === 0 ? (isDark ? 'bg-white/[0.005]' : 'bg-gray-50/50') : ''}`} 
                             style={{ width: CELL_WIDTH }} 
                         />
                     ))}
                     {/* Línea de Hoy Vertical (Full Height) */}
                     <div 
                         className={`absolute top-0 bottom-0 w-px ${todayLineColor} z-0 dashed opacity-50`}
                         style={{ left: todayX }}
                     />
                 </div>

                 {/* Rows logic */}
                 <div className="relative z-10 pt-0">
                     {projects.map(project => {
                         const startX = getPosition(project.start_date, project.created_at || new Date().toISOString());
                         const fallbackEnd = new Date(project.start_date || project.created_at || new Date());
                         fallbackEnd.setMonth(fallbackEnd.getMonth() + 1);
                         
                         const endX = getPosition(project.target_date, fallbackEnd.toISOString());
                         const width = Math.max(endX - startX, 40);

                         return (
                             <div key={project.project_id} className="h-12 border-b border-transparent flex items-center relative hover:bg-black/[0.02]">
                                 <div 
                                     className={`absolute h-7 rounded-[4px] shadow-sm border flex items-center px-3 text-xs overflow-hidden whitespace-nowrap cursor-pointer hover:brightness-110 transition-all group ${isDark ? 'text-white border-white/10' : 'text-gray-800 border-black/5'}`}
                                     onClick={() => router.push(`${basePath}/projects/${project.project_id}`)}
                                     style={{ 
                                         left: `${startX}px`, 
                                         width: `${width}px`,
                                         backgroundColor: `${project.icon_color || '#3B82F6'}${isDark ? '30' : '20'}`, // Más transparente en light
                                         borderColor: `${project.icon_color || '#3B82F6'}${isDark ? '60' : '40'}`,
                                         boxShadow: `0 2px 4px rgba(0,0,0,0.05)`
                                     }}
                                 >
                                      <span className="font-medium opacity-90 truncate w-full">
                                          {(width < 60) ? '' : project.project_name}
                                      </span>
                                      
                                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 border border-white/20 px-2 py-1 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap shadow-xl">
                                          {new Date(project.start_date || project.created_at).toLocaleDateString()} - {project.target_date ? new Date(project.target_date).toLocaleDateString() : 'TBD'}
                                      </div>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
}
