'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  ListChecks,
  Loader2,
  Mail,
  PencilLine,
  Phone,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import styles from './MembersPage.module.css';

interface ProjectStat {
  id: string;
  name: string;
  key: string;
  status: string;
  progress: number;
  color: string;
  role: string;
  tasksAssigned: number;
  tasksCompleted: number;
}

interface MemberStats {
  projectCount: number;
  activeProjectCount: number;
  averageProgress: number;
  tasksAssigned: number;
  tasksCompleted: number;
  completionRate: number;
  projects: ProjectStat[];
}

interface Member {
  id: string;
  firstName: string;
  lastNamePaternal: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  permissionLevel: string;
  irisRole: string;
  sofiaRole: string;
  companyRole: string;
  department: string;
  phoneNumber: string;
  accountStatus: string;
  lastActivityAt: string | null;
  stats: MemberStats;
}

interface MemberForm {
  firstName: string;
  lastNamePaternal: string;
  displayName: string;
  companyRole: string;
  department: string;
  phoneNumber: string;
  irisRole: string;
  accountStatus: string;
}

interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'owner', label: 'Propietario', color: '#8B5CF6' },
  { value: 'admin', label: 'Administrador', color: '#3B82F6' },
  { value: 'manager', label: 'Gerente', color: '#F59E0B' },
  { value: 'leader', label: 'Líder', color: '#10B981' },
  { value: 'member', label: 'Miembro', color: '#00D4B3' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Activo', color: '#10B981' },
  { value: 'inactive', label: 'Inactivo', color: '#64748B' },
  { value: 'suspended', label: 'Suspendido', color: '#F43F5E' },
  { value: 'pending_verification', label: 'Pendiente', color: '#F59E0B' },
];
const ROLE_FILTER_OPTIONS: SelectOption[] = [{ value: 'all', label: 'Todos los roles', color: '#00D4B3' }, ...ROLE_OPTIONS];
const STATUS_FILTER_OPTIONS: SelectOption[] = [{ value: 'all', label: 'Todos los estados', color: '#00D4B3' }, ...STATUS_OPTIONS];

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((role) => [role.value, role.label]));
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((status) => [status.value, status.label]));

function CustomSelect({
  value,
  options,
  onChange,
  label,
  icon,
  dropUp = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label: string;
  icon?: ReactNode;
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`${styles.customSelect} ${open ? styles.customSelectOpen : ''}`} ref={rootRef}>
      <button
        type="button"
        className={styles.selectTrigger}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {icon && <span className={styles.selectLeadIcon}>{icon}</span>}
        {selected?.color && <span className={styles.optionDot} style={{ backgroundColor: selected.color }} />}
        <span className={styles.selectValue}>{selected?.label}</span>
        <ChevronDown size={15} className={styles.selectChevron} />
      </button>
      {open && (
        <div className={`${styles.dropdownMenu} ${dropUp ? styles.dropdownMenuUp : ''}`} role="listbox" aria-label={label}>
          <div className={styles.dropdownCaption}>{label}</div>
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? styles.dropdownOptionActive : styles.dropdownOption}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className={styles.optionDot} style={{ backgroundColor: option.color || 'currentColor' }} />
              <span>{option.label}</span>
              {option.value === value && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModalLayer({
  isDark,
  onClose,
  children,
}: PropsWithChildren<{ isDark: boolean; onClose: () => void }>) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className={styles.modalBackdrop}
      data-theme={isDark ? 'dark' : 'light'}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <span className={`${styles.ambientGlow} ${styles.ambientGlowOne}`} aria-hidden="true" />
      <span className={`${styles.ambientGlow} ${styles.ambientGlowTwo}`} aria-hidden="true" />
      {children}
    </div>,
    document.body,
  );
}

function getInitials(member: Member) {
  const source = member.displayName || `${member.firstName} ${member.lastNamePaternal}`;
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

function createForm(member: Member): MemberForm {
  return {
    firstName: member.firstName || '',
    lastNamePaternal: member.lastNamePaternal || '',
    displayName: member.displayName || '',
    companyRole: member.companyRole || '',
    department: member.department || '',
    phoneNumber: member.phoneNumber || '',
    irisRole: member.irisRole,
    accountStatus: member.accountStatus,
  };
}

function formatLastActivity(value: string | null) {
  if (!value) return 'Sin actividad reciente';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function WorkspaceMembersPage() {
  const { isDark } = useTheme();
  const { workspace, isOwner, isAdmin } = useWorkspace();
  const canEditMembers = isOwner || isAdmin;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [statsMember, setStatsMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!workspace?.slug) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/workspaces/${workspace.slug}/members?includeStats=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los miembros');
      setMembers(data.users || []);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudieron cargar los miembros' });
    } finally {
      setLoading(false);
    }
  }, [workspace?.slug]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (!editMember && !statsMember) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditMember(null);
        setStatsMember(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editMember, statsMember]);

  const openEdit = (member: Member) => {
    setEditMember(member);
    setForm(createForm(member));
  };

  const handleSave = async () => {
    if (!workspace?.slug || !editMember || !form) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/workspaces/${workspace.slug}/members`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: editMember.id, ...form }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el miembro');

      setMembers((current) => current.map((member) => (
        member.id === editMember.id
          ? { ...member, ...form }
          : member
      )));
      setEditMember(null);
      setForm(null);
      setMessage({ type: 'success', text: 'Información del miembro actualizada' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el miembro' });
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch = !normalizedSearch || [
        member.displayName,
        member.email,
        member.department,
        member.companyRole,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      const matchesRole = roleFilter === 'all' || member.irisRole === roleFilter;
      const matchesStatus = statusFilter === 'all' || member.accountStatus === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, roleFilter, search, statusFilter]);

  const summary = useMemo(() => ({
    total: members.length,
    active: members.filter((member) => member.accountStatus === 'active').length,
    admins: members.filter((member) => member.irisRole === 'owner' || member.irisRole === 'admin').length,
    inProjects: members.filter((member) => member.stats?.projectCount > 0).length,
  }), [members]);

  return (
    <div className={styles.page} data-theme={isDark ? 'dark' : 'light'}>
      {message && (
        <div className={`${styles.toast} ${message.type === 'error' ? styles.toastError : ''}`} role="status">
          {message.type === 'success' ? <CheckCircle2 size={17} /> : <X size={17} />}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Cerrar mensaje"><X size={15} /></button>
        </div>
      )}

      <section className={styles.hero} aria-labelledby="members-title">
        <div className={styles.heroArcLarge} aria-hidden="true" />
        <div className={styles.heroArcSmall} aria-hidden="true" />
        <span className={styles.heroDot} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span /> <UsersRound size={13} /> Miembros</div>
          <h1 id="members-title">Personas de {workspace.name}</h1>
          <p>Administra perfiles, responsabilidades y participación en proyectos.</p>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="Resumen de miembros">
        {[
          { label: 'Total de miembros', value: summary.total, icon: UsersRound },
          { label: 'Usuarios activos', value: summary.active, icon: UserCheck },
          { label: 'Administradores', value: summary.admins, icon: ShieldCheck },
          { label: 'En proyectos', value: summary.inProjects, icon: BriefcaseBusiness },
        ].map((item) => (
          <div key={item.label} className={styles.summaryItem}>
            <span className={styles.summaryIcon}><item.icon size={18} /></span>
            <span><small>{item.label}</small><strong>{item.value}</strong></span>
          </div>
        ))}
      </section>

      <section className={styles.filters} aria-label="Filtros de miembros">
        <div className={styles.searchField}>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo, cargo o departamento…"
            aria-label="Buscar miembros"
          />
        </div>
        <CustomSelect
          value={roleFilter}
          options={ROLE_FILTER_OPTIONS}
          onChange={setRoleFilter}
          label="Filtrar por rol"
          icon={<Filter size={15} aria-hidden="true" />}
        />
        <CustomSelect
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={setStatusFilter}
          label="Filtrar por estado"
          icon={<UserCheck size={15} aria-hidden="true" />}
        />
      </section>

      {loading ? (
        <div className={styles.loadingState}><Loader2 size={28} className={styles.spin} /><span>Cargando miembros…</span></div>
      ) : filteredMembers.length === 0 ? (
        <div className={styles.emptyState}><UsersRound size={28} /><h2>No encontramos miembros</h2><p>Prueba con otros filtros o sincroniza nuevamente con SOFIA.</p></div>
      ) : (
        <section className={styles.memberGrid} aria-label="Miembros de la organización">
          {filteredMembers.map((member) => {
            const role = ROLE_OPTIONS.find((option) => option.value === member.irisRole) || ROLE_OPTIONS[4];
            const stats = member.stats || { projectCount: 0, activeProjectCount: 0, averageProgress: 0, tasksAssigned: 0, tasksCompleted: 0, completionRate: 0, projects: [] };
            return (
              <article key={member.id} className={styles.memberCard}>
                <div className={styles.memberHeader}>
                  <div className={styles.avatar}>
                    {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : getInitials(member)}
                    <span className={member.accountStatus === 'active' ? styles.online : styles.offline} aria-hidden="true" />
                  </div>
                  <div className={styles.memberIdentity}>
                    <h2>{member.displayName}</h2>
                    <p><Mail size={12} /> {member.email}</p>
                  </div>
                  <span className={`${styles.statusBadge} ${member.accountStatus !== 'active' ? styles.statusMuted : ''}`}>
                    <CheckCircle2 size={12} /> {STATUS_LABELS[member.accountStatus] || member.accountStatus}
                  </span>
                </div>

                <div className={styles.memberDetails}>
                  <div><span>Rol del workspace</span><strong style={{ color: role.color }}>{ROLE_LABELS[member.irisRole] || member.irisRole}</strong></div>
                  <div><span>Área</span><strong>{member.department || member.companyRole || 'Sin definir'}</strong></div>
                  <div><span>Última actividad</span><strong><Clock3 size={12} /> {formatLastActivity(member.lastActivityAt)}</strong></div>
                </div>

                <div className={styles.memberStats}>
                  <div><BriefcaseBusiness size={15} /><span><strong>{stats.projectCount}</strong> proyectos</span></div>
                  <div><ListChecks size={15} /><span><strong>{stats.tasksCompleted}/{stats.tasksAssigned}</strong> tareas</span></div>
                  <div><BarChart3 size={15} /><span><strong>{stats.averageProgress}%</strong> progreso</span></div>
                </div>

                <div className={styles.cardActions}>
                  <button type="button" className={styles.statsButton} onClick={() => setStatsMember(member)}>
                    <BarChart3 size={16} /> Ver estadísticas
                  </button>
                  {canEditMembers && (
                    <button type="button" className={styles.editButton} onClick={() => openEdit(member)} aria-label={`Editar a ${member.displayName}`}>
                      <PencilLine size={17} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {editMember && form && (
        <ModalLayer isDark={isDark} onClose={() => setEditMember(null)}>
          <section className={`${styles.modal} ${styles.editModal}`} role="dialog" aria-modal="true" aria-labelledby="edit-member-title">
            <header className={styles.modalProfileHeader}>
              <div className={styles.modalAvatar}>
                {editMember.avatarUrl ? <img src={editMember.avatarUrl} alt="" /> : getInitials(editMember)}
                <span aria-hidden="true" />
              </div>
              <div className={styles.modalIdentity}>
                <span className={styles.modalEyebrow}>Perfil de miembro</span>
                <h2 id="edit-member-title">{form.displayName || editMember.displayName}</h2>
                <p><Mail size={14} /> {editMember.email}</p>
                <div className={styles.modalBadges}>
                  <span>{ROLE_LABELS[form.irisRole]}</span>
                  <span className={styles.activeBadge}><i /> {STATUS_LABELS[form.accountStatus]}</span>
                </div>
              </div>
              <div className={styles.modalHeaderRole}><BriefcaseBusiness size={14} /> {form.companyRole || 'Cargo sin definir'}</div>
              <button type="button" className={styles.modalClose} onClick={() => setEditMember(null)} aria-label="Cerrar"><X size={19} /></button>
            </header>

            <div className={styles.modalBody}>
              <div className={styles.editorColumns}>
                <section className={styles.modalPanel}>
                  <div className={styles.panelHeading}>
                    <span><UsersRound size={17} /></span>
                    <div><small>Identidad</small><h3>Información personal</h3></div>
                  </div>
                  <div className={styles.formGrid}>
                    <label><span>Nombre</span><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
                    <label><span>Apellido</span><input value={form.lastNamePaternal} onChange={(event) => setForm({ ...form, lastNamePaternal: event.target.value })} /></label>
                    <label className={styles.fullField}><span>Nombre visible</span><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
                    <label className={styles.fullField}><span>Correo de SOFIA</span><div className={styles.inputWithIcon}><Mail size={15} /><input value={editMember.email} disabled /></div><small>La identidad principal se administra desde SOFIA.</small></label>
                  </div>
                </section>

                <section className={styles.modalPanel}>
                  <div className={styles.panelHeading}>
                    <span><Building2 size={17} /></span>
                    <div><small>Contexto</small><h3>Detalles profesionales</h3></div>
                  </div>
                  <div className={styles.formGrid}>
                    <label><span>Cargo / puesto</span><input value={form.companyRole} onChange={(event) => setForm({ ...form, companyRole: event.target.value })} placeholder="Ej. Product Manager" /></label>
                    <label><span>Departamento</span><input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Ej. Producto" /></label>
                    <label className={styles.fullField}><span>Teléfono</span><div className={styles.inputWithIcon}><Phone size={15} /><input value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="Número de contacto" /></div></label>
                  </div>
                </section>

                <section className={`${styles.modalPanel} ${styles.permissionsPanel}`}>
                  <div className={styles.panelHeading}>
                    <span><ShieldCheck size={17} /></span>
                    <div><small>Permisos</small><h3>Configuración de acceso</h3></div>
                  </div>
                  <div className={styles.permissionGrid}>
                    <div className={styles.formField}>
                      <span>Rol en el workspace</span>
                      <CustomSelect value={form.irisRole} options={ROLE_OPTIONS} onChange={(irisRole) => setForm({ ...form, irisRole })} label="Rol en el workspace" dropUp />
                    </div>
                    <div className={styles.formField}>
                      <span>Estado de la cuenta</span>
                      <CustomSelect value={form.accountStatus} options={STATUS_OPTIONS} onChange={(accountStatus) => setForm({ ...form, accountStatus })} label="Estado de la cuenta" dropUp />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <footer className={styles.modalFooter}>
              <p><CheckCircle2 size={15} /> Los cambios se aplicarán al perfil dentro de Project Hub.</p>
              <div>
                <button type="button" className={styles.secondaryButton} onClick={() => setEditMember(null)}>Cancelar</button>
                <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />}
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </footer>
          </section>
        </ModalLayer>
      )}

      {statsMember && (
        <ModalLayer isDark={isDark} onClose={() => setStatsMember(null)}>
          <section className={`${styles.modal} ${styles.statsModal}`} role="dialog" aria-modal="true" aria-labelledby="member-stats-title">
            <header className={styles.modalProfileHeader}>
              <div className={styles.modalAvatar}>
                {statsMember.avatarUrl ? <img src={statsMember.avatarUrl} alt="" /> : getInitials(statsMember)}
                <span aria-hidden="true" />
              </div>
              <div className={styles.modalIdentity}>
                <span className={styles.modalEyebrow}>Analítica de miembro</span>
                <h2 id="member-stats-title">{statsMember.displayName}</h2>
                <p><Mail size={14} /> {statsMember.email}</p>
                <div className={styles.modalBadges}>
                  <span>{ROLE_LABELS[statsMember.irisRole]}</span>
                  <span className={styles.activeBadge}><i /> {STATUS_LABELS[statsMember.accountStatus]}</span>
                </div>
              </div>
              <div className={styles.modalHeaderRole}><BarChart3 size={14} /> Rendimiento en proyectos</div>
              <button type="button" className={styles.modalClose} onClick={() => setStatsMember(null)} aria-label="Cerrar"><X size={19} /></button>
            </header>

            <div className={`${styles.modalBody} ${styles.statsModalBody}`}>
              <div className={styles.statsOverview}>
                <div><BriefcaseBusiness size={18} /><span>Proyectos</span><strong>{statsMember.stats.projectCount}</strong><small>{statsMember.stats.activeProjectCount} activos</small></div>
                <div><BarChart3 size={18} /><span>Progreso medio</span><strong>{statsMember.stats.averageProgress}%</strong><small>Avance general</small></div>
                <div><ListChecks size={18} /><span>Tareas completadas</span><strong>{statsMember.stats.tasksCompleted}</strong><small>de {statsMember.stats.tasksAssigned} asignadas</small></div>
                <div><CheckCircle2 size={18} /><span>Tasa de cierre</span><strong>{statsMember.stats.completionRate}%</strong><small>Efectividad</small></div>
              </div>

              <section className={styles.modalPanel}>
                <div className={styles.projectsHeading}>
                  <div className={styles.panelHeading}><span><BriefcaseBusiness size={17} /></span><div><small>Participación</small><h3>Proyectos asignados</h3></div></div>
                  <span>{statsMember.stats.projects.length} en total</span>
                </div>
                {statsMember.stats.projects.length === 0 ? (
                  <div className={styles.projectEmpty}><BriefcaseBusiness size={22} /><p>Este miembro todavía no está asignado a proyectos.</p></div>
                ) : (
                  <div className={styles.projectList}>
                    {statsMember.stats.projects.map((project) => (
                      <article key={project.id} className={styles.projectRow}>
                        <span className={styles.projectMark} style={{ backgroundColor: project.color }}>{project.key?.slice(0, 2) || 'PR'}</span>
                        <div className={styles.projectMain}>
                          <div><strong>{project.name}</strong><span>{project.role} · {project.tasksCompleted}/{project.tasksAssigned} tareas</span></div>
                          <div className={styles.progressTrack}><span style={{ width: `${project.progress}%` }} /></div>
                        </div>
                        <strong className={styles.progressValue}>{project.progress}%</strong>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <footer className={styles.modalFooter}>
              <p><BarChart3 size={15} /> Datos calculados desde proyectos y tareas del workspace.</p>
              <div><button type="button" className={styles.secondaryButton} onClick={() => setStatsMember(null)}>Cerrar panel</button></div>
            </footer>
          </section>
        </ModalLayer>
      )}
    </div>
  );
}
