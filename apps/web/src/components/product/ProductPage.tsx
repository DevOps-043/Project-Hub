import type { CSSProperties, ComponentType, ReactNode } from 'react';
import styles from './ProductPage.module.css';

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;

interface ProductPageProps {
  children: ReactNode;
  className?: string;
}

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: IconComponent;
  actions?: ReactNode;
}

interface PageSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}

interface SurfaceProps {
  children: ReactNode;
  padded?: boolean;
  className?: string;
}

export interface ProductMetric {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: IconComponent;
  tone?: 'accent' | 'success' | 'warning' | 'error' | 'info';
}

interface MetricStripProps {
  metrics: ProductMetric[];
  ariaLabel?: string;
}

interface EmptyStateProps {
  icon: IconComponent;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

const metricTones: Record<NonNullable<ProductMetric['tone']>, string> = {
  accent: 'var(--accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  info: 'var(--color-info, #3b82f6)',
};

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export function ProductPage({ children, className }: ProductPageProps) {
  return <div className={joinClasses(styles.page, className)}>{children}</div>;
}

export function PageHero({ eyebrow, title, description, icon: Icon, actions }: PageHeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="product-page-title">
      <span className={styles.heroDot} aria-hidden="true" />
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}>
          {Icon ? <Icon size={13} strokeWidth={1.8} aria-hidden={true} /> : null}
          <span>{eyebrow}</span>
        </div>
        <h1 id="product-page-title" className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.heroActions}>{actions}</div> : null}
    </section>
  );
}

export function PageSection({ title, description, actions, children, className, labelledBy }: PageSectionProps) {
  const headingId = labelledBy || (title ? `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);
  return (
    <section className={joinClasses(styles.section, className)} aria-labelledby={headingId}>
      {title || description || actions ? (
        <div className={styles.sectionHeading}>
          <div>
            {title ? <h2 id={headingId} className={styles.sectionTitle}>{title}</h2> : null}
            {description ? <p className={styles.sectionDescription}>{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ProductSurface({ children, padded = false, className }: SurfaceProps) {
  return <div className={joinClasses(styles.surface, padded && styles.surfacePadded, className)}>{children}</div>;
}

export function MetricStrip({ metrics, ariaLabel = 'Métricas principales' }: MetricStripProps) {
  const gridStyle = { '--metric-columns': Math.min(metrics.length, 6) } as CSSProperties;
  return (
    <div className={styles.metrics} style={gridStyle} aria-label={ariaLabel}>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const tone = metricTones[metric.tone || 'accent'];
        return (
          <div
            key={metric.label}
            className={styles.metric}
            style={{ '--metric-tone': tone } as CSSProperties}
          >
            <span className={styles.metricIcon}>
              <Icon size={18} strokeWidth={1.8} aria-hidden={true} />
            </span>
            <span className={styles.metricCopy}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <span className={styles.metricValue}>{metric.value}</span>
              {metric.hint ? <span className={styles.metricHint}>{metric.hint}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CollectionToolbar({ children }: { children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}

export function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className={styles.toolbarGroup}>{children}</div>;
}

export const productControlClass = styles.control;
export const productPrimaryControlClass = styles.primaryControl;
export const productIconControlClass = styles.iconControl;
export const productInputWrapClass = styles.inputWrap;
export const productInputIconClass = styles.inputIcon;
export const productInputClass = styles.input;

export function EmptyState({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={joinClasses(styles.empty, compact && styles.emptyCompact)}>
      <div className={styles.emptyContent}>
        <span className={styles.emptyIcon}><Icon size={25} strokeWidth={1.65} aria-hidden={true} /></span>
        <h3 className={styles.emptyTitle}>{title}</h3>
        <p className={styles.emptyDescription}>{description}</p>
        {action}
      </div>
    </div>
  );
}

export function LoadingState({ label = 'Preparando la información…' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.loadingContent}>
        <span className={styles.loadingMark} aria-hidden="true" />
        <span className={styles.loadingLabel}>{label}</span>
      </div>
    </div>
  );
}
