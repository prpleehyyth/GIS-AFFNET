import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import {
  fetchLogs,
  LogEntry
} from '@/lib/logService';
import { LogFilterBar, LogTable } from './components';
import styles from './logs.module.css';

export default function LogsPage() {

  useEffect(() => {
    document.title = "Logs | AFF NET GIS";
  }, []);

  const [logs,     setLogs]     = useState<LogEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [severity, setSeverity] = useState('');
  const [source,   setSource]   = useState('');
  const [search,   setSearch]   = useState('');

  const refresh = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (severity) params.severity = severity;
      if (source)   params.source   = source;
      // We don't fetch by 'resolved' anymore for the simple viewer
      const data = await fetchLogs(params as any);
      setLogs(data);
    } catch (e) {
      console.error('Gagal fetch logs:', e);
    } finally {
      setLoading(false);
    }
  }, [severity, source]);

  useEffect(() => { refresh(); }, [refresh]);



  // Filter search di client side
  const filtered = logs.filter(l =>
    !search ||
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.message.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const criticalCount = logs.filter(l => l.severity === 'critical').length;
  const warningCount  = logs.filter(l => l.severity === 'warning').length;
  const infoCount     = logs.filter(l => l.severity === 'info').length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📋</div>
          <div>
            <div className={styles.headerTitle}>System Logs</div>
            <div className={styles.headerSub}>Riwayat kejadian jaringan dari semua sumber</div>
          </div>
        </div>
        <Link to="/" className={styles.backBtn}>← Kembali ke Dashboard</Link>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Log</div>
          <div className={styles.statValue}>{logs.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Kritis</div>
          <div className={`${styles.statValue} ${styles.red}`}>{criticalCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Warning</div>
          <div className={`${styles.statValue} ${styles.orange}`}>{warningCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Info</div>
          <div className={`${styles.statValue} ${styles.blue}`}>{infoCount}</div>
        </div>
      </div>

      {/* Filter */}
      <LogFilterBar
        severity={severity} source={source} search={search}
        onSeverity={setSeverity} onSource={setSource}
        onSearch={setSearch}
        totalCount={filtered.length}
      />

      {/* Table */}
      {loading ? (
        <div className={styles.loading}>Memuat log...</div>
      ) : (
        <LogTable logs={filtered} />
      )}
    </div>
  );
}