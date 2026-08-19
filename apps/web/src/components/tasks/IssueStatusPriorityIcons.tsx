// Íconos puros (sin estado) para representar status_type y nivel de prioridad
// de una tarea. Se usan tanto en el formulario de creación como en sus dropdowns.

export const StatusIcon = ({ type, color, size = 16 }: { type: string; color: string; size?: number }) => {
  const style = { color };
  switch (type) {
    case 'backlog':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
          <circle cx="12" cy="12" r="10" strokeDasharray="4 4"/>
        </svg>
      );
    case 'todo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      );
    case 'in_progress':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      );
    case 'done':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
      );
    case 'cancelled':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2"/>
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      );
  }
};

export const PriorityIcon = ({ level, color, size = 16 }: { level: number; color: string; size?: number }) => {
  return (
    <div
      className="rounded flex items-center justify-center"
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}20`,
        color
      }}
    >
      {level === 0 && <span style={{ fontSize: size * 0.625 }}>—</span>}
      {level === 1 && <span style={{ fontSize: size * 0.625, fontWeight: 'bold' }}>!</span>}
      {level === 2 && <span style={{ fontSize: size * 0.625, fontWeight: 'bold' }}>↑</span>}
      {level === 3 && <span style={{ fontSize: size * 0.625, fontWeight: 'bold' }}>=</span>}
      {level === 4 && <span style={{ fontSize: size * 0.625, fontWeight: 'bold' }}>↓</span>}
    </div>
  );
};
