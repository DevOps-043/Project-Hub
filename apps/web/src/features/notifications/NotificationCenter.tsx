'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, Check, CircleAlert, Info, X } from 'lucide-react';
import { useAuthStore } from '@/core/stores/authStore';
import { api } from '@/lib/api/client';
import styles from './NotificationCenter.module.css';

interface Notification {
  notification_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  is_read: boolean;
  created_at: string;
  link?: string;
}

const typeIcons = {
  info: Info,
  success: Check,
  warning: AlertTriangle,
  error: CircleAlert,
};

const tokenNames = [
  '--org-primary-color',
  '--org-accent-color',
  '--org-action-color',
  '--org-on-action-color',
] as const;

export function NotificationCenter() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await api.get<Notification[]>(`/api/notifications?userId=${userId}&limit=20`);
      if (!response.error && response.data) setNotifications(response.data);
    } catch {
      // Notifications are secondary and must not interrupt the workspace.
    }
  }, [userId]);

  useEffect(() => {
    setMounted(true);
    fetchNotifications();
    if (!userId) return;
    const intervalId = window.setInterval(fetchNotifications, 30_000);
    return () => window.clearInterval(intervalId);
  }, [fetchNotifications, userId]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const shell = trigger.closest<HTMLElement>('[data-sofia-shell="true"]');
    const computed = window.getComputedStyle(shell || document.documentElement);
    const copiedTokens = Object.fromEntries(tokenNames.map((token) => [token, computed.getPropertyValue(token).trim()]));
    setPanelStyle({
      ...copiedTokens,
      top: `${Math.min(rect.bottom + 9, window.innerHeight - 120)}px`,
      right: `${Math.max(12, window.innerWidth - rect.right)}px`,
    } as CSSProperties);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePanelPosition();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const update = () => updatePanelPosition();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('keydown', closeOnEscape);
    window.requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, updatePanelPosition]);

  const markAsRead = async (notification: Notification) => {
    if (!notification.is_read) {
      setNotifications((current) => current.map((item) => item.notification_id === notification.notification_id ? { ...item, is_read: true } : item));
      await api.patch(`/api/notifications/${notification.notification_id}/read`);
    }
    if (notification.link) {
      setIsOpen(false);
      router.push(notification.link);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((notification) => !notification.is_read);
    if (!unread.length) return;
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    await Promise.allSettled(unread.map((notification) => api.patch(`/api/notifications/${notification.notification_id}/read`)));
  };

  const portal = isOpen && mounted ? createPortal(
    <>
      <button className={styles.backdrop} type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar notificaciones" />
      <div
        ref={panelRef}
        id="project-hub-notifications"
        className={styles.panel}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-title"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Actividad</p>
            <h2 id="notifications-title">Notificaciones</h2>
          </div>
          <div className={styles.headerActions}>
            {unreadCount ? (
              <button type="button" className={styles.markAll} onClick={markAllAsRead}>Marcar leídas</button>
            ) : null}
            <button type="button" className={styles.iconButton} onClick={() => setIsOpen(false)} aria-label="Cerrar notificaciones">
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={styles.list}>
          {notifications.length ? notifications.map((notification) => {
            const TypeIcon = typeIcons[notification.type] || Info;
            return (
              <button
                key={notification.notification_id}
                type="button"
                className={styles.notification}
                data-read={notification.is_read ? 'true' : 'false'}
                data-tone={notification.type}
                onClick={() => markAsRead(notification)}
              >
                <span className={styles.typeIcon}><TypeIcon size={16} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className={styles.copy}>
                  <strong>{notification.title}</strong>
                  {notification.message ? <span>{notification.message}</span> : null}
                  <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>
                </span>
                {!notification.is_read ? <span className={styles.unreadDot} aria-label="No leída" /> : null}
              </button>
            );
          }) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}><Bell size={23} strokeWidth={1.6} aria-hidden="true" /></span>
              <strong>Todo está al día</strong>
              <p>Las actualizaciones de proyectos, equipos y tareas aparecerán aquí.</p>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((current) => !current)}
        aria-label={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        aria-expanded={isOpen}
        aria-controls="project-hub-notifications"
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
        {unreadCount ? <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </button>
      {portal}
    </>
  );
}
