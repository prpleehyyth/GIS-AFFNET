import styles from './dashboard.module.css';

// ── Types ────────────────────────────────────────────────────
export interface Onu   { rx_power: string; odp_id?: number | null; }
export interface Odp   { total_port: number; }
export interface Infra { name: string; interfaces?: { type: string; available: string; }[]; }

// ── CoreStatusCard ───────────────────────────────────────────
interface CoreProps {
  isOltDown: boolean;
  isMikrotikDown: boolean;
}
export function CoreStatusCard({ isOltDown, isMikrotikDown }: CoreProps) {
  const isDegraded = isOltDown || isMikrotikDown;
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardLabel}>Core Network</span>
        <span className={isDegraded ? styles.badgeDanger : styles.badgeSuccess}>
          {isDegraded ? 'Terganggu' : 'Nominal'}
        </span>
      </div>

      <div className={styles.deviceRow}>
        <div className={styles.deviceInfo}>
          <span className={isOltDown ? styles.dotDanger : styles.dotSuccess} />
          <span className={styles.deviceName}>OLT HIOSO</span>
        </div>
        <span className={isOltDown ? styles.statusDown : styles.statusUp}>
          {isOltDown ? 'Down' : 'Up'}
        </span>
      </div>

      <div className={`${styles.deviceRow} ${styles.deviceRowLast}`}>
        <div className={styles.deviceInfo}>
          <span className={isMikrotikDown ? styles.dotDanger : styles.dotSuccess} />
          <span className={styles.deviceName}>Router MikroTik</span>
        </div>
        <span className={isMikrotikDown ? styles.statusDown : styles.statusUp}>
          {isMikrotikDown ? 'Down' : 'Up'}
        </span>
      </div>
    </div>
  );
}

// ── OdpCapacityCard ──────────────────────────────────────────
interface OdpProps {
  totalOdp: number;
  totalPorts: number;
  usedPorts: number;
  freePorts: number;
  usagePercent: number;
}
export function OdpCapacityCard({ totalOdp, totalPorts, usedPorts, freePorts, usagePercent }: OdpProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardLabel}>Distribusi ODP</span>
        <span className={styles.badgePurple}>{totalOdp} Titik</span>
      </div>

      <div className={styles.bigStat}>
        <span className={styles.bigNumber}>{usagePercent}</span>
        <span className={styles.bigUnit}>%</span>
      </div>
      <p className={styles.bigSubtext}>kapasitas terpakai</p>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${usagePercent}%` }} />
      </div>

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

// ── OnuHealthCard ────────────────────────────────────────────
interface OnuHealthProps {
  totalOnu: number;
  safeOnu: number;
  warningOnu: number;
  criticalOnu: number;
}
export function OnuHealthCard({ totalOnu, safeOnu, warningOnu, criticalOnu }: OnuHealthProps) {
  const pct = (n: number) => totalOnu ? (n / totalOnu) * 100 : 0;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardLabel}>Kesehatan ONU</span>
        <span className={styles.badgeBlue}>{totalOnu} User</span>
      </div>

      <div className={styles.healthList}>
        <div className={styles.healthRow}>
          <div className={styles.healthTrack}>
            <span className={styles.healthBarSafe} style={{ width: `${pct(safeOnu)}%` }} />
          </div>
          <span className={styles.healthLabel}>Aman</span>
          <span className={styles.healthCount}>{safeOnu}</span>
        </div>

        <div className={styles.healthRow}>
          <div className={styles.healthTrack}>
            <span className={styles.healthBarWarning} style={{ width: `${pct(warningOnu)}%` }} />
          </div>
          <span className={styles.healthLabel}>Warning</span>
          <span className={styles.healthCount}>{warningOnu}</span>
        </div>

        <div className={styles.healthRow}>
          <div className={styles.healthTrack}>
            <span className={styles.healthBarCritical} style={{ width: `${pct(criticalOnu)}%` }} />
          </div>
          <span className={`${styles.healthLabel} ${criticalOnu > 0 ? styles.criticalLabel : ''}`}>
            Kritis
          </span>
          <span className={`${styles.healthCount} ${criticalOnu > 0 ? styles.criticalCount : ''}`}>
            {criticalOnu}
          </span>
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

// ── LoadingScreen ────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div className={styles.loadingWrapper}>
      <div className={styles.loadingDot} />
      <span className={styles.loadingText}>Memuat data…</span>
    </div>
  );
}