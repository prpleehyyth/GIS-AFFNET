import styles from './dashboard.module.css';

// ── Types ─────────────────────────────────────────────────────
export interface Onu   { rx_power: string; odp_id?: number | null; }
export interface Odp   { id: number; total_port: number; type?: string; odc_id?: number | null; }
export interface Infra { name: string; interfaces?: { type: string; available: string; }[]; }

// ── Mini progress bar ─────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className={styles.miniTrack}>
      <div className={styles.miniFill} style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  );
}

// ── CoreStatusCard ────────────────────────────────────────────
interface CoreProps { isOltDown: boolean; isMikrotikDown: boolean; infraUnreachable?: boolean; }
export function CoreStatusCard({ isOltDown, isMikrotikDown, infraUnreachable }: CoreProps) {
  const isDegraded = infraUnreachable || isOltDown || isMikrotikDown;

  return (
    <div className={`${styles.card} ${isDegraded ? styles.cardAlert : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <span className={styles.cardIcon}>📡</span>
          <span className={styles.cardLabel}>Core Network</span>
        </div>
        <span className={isDegraded ? styles.badgeDanger : styles.badgeSuccess}>
          {infraUnreachable ? 'Tidak Terjangkau' : isDegraded ? 'Terganggu' : 'Nominal'}
        </span>
      </div>

      {infraUnreachable ? (
        <div className={styles.infraError}>
          <div className={styles.infraErrorIcon}>⚠️</div>
          <div className={styles.infraErrorText}>Tidak dapat terhubung ke server monitoring</div>
          <div className={styles.infraErrorSub}>Status perangkat tidak diketahui — asumsikan Down</div>
        </div>
      ) : (
        <div className={styles.deviceList}>
          {[
            { name: 'OLT HIOSO', sub: 'Optical Line Terminal', down: isOltDown },
            { name: 'Router MikroTik', sub: 'Core Router', down: isMikrotikDown },
          ].map(dev => (
            <div key={dev.name} className={styles.deviceRow}>
              <div className={styles.deviceLeft}>
                <span className={dev.down ? styles.dotDanger : styles.dotSuccess} />
                <div>
                  <div className={styles.deviceName}>{dev.name}</div>
                  <div className={styles.deviceSub}>{dev.sub}</div>
                </div>
              </div>
              <span className={dev.down ? styles.statusDown : styles.statusUp}>
                {dev.down ? '↓ Down' : '↑ Up'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.footerHint}>
          {infraUnreachable
            ? '🔴 Server monitoring tidak merespons'
            : isDegraded
            ? '⚠️ Periksa koneksi backbone segera'
            : '✓ Semua perangkat inti beroperasi normal'}
        </span>
      </div>
    </div>
  );
}

// ── OdcStatusCard ─────────────────────────────────────────────
interface OdcProps { totalOdc: number; fullOdcs: number; avgOdcUsage: number; }
export function OdcStatusCard({ totalOdc, fullOdcs, avgOdcUsage }: OdcProps) {
  const barColor = avgOdcUsage >= 80 ? 'var(--red)' : avgOdcUsage >= 60 ? 'var(--amber)' : '#7c3aed';
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <span className={styles.cardIcon}>🗄️</span>
          <span className={styles.cardLabel}>Distribusi ODC</span>
        </div>
        <span className={styles.badgePurple}>{totalOdc} Titik</span>
      </div>

      <div className={styles.bigStat}>
        <span className={styles.bigNumber} style={{ color: barColor }}>{Math.round(avgOdcUsage)}</span>
        <span className={styles.bigUnit}>%</span>
      </div>
      <p className={styles.bigSubtext}>rata-rata kapasitas terpakai</p>

      <MiniBar pct={avgOdcUsage} color={barColor} />

      <div className={styles.statRow}>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Total ODC</span>
          <span className={styles.statItemValue}>{totalOdc}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Kapasitas &gt;80%</span>
          <span className={`${styles.statItemValue} ${fullOdcs > 0 ? styles.red : styles.green}`}>{fullOdcs}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Normal</span>
          <span className={`${styles.statItemValue} ${styles.green}`}>{totalOdc - fullOdcs}</span>
        </div>
      </div>
    </div>
  );
}

// ── OdpCapacityCard ───────────────────────────────────────────
interface OdpProps { totalOdp: number; totalPorts: number; usedPorts: number; freePorts: number; usagePercent: number; }
export function OdpCapacityCard({ totalOdp, totalPorts, usedPorts, freePorts, usagePercent }: OdpProps) {
  const barColor = usagePercent >= 90 ? 'var(--red)' : usagePercent >= 70 ? 'var(--amber)' : '#7c3aed';
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <span className={styles.cardIcon}>🔌</span>
          <span className={styles.cardLabel}>Distribusi ODP</span>
        </div>
        <span className={styles.badgePurple}>{totalOdp} Titik</span>
      </div>

      <div className={styles.bigStat}>
        <span className={styles.bigNumber} style={{ color: barColor }}>{usagePercent}</span>
        <span className={styles.bigUnit}>%</span>
      </div>
      <p className={styles.bigSubtext}>kapasitas port terpakai</p>

      <MiniBar pct={usagePercent} color={barColor} />

      <div className={styles.statRow}>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Total Port</span>
          <span className={styles.statItemValue}>{totalPorts}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Terpakai</span>
          <span className={styles.statItemValue}>{usedPorts}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Tersisa</span>
          <span className={`${styles.statItemValue} ${styles.green}`}>{freePorts}</span>
        </div>
      </div>
    </div>
  );
}

// ── OnuHealthCard ─────────────────────────────────────────────
interface OnuHealthProps { totalOnu: number; safeOnu: number; warningOnu: number; criticalOnu: number; }
export function OnuHealthCard({ totalOnu, safeOnu, warningOnu, criticalOnu }: OnuHealthProps) {
  const pct = (n: number) => totalOnu ? (n / totalOnu) * 100 : 0;
  const hasCritical = criticalOnu > 0;

  return (
    <div className={`${styles.card} ${hasCritical ? styles.cardAlert : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <span className={styles.cardIcon}>🏠</span>
          <span className={styles.cardLabel}>Kesehatan ONU</span>
        </div>
        <span className={hasCritical ? styles.badgeDanger : styles.badgeSuccess}>
          {totalOnu} User
        </span>
      </div>

      {/* Donut-style summary */}
      <div className={styles.onuSummary}>
        <div className={styles.onuBigNum}>
          <span className={styles.bigNumber} style={{ color: hasCritical ? 'var(--red)' : 'var(--green)' }}>
            {criticalOnu > 0 ? criticalOnu : safeOnu}
          </span>
          <span className={styles.onuBigLabel}>
            {criticalOnu > 0 ? 'kritis' : 'aman'}
          </span>
        </div>
        <div className={styles.onuBarList}>
          {[
            { label: 'Aman', count: safeOnu, color: 'var(--green)', pct: pct(safeOnu) },
            { label: 'Warning', count: warningOnu, color: 'var(--amber)', pct: pct(warningOnu) },
            { label: 'Kritis', count: criticalOnu, color: 'var(--red)', pct: pct(criticalOnu) },
          ].map(row => (
            <div key={row.label} className={styles.onuBarRow}>
              <span className={styles.onuBarLabel}>{row.label}</span>
              <div className={styles.miniTrack} style={{ flex: 1 }}>
                <div className={styles.miniFill} style={{ width: `${row.pct}%`, background: row.color }} />
              </div>
              <span className={styles.onuBarCount} style={{ color: row.color }}>{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.dBmHint}>
        <span>{'> −25 dBm'}</span>
        <span>−25 s/d −27</span>
        <span>{'< −27 dBm'}</span>
      </div>
    </div>
  );
}

// ── LoadingScreen ─────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div className={styles.loadingWrapper}>
      <div className={styles.loadingDot} />
      <span className={styles.loadingText}>Memuat data…</span>
    </div>
  );
}