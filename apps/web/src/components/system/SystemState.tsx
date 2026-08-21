'use client';

import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import styles from './SystemState.module.css';

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;

export function SystemState({ icon: Icon, eyebrow, title, description, action, loading = false }: { icon?: IconComponent; eyebrow: string; title: string; description: string; action?: ReactNode; loading?: boolean }) {
  return <main className={styles.page}><div className={styles.ambient} aria-hidden="true" /><section className={styles.card} role={loading ? 'status' : undefined}><div className={styles.brand}><span className={styles.brandMark}>S</span><span><strong>Project Hub</strong><small>by SofLIA</small></span></div><div className={styles.icon} data-loading={loading}>{loading ? <i aria-hidden /> : Icon ? <Icon size={27} strokeWidth={1.6} aria-hidden /> : null}</div><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p>{description}</p>{action ? <div className={styles.actions}>{action}</div> : null}</section></main>;
}

export function RetryButton({ onClick }: { onClick: () => void }) { return <button type="button" className={styles.primary} onClick={onClick}><RefreshCw size={15} aria-hidden /> Intentar de nuevo</button>; }
export function HomeLink() { return <Link className={styles.primary} href="/">Ir al inicio</Link>; }
export function BackButton() { return <button type="button" className={styles.secondary} onClick={() => window.history.back()}><ArrowLeft size={15} aria-hidden /> Volver</button>; }
