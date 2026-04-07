"use client";

import styles from './map.module.css';

// ── Types ─────────────────────────────────────────────────────
export type Severity = 'critical' | 'warning' | 'info';

export interface Notif {
  id: string;
  severity: Severity;
  title: string;
  desc: string;
  ts: Date | string;
  seen: boolean;
}

// ── Config ────────────────────────────────────────────────────
export const SEV: Record<Severity, { bg: string; border: string; color: string; dot: string; label: string }> = {
  critical: { bg: '#fff1f2', border: '#fecaca', color: '#ef4444', dot: '#ef4444', label: 'Kritis'  },
  warning:  { bg: '#fffbeb', border: '#fde68a', color: '#d97706', dot: '#f59e0b', label: 'Warning' },
  info:     { bg: '#f0f9ff', border: '#bae6fd', color: '#0284c7', dot: '#38bdf8', label: 'Info'    },
};

// ── Helpers ───────────────────────────────────────────────────
function logTimestamp(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  const h   = pad(date.getHours());
  const m   = pad(date.getMinutes());
  const s   = pad(date.getSeconds());
  const dd  = pad(date.getDate());
  const mo  = pad(date.getMonth() + 1);
  const yy  = date.getFullYear();
  return `${dd}/${mo}/${yy} ${h}:${m}:${s}`;
}

// ── Component ─────────────────────────────────────────────────
interface Props {
  notifs: Notif[];
  onClear: (id: string) => void;
  onMarkAll: () => void;
}

export default function NotifPanel({ notifs, onClear, onMarkAll }: Props) {
  const unseen = notifs.filter(n => !n.seen).length;

  return (
    <div className={styles.panel}>

      {/* Header */}
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.panelIcon}>🔔</span>
          <span className={styles.panelTitleText}>Event Log</span>
          {unseen > 0 && <span className={styles.unseenBadge}>{unseen}</span>}
        </div>
        <button className={styles.markAllBtn} onClick={onMarkAll}>
          Tandai semua dibaca
        </button>
      </div>

      {/* Summary pills */}
      <div className={styles.panelSummary}>
        {(['critical', 'warning', 'info'] as Severity[]).map(s => {
          const count = notifs.filter(n => n.severity === s).length;
          if (!count) return null;
          const c = SEV[s];
          return (
            <span key={s} className={styles.summaryPill}
              style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
              {count} {c.label}
            </span>
          );
        })}
        {notifs.length === 0 && <span className={styles.summaryEmpty}>Tidak ada event</span>}
      </div>

      {/* List */}
      <div className={styles.panelList}>
        {notifs.length === 0 ? (
          <div className={styles.panelEmpty}>
            <div className={styles.panelEmptyIcon}>✅</div>
            <div>Semua normal</div>
          </div>
        ) : notifs.map(n => {
          const c = SEV[n.severity];
          return (
            <div key={n.id} className={styles.notifItem}
              style={{ background: n.seen ? 'transparent' : c.bg }}>
              <span className={styles.notifDot}
                style={{ background: n.seen ? '#d1d5db' : c.dot }} />
              <div className={styles.notifContent}>
                <div className={styles.notifTop}>
                  <span className={styles.notifTitle}
                    style={{ color: n.seen ? '#6b7280' : '#111827' }}>
                    {n.title}
                  </span>
                  <span className={styles.notifBadge}
                    style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                    {c.label}
                  </span>
                </div>
                <div className={styles.notifDesc}>{n.desc}</div>
                <div className={styles.notifTime}>
                  {logTimestamp(n.ts)}
                </div>
              </div>
              <button className={styles.notifDismiss} onClick={() => onClear(n.id)}>×</button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {notifs.length > 0 && (
        <div className={styles.panelFooter}>
          <button className={styles.clearAllBtn}
            onClick={() => notifs.forEach(n => onClear(n.id))}>
            Bersihkan semua
          </button>
        </div>
      )}
    </div>
  );
}