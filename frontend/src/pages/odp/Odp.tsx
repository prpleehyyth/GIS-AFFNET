import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Odp, OdpForm, OdpTable, OdpModal, DeleteConfirmModal } from './components';
import { writeLog } from '@/lib/logService';
import styles from './odp.module.css';

const BASE_URL = 'http://localhost:8888/api/odp';
const EMPTY: OdpForm = { name: '', type: 'ODP', latitude: '', longitude: '', total_port: 8, odc_id: null };

export default function OdpPage() {
  const [odps,            setOdps]            = useState<Odp[]>([]);
  const [form,            setForm]            = useState<OdpForm>(EMPTY);
  const [editId,          setEditId]          = useState<number | null>(null);
  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isLoading,       setIsLoading]       = useState(false);
  const [filterType,      setFilterType]      = useState<'ALL' | 'ODP' | 'ODC'>('ALL');

  useEffect(() => {
    document.title = "ODC & ODP | AFF NET GIS";
  }, []);

  const refresh = useCallback(async () => {
    const res  = await fetch(BASE_URL, { credentials: 'include' });
    const data = await res.json();
    setOdps(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const url    = editId ? `${BASE_URL}/${editId}` : BASE_URL;
    const method = editId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      writeLog('info', 'ODP', form.name,
        editId ? `${form.type} diperbarui` : `${form.type} baru ditambahkan`
      );
      closeModal();
      await refresh();
    }
    setIsLoading(false);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId === null) return;
    const target = odps.find(o => o.id === deleteConfirmId);
    await fetch(`${BASE_URL}/${deleteConfirmId}`, { method: 'DELETE', credentials: 'include' });
    if (target) writeLog('info', 'ODP', target.name, `${target.type} dihapus dari sistem`);
    setDeleteConfirmId(null);
    await refresh();
  };

  const openCreate = () => { setEditId(null); setForm(EMPTY); setIsModalOpen(true); };
  const openEdit   = (odp: Odp) => {
    setEditId(odp.id);
    setForm({ name: odp.name, type: odp.type, latitude: odp.latitude, longitude: odp.longitude, total_port: odp.total_port, odc_id: odp.odc_id ?? null });
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditId(null); setForm(EMPTY); };

  // ── Derived stats ──────────────────────────────────────────
  const odpList = odps.filter(o => o.type === 'ODP');
  const odcList = odps.filter(o => o.type === 'ODC');

  const totalOdp = odpList.length;
  const totalOdc = odcList.length;

  const totalAvailable = odps.reduce((acc, o) => {
    const used = o.type === 'ODC'
      ? odps.filter(c => c.odc_id === o.id).length
      : (o.onus?.length || 0);
    return acc + Math.max(0, o.total_port - used);
  }, 0);

  const fullCount = odps.filter(o => {
    const used = o.type === 'ODC'
      ? odps.filter(c => c.odc_id === o.id).length
      : (o.onus?.length || 0);
    return used >= o.total_port;
  }).length;

  // Port usage untuk progress bar
  const totalPorts = odps.reduce((s, o) => s + o.total_port, 0);
  const usedPorts  = totalPorts - totalAvailable;
  const usagePct   = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📡</div>
          <div>
            <div className={styles.headerTitle}>Manajemen ODP & ODC</div>
            <div className={styles.headerSub}>Kelola titik distribusi jaringan fiber</div>
          </div>
        </div>
        <Link to="/dashboard" className={styles.backBtn}>← Kembali ke Dashboard</Link>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total ODP</div>
          <div className={styles.statValue}>{totalOdp}</div>
          <div className={styles.statSub}>{odps.filter(o => o.type === 'ODP' && o.odc_id).length} terhubung ke ODC</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total ODC</div>
          <div className={styles.statValue}>{totalOdc}</div>
          <div className={styles.statSub}>{odcList.filter(o => odps.filter(c => c.odc_id === o.id).length >= o.total_port).length} penuh</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Port Tersedia</div>
          <div className={`${styles.statValue} ${styles.green}`}>{totalAvailable}</div>
          <div className={styles.statSub}>dari {totalPorts} total port</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Utilisasi</div>
          <div className={`${styles.statValue} ${usagePct >= 90 ? styles.red : usagePct >= 70 ? styles.amber : ''}`}>
            {usagePct}%
          </div>
          <div className={styles.statBar}>
            <div className={styles.statBarFill}
              style={{ width: `${usagePct}%`, background: usagePct >= 90 ? 'var(--red)' : usagePct >= 70 ? 'var(--amber)' : 'var(--green)' }} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.sectionTitle}>Daftar Perangkat ({odps.length} titik)</div>
        <button className={styles.createBtn} onClick={openCreate}>+ Tambah Perangkat</button>
      </div>

      {/* Table */}
      <OdpTable
        odps={odps}
        filterType={filterType}
        onFilterType={setFilterType}
        onEdit={openEdit}
        onDelete={setDeleteConfirmId}
      />

      {isModalOpen && (
        <OdpModal
          editId={editId} form={form} setForm={setForm}
          existingOdps={odps} isLoading={isLoading}
          onClose={closeModal} onSubmit={handleSubmit}
          onMapClick={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
        />
      )}

      {deleteConfirmId !== null && (
        <DeleteConfirmModal onCancel={() => setDeleteConfirmId(null)} onConfirm={confirmDelete} />
      )}
    </div>
  );
}