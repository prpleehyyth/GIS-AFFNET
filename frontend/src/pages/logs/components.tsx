"use client";

import { LogEntry, LogSeverity, LogSource } from '@/lib/logService';
import styles from './logs.module.css';

// ── SEV config ────────────────────────────────────────────────
export const SEV: Record<LogSeverity, { bg: string; border: string; color: string; label: string }> = {
  critical: { bg: '#fff1f2', border: '#fecaca', color: '#ef4444', label: 'Kritis'  },
  warning:  { bg: '#fffbeb', border: '#fde68a', color: '#d97706', label: 'Warning' },
  info:     { bg: '#f0f9ff', border: '#bae6fd', color: '#0284c7', label: 'Info'    },
};

export const SRC: Record<LogSource, { emoji: string; color: string }> = {
  ONU:    { emoji: '🏠', color: '#16a34a' },
  ODP:    { emoji: '🔌', color: '#d97706' },
  Infra:  { emoji: '📡', color: '#6366f1' },
  System: { emoji: '⚙️', color: '#6b7280' },
};

// ── Timestamp ─────────────────────────────────────────────────
export function logTimestamp(d: string): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ── Filter bar ────────────────────────────────────────────────
interface FilterProps {
  severity: string;
  source: string;
  search: string;
  onSeverity: (v: string) => void;
  onSource:   (v: string) => void;
  onSearch:   (v: string) => void;
  totalCount: number;
}

export function LogFilterBar({
  severity, source, search,
  onSeverity, onSource, onSearch,
  totalCount,
}: FilterProps) {
  return (
    <div className={styles.filterWrap}>
      <div className={styles.filterLeft}>
        {/* Severity */}
        {(['', 'critical', 'warning', 'info'] as const).map(s => (
          <button key={s}
            className={`${styles.filterBtn} ${severity === s ? styles.filterBtnActive : ''}`}
            style={severity === s && s ? { background: SEV[s as LogSeverity].bg, color: SEV[s as LogSeverity].color, borderColor: SEV[s as LogSeverity].border } : undefined}
            onClick={() => onSeverity(s)}
          >
            {s === '' ? 'Semua' : SEV[s as LogSeverity].label}
          </button>
        ))}

        <div className={styles.filterDivider} />

        {/* Source */}
        {(['', 'ONU', 'ODP', 'Infra', 'System'] as const).map(s => (
          <button key={s}
            className={`${styles.filterBtn} ${source === s ? styles.filterBtnActive : ''}`}
            onClick={() => onSource(s)}
          >
            {s === '' ? 'Semua Sumber' : `${SRC[s as LogSource].emoji} ${s}`}
          </button>
        ))}
      </div>

      <div className={styles.filterRight}>
        <input
          className={styles.searchInput}
          placeholder="Cari log..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Log table ─────────────────────────────────────────────────
interface TableProps {
  logs: LogEntry[];
}

export function LogTable({ logs }: TableProps) {
  if (logs.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📋</div>
        <div>Tidak ada log yang sesuai filter</div>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Severity</th>
            <th>Sumber</th>
            <th>Judul</th>
            <th>Pesan</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const sev = SEV[log.severity];
            const src = SRC[log.source];
            // Do not show resolve button if it's already resolved or it's an info event
            const showResolve = !log.resolved && !log.title.startsWith('Resolved:');

            return (
              <tr key={log.id}>
                <td>
                  <span className={styles.timestamp}>{logTimestamp(log.created_at)}</span>
                </td>
                <td>
                  <span className={styles.sevBadge}
                    style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                    {sev.label}
                  </span>
                </td>
                <td>
                  <span className={styles.srcBadge} style={{ color: src.color }}>
                    {src.emoji} {log.source}
                  </span>
                </td>
                <td><span className={styles.logTitle}>{log.title}</span></td>
                <td><span className={styles.logMsg}>{log.message}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}