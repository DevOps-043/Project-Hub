import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutList, Kanban, CalendarRange, Check, ChevronDown } from 'lucide-react';

export type ViewType = 'list' | 'board' | 'timeline';

interface DisplaySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  
  // New props for functionality
  grouping: 'none' | 'status' | 'priority';
  onGroupingChange: (grouping: 'none' | 'status' | 'priority') => void;
  ordering: 'manual' | 'alphabetical' | 'newest';
  onOrderingChange: (ordering: 'manual' | 'alphabetical' | 'newest') => void;
  showClosed: 'all' | 'active' | 'closed';
  onShowClosedChange: (value: 'all' | 'active' | 'closed') => void;
  showCycles: boolean;
  onShowCyclesChange: (value: boolean) => void;
}

import { useTheme } from '@/contexts/ThemeContext';

export function DisplaySettings({ 
  isOpen, 
  onClose, 
  currentView, 
  onViewChange,
  triggerRef,
  grouping,
  onGroupingChange,
  ordering,
  onOrderingChange,
  showClosed,
  onShowClosedChange,
  showCycles,
  onShowCyclesChange
}: DisplaySettingsProps) {
  const { isDark } = useTheme();

  // Estilos dinámicos
  const bgPanel = isDark ? 'bg-[#1E2329]' : 'bg-white';
  const borderPanel = isDark ? 'border-white/10' : 'border-gray-200';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const separator = isDark ? 'border-white/5' : 'border-gray-100';
  
  const bgControl = isDark ? 'bg-black/20' : 'bg-gray-100';
  const itemActive = isDark ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm border border-gray-200';
  const itemInactive = isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-white';
  
  const btnSecondary = isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900';
  const aquaColor = '#00D4B3';

  // Componente Dropdown Premium local
  const PremiumDropdown = ({ 
    value, 
    options, 
    onChange, 
    className = "" 
  }: { 
    value: string, 
    options: { value: string, label: string }[], 
    onChange: (val: any) => void,
    className?: string
  }) => {
    const [isInternalOpen, setIsInternalOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Cerrar al hacer clic fuera
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsInternalOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value) || options[0];

    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsInternalOpen(!isInternalOpen)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border-2 transition-all duration-200 text-xs font-medium ${
            isDark 
              ? 'bg-[#1E2329] text-white hover:bg-[#252a31]' 
              : 'bg-white text-gray-900 hover:bg-gray-50'
          }`}
          style={{
            borderColor: isInternalOpen ? aquaColor : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
          }}
        >
          <span>{selectedOption?.label}</span>
          <motion.div
            animate={{ rotate: isInternalOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={14} className="opacity-50" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isInternalOpen && (
            <motion.div
              initial={{ opacity: 0, y: className.includes('open-up') ? 4 : -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: className.includes('open-up') ? 4 : -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`absolute ${className.includes('open-up') ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 right-0 min-w-[120px] rounded-xl border shadow-2xl z-[60] overflow-hidden ${
                isDark ? 'bg-[#1E2329] border-white/10' : 'bg-white border-gray-100'
              }`}
            >
              <div className="py-1">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsInternalOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between group ${
                      value === option.value
                        ? (isDark ? 'bg-white/5 text-white' : 'bg-[#00D4B3]/5 text-[#00D4B3]')
                        : (isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')
                    }`}
                  >
                    <span>{option.label}</span>
                    {value === option.value && <Check size={12} className={isDark ? 'text-white' : 'text-[#00D4B3]'} />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className={`absolute right-0 top-full mt-2 w-80 ${bgPanel} border ${borderPanel} rounded-xl shadow-2xl z-50`}
          style={{ transformOrigin: 'top right' }}
        >
          {/* View Type Selector */}
          <div className={`p-3 border-b ${separator} rounded-t-xl`}>
            <div className={`grid grid-cols-3 gap-1 ${bgControl} p-1 rounded-lg`}>
              {(['list', 'board', 'timeline'] as ViewType[]).map((view) => (
                <button
                  key={view}
                  onClick={() => onViewChange(view)}
                  className={`flex flex-col items-center gap-1.5 py-2 rounded-md text-[10px] font-medium transition-all ${
                    currentView === view ? itemActive : itemInactive
                  }`}
                >
                  {view === 'list' && <LayoutList size={16} />}
                  {view === 'board' && <Kanban size={16} />}
                  {view === 'timeline' && <CalendarRange size={16} />}
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Grouping & Ordering */}
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 text-sm ${textSub}`}>
                <LayoutList size={14} />
                <span>Grouping</span>
              </div>
              <PremiumDropdown 
                value={grouping}
                onChange={onGroupingChange}
                className="w-40"
                options={[
                  { value: 'none', label: 'No grouping' },
                  { value: 'status', label: 'By Status' },
                  { value: 'priority', label: 'By Priority' }
                ]}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 text-sm ${textSub}`}>
                <div className="rotate-90"><LayoutList size={14} /></div>
                <span>Ordering</span>
              </div>
              <PremiumDropdown 
                value={ordering}
                onChange={onOrderingChange}
                className="w-40"
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'alphabetical', label: 'Alphabetical' },
                  { value: 'newest', label: 'Newest first' }
                ]}
              />
            </div>
          </div>

          {/* Additional Options */}
          <div className={`p-4 border-t ${separator} space-y-3`}>
             <div className="flex items-center justify-between text-sm">
                <span className={textSub}>Show projects</span>
                <PremiumDropdown 
                  value={showClosed}
                  onChange={onShowClosedChange}
                  className="w-32 open-up"
                  options={[
                    { value: 'all', label: 'All projects' },
                    { value: 'active', label: 'Only active' },
                    { value: 'closed', label: 'Only closed' }
                  ]}
                />
             </div>
             <div className="flex items-center justify-between text-sm">
                <span className={textSub}>Show cycles</span>
                <button 
                  onClick={() => onShowCyclesChange(!showCycles)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border-2 transition-all duration-200 ${
                    showCycles 
                      ? (isDark ? 'bg-[#00D4B3]/10 text-[#00D4B3] border-[#00D4B3]' : 'bg-[#00D4B3]/5 text-[#00D4B3] border-[#00D4B3]') 
                      : (isDark ? 'bg-[#1E2329] text-gray-500 border-white/5' : 'bg-gray-50 text-gray-400 border-gray-100')
                    }`}
                >
                  {showCycles ? 'Visible' : 'None'}
                </button>
             </div>
          </div>

          <div className={`p-3 border-t ${separator} ${isDark ? 'bg-white/2' : 'bg-gray-50'} flex justify-between items-center rounded-b-xl`}>
            <button 
                onClick={onClose}
                className={`text-xs ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
            >
                Reset to default
            </button>
            <button 
                onClick={onClose}
                className="text-xs text-blue-500 hover:text-blue-600 transition-colors font-medium"
            >
                Done
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
