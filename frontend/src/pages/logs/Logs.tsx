import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import {
  fetchLogs, resolveLogById, deleteLog, clearResolvedLogs,
  LogEntry, LogSeverity, LogSource,
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
  const [resolved, setResolved] = useState('');
  const [search,   setSearch]   = useState('');

  const refresh = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (severity) params.severity = severity;
      if (source)   params.source   = source;
      if (resolved) params.resolved = resolved;
      const data = await fetchLogs(params as any);
      setLogs(data);
    } catch (e) {
      console.error('Gagal fetch logs:', e);
    } finally {
      setLoading(false);
    }
  }, [severity, source, resolved]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleResolve = async (id: number) => {
    await resolveLogById(id);
    refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteLog(id);
    refresh();
  };

  const handleClearResolved = async () => {
    await clearResolvedLogs();
    refresh();
  };

  // Filter search di client side
  const filtered = logs.filter(l =>
    !search ||
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.message.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const activeCount   = logs.filter(l => !l.resolved).length;
  const criticalCount = logs.filter(l => !l.resolved && l.severity === 'critical').length;
  const resolvedCount = logs.filter(l => l.resolved).length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📋</div>
          <div>
            <div className={styles.headerTitle}>Event Logs</div>
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
          <div className={styles.statLabel}>Aktif</div>
          <div className={`${styles.statValue} ${styles.red}`}>{activeCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Kritis Aktif</div>
          <div className={`${styles.statValue} ${styles.red}`}>{criticalCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Resolved</div>
          <div className={`${styles.statValue} ${styles.green}`}>{resolvedCount}</div>
        </div>
      </div>

      {/* Filter */}
      <LogFilterBar
        severity={severity} source={source} resolved={resolved} search={search}
        onSeverity={setSeverity} onSource={setSource}
        onResolved={setResolved} onSearch={setSearch}
        onClearResolved={handleClearResolved}
        totalCount={filtered.length}
      />

      {/* Table */}
      {loading ? (
        <div className={styles.loading}>Memuat log...</div>
      ) : (
        <LogTable logs={filtered} onResolve={handleResolve} onDelete={handleDelete} />
      )}
    </div>
  );
}