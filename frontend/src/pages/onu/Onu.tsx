import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Onu, Odp, OnuForm, FilterMode, OnuTable, OnuModal } from './components';
import styles from './onu.module.css';

const ONU_URL = '/api/onu';
const ODP_URL = '/api/odp';

export default function OnuPage() {
  const [onus,        setOnus]        = useState<Onu[]>([]);
  const [odps,        setOdps]        = useState<Odp[]>([]);
  const [filterMode,  setFilterMode]  = useState<FilterMode>('all');
  const [selectedOnu, setSelectedOnu] = useState<Onu | null>(null);
  const [form,        setForm]        = useState<OnuForm>({ customer: '', latitude: '', longitude: '', odp_id: '' });
  const [isLoading,   setIsLoading]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Fetch ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const [onuRes, odpRes] = await Promise.all([fetch(ONU_URL), fetch(ODP_URL)]);
    const onuData = await onuRes.json();
    const odpData = await odpRes.json();
    setOnus(Array.isArray(onuData) ? onuData : (onuData.result || []));
    setOdps(Array.isArray(odpData) ? odpData : (odpData.result || []));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);


  useEffect(() => {
    document.title = "ONU | AFF NET GIS";
  }, []);


  // ── Handlers ───────────────────────────────────────────────
  const openEdit = (onu: Onu) => {
    setSelectedOnu(onu);
    setForm({
      customer:  onu.customer  || '',
      latitude:  onu.latitude  || '',
      longitude: onu.longitude || '',
      odp_id:    onu.odp_id ? onu.odp_id.toString() : '',
    });
  };

  const closeModal = () => { setSelectedOnu(null); };

  const handleOdpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id  = e.target.value;
    const odp = odps.find(o => o.id.toString() === id);
    setForm(f => odp
      ? { ...f, odp_id: id, latitude: odp.latitude, longitude: odp.longitude }
      : { ...f, odp_id: '' }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOnu) return;
    setIsLoading(true);
    const payload = { ...form, odp_id: form.odp_id ? parseInt(form.odp_id) : null };
    const res = await fetch(`${ONU_URL}/${selectedOnu.mac_address}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { await refresh(); closeModal(); }
    setIsLoading(false);
  };

  // ── Filtered list ──────────────────────────────────────────
  const filtered = onus.filter(onu => {
    const has = !!onu.latitude && !!onu.longitude;
    if (filterMode === 'complete')   return has;
    if (filterMode === 'incomplete') return !has;
    return true;
  });

  // ── Derived stats ──────────────────────────────────────────
  const completeCount   = onus.filter(o => o.latitude && o.longitude).length;
  const incompleteCount = onus.length - completeCount;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>🗄️</div>
          <div>
            <div className={styles.headerTitle}>Manajemen ONU</div>
            <div className={styles.headerSub}>
              Optical Network Unit — Kelola data dan lokasi perangkat pelanggan
              {lastUpdated && (
                <span style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                  <span>🔄</span> {lastUpdated.toLocaleTimeString('id-ID')}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link to="/map" className={styles.backBtn}>← Kembali ke Peta</Link>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total ONU</div>
          <div className={styles.statValue}>{onus.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Lokasi Lengkap</div>
          <div className={`${styles.statValue} ${styles.green}`}>{completeCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Belum Diatur</div>
          <div className={`${styles.statValue} ${styles.red}`}>{incompleteCount}</div>
        </div>
      </div>

      {/* Table + Filter */}
      <OnuTable
        onus={filtered}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        totalCount={onus.length}
        onEdit={openEdit}
      />

      {/* Modal */}
      {selectedOnu && (
        <OnuModal
          onu={selectedOnu}
          form={form}
          setForm={setForm}
          odps={odps}
          isLoading={isLoading}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onMapClick={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
          onOdpChange={handleOdpChange}
        />
      )}
    </div>
  );
}