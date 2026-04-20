import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './odp.module.css';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for OdpModal
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const violetIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blackIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [20, 33], // Smaller scale for ODP
  iconAnchor: [10, 33],
  popupAnchor: [1, -27],
  shadowSize: [33, 33]
});

// ── Types ─────────────────────────────────────────────────────
export interface Onu { id: number; customer: string; }
export interface Odp {
  id: number;
  name: string;
  type: 'ODP' | 'ODC';
  latitude: string;
  longitude: string;
  total_port: number;
  odc_id: number | null;
  odc?: { id: number; name: string } | null;
  onus?: Onu[];
}
export interface OdpForm {
  name: string;
  type: 'ODP' | 'ODC';
  latitude: string;
  longitude: string;
  total_port: number;
  odc_id: number | null;
}

export const TYPE_CFG = {
  ODP: { label: 'ODP', icon: '🔌', bg: 'var(--green-soft)', color: 'var(--green)', border: 'var(--green-border)', pinBg: '#1f2937' },
  ODC: { label: 'ODC', icon: '🗄️', bg: 'var(--blue-soft)',  color: 'var(--blue)',  border: 'var(--blue-border)',  pinBg: '#7c3aed' },
};

// ── Leaflet Maps click handler ────────────────────────────────
function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Port usage helper ─────────────────────────────────────────
function getUsed(odp: Odp, allOdps: Odp[]): number {
  return odp.type === 'ODC'
    ? allOdps.filter(o => o.odc_id === odp.id).length
    : (odp.onus?.length || 0);
}

// ── OdpTable ───────────────────────────────────────────────────
interface TableProps {
  odps: Odp[];
  filterType: 'ALL' | 'ODP' | 'ODC';
  onFilterType: (t: 'ALL' | 'ODP' | 'ODC') => void;
  onEdit: (odp: Odp) => void;
  onDelete: (id: number) => void;
}
export function OdpTable({ odps, filterType, onFilterType, onEdit, onDelete }: TableProps) {
  const filtered = filterType === 'ALL' ? odps : odps.filter(o => o.type === filterType);

  return (
    <>
      {/* Filter */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Tipe:</span>
        {(['ALL', 'ODP', 'ODC'] as const).map(t => (
          <button key={t}
            className={`${styles.filterBtn} ${filterType === t ? styles.filterActive : ''}`}
            onClick={() => onFilterType(t)}
          >
            {t === 'ALL' ? `Semua (${odps.length})` : `${TYPE_CFG[t].icon} ${t} (${odps.filter(o => o.type === t).length})`}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tipe</th>
              <th>Nama</th>
              <th>Parent ODC</th>
              <th>Koordinat</th>
              <th>Kapasitas</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  <div className={styles.emptyIcon}>📡</div>
                  Belum ada data. Klik <strong>+ Tambah Perangkat</strong> untuk memulai.
                </td>
              </tr>
            ) : filtered.map(odp => {
              const used   = getUsed(odp, odps);
              const isFull = used >= odp.total_port;
              const pct    = odp.total_port > 0 ? Math.min((used / odp.total_port) * 100, 100) : 0;
              const tcfg   = TYPE_CFG[odp.type];
              return (
                <tr key={odp.id}>
                  <td>
                    <span className={styles.typeBadge}
                      style={{ background: tcfg.bg, color: tcfg.color, border: `1px solid ${tcfg.border}` }}>
                      {tcfg.icon} {tcfg.label}
                    </span>
                  </td>
                  <td><span className={styles.odpName}>{odp.name}</span></td>
                  <td>
                    {odp.type === 'ODP'
                      ? odp.odc
                        ? <span className={styles.odcLink}>🗄️ {odp.odc.name}</span>
                        : <span className={styles.odcNone}>Tidak terhubung</span>
                      : <span className={styles.odcNone}>—</span>}
                  </td>
                  <td><span className={styles.coordCell}>{parseFloat(odp.latitude).toFixed(5)}, {parseFloat(odp.longitude).toFixed(5)}</span></td>
                  <td>
                    <div className={styles.portBarWrap}>
                      <span className={styles.portText}>
                        <span className={isFull ? styles.portFull : styles.portOk}>{used}</span>
                        <span className={styles.portSlash}> / </span>
                        <span className={styles.portTotal}>{odp.total_port}</span>
                      </span>
                      <div className={styles.portBar}>
                        <div className={styles.portBarFill}
                          style={{ width: `${pct}%`, background: isFull ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--green)' }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={isFull ? styles.badgeFull : styles.badgeAvailable}>
                      {isFull ? 'Penuh' : 'Tersedia'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.editBtn} onClick={() => onEdit(odp)}>✏️ Edit</button>
                    <button className={styles.delBtn}  onClick={() => onDelete(odp.id)}>🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── OdpModal ───────────────────────────────────────────────────
interface ModalProps {
  editId: number | null;
  form: OdpForm;
  setForm: (f: OdpForm) => void;
  existingOdps: Odp[];
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onMapClick: (lat: number, lng: number) => void;
}
export function OdpModal({ editId, form, setForm, existingOdps, isLoading, onClose, onSubmit, onMapClick }: ModalProps) {
  const odcList  = existingOdps.filter(o => o.type === 'ODC');
  const typeLabel = form.type === 'ODC' ? 'ODC' : 'ODP';
  const canSubmit = !isLoading && !!form.name && !!form.latitude && !!form.longitude;

  const center: [number, number] = form.latitude && form.longitude
    ? [parseFloat(form.latitude), parseFloat(form.longitude)]
    : [-7.536199, 112.436890];

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>{editId ? `✏️ Edit ${typeLabel}` : `📍 Tambah ${typeLabel} Baru`}</div>
            <div className={styles.modalSub}>{editId ? `Ubah data ${typeLabel}` : 'Isi form atau klik peta untuk koordinat'}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>

          {/* Form */}
          <div className={styles.formSide}>

            {/* Tipe toggle */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Tipe Perangkat</label>
              <div className={styles.typeToggle}>
                {(['ODP', 'ODC'] as const).map(t => (
                  <button key={t} type="button"
                    className={`${styles.typeToggleBtn} ${form.type === t ? styles.typeToggleActive : ''}`}
                    style={form.type === t ? { background: TYPE_CFG[t].bg, color: TYPE_CFG[t].color, borderColor: TYPE_CFG[t].border } : undefined}
                    onClick={() => setForm({ ...form, type: t, odc_id: null })}
                  >
                    {TYPE_CFG[t].icon} {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Nama */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Nama {typeLabel}</label>
              <input className={styles.fieldInput} type="text"
                placeholder={`Contoh: ${form.type}-A-01`}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            {/* Sambungan ODC — hanya untuk ODP */}
            {form.type === 'ODP' && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Sambungan ODC</label>
                <select className={styles.fieldSelect}
                  value={form.odc_id ?? ''}
                  onChange={e => setForm({ ...form, odc_id: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">— Tidak terhubung —</option>
                  {odcList.map(odc => (
                    <option key={odc.id} value={odc.id}>{odc.name}</option>
                  ))}
                </select>
                {odcList.length === 0 && (
                  <p className={styles.fieldHint}>⚠️ Belum ada ODC. Tambah ODC terlebih dahulu.</p>
                )}
              </div>
            )}

            {/* Total Port */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Total Port</label>
              <input className={styles.fieldInput} type="number" min={1}
                value={form.total_port}
                onChange={e => setForm({ ...form, total_port: parseInt(e.target.value) || 1 })} />
            </div>

            {/* Koordinat */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Koordinat</label>
              <div className={styles.coordHint}>🗺️ Klik peta untuk mengisi otomatis</div>
              <div className={styles.coordRow}>
                <input className={`${styles.fieldInput} ${styles.mono}`} placeholder="Latitude"
                  value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
                <input className={`${styles.fieldInput} ${styles.mono}`} placeholder="Longitude"
                  value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
              </div>
            </div>

            <button className={styles.submitBtn} onClick={onSubmit} disabled={!canSubmit}>
              {isLoading ? 'Menyimpan...' : editId ? `Update ${typeLabel}` : `Simpan ${typeLabel}`}
            </button>
          </div>

          {/* Map */}
          <div className={styles.mapSide}>
            <div className={styles.mapLabel}>🖱️ Klik peta · marker ungu = ODC · hitam = ODP</div>
            <MapContainer
              center={center}
              zoom={15}
              style={{ width: '100%', height: '100%', zIndex: 0 }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onPick={onMapClick} />

              {/* Marker form (biru) */}
              {form.latitude && form.longitude && (
                <Marker position={[parseFloat(form.latitude), parseFloat(form.longitude)]} icon={blueIcon} />
              )}

              {/* Marker existing */}
              {existingOdps
                .filter(o => editId === null || o.id !== editId)
                .map(odp => (
                  <Marker
                    key={odp.id}
                    position={[parseFloat(odp.latitude), parseFloat(odp.longitude)]}
                    icon={odp.type === 'ODC' ? violetIcon : blackIcon}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'var(--font)', padding: 4, minWidth: 140 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{odp.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                          {odp.type} · {parseFloat(odp.latitude).toFixed(5)}, {parseFloat(odp.longitude).toFixed(5)}
                        </div>
                        {form.type === 'ODP' && odp.type === 'ODC' && (
                          <button
                            onClick={() => {
                              onMapClick(parseFloat(odp.latitude), parseFloat(odp.longitude));
                              setForm({ ...form, odc_id: odp.id });
                            }}
                            style={{
                              width: '100%', padding: '6px 8px', fontSize: 11, fontWeight: 600,
                              background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                              borderRadius: 6, cursor: 'pointer',
                            }}
                          >
                            📍 Pakai lokasi & pilih ODC ini
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ─────────────────────────────────────────
interface DeleteProps { onCancel: () => void; onConfirm: () => void; }
export function DeleteConfirmModal({ onCancel, onConfirm }: DeleteProps) {
  return (
    <div className={styles.confirmOverlay}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmIcon}>⚠️</div>
        <div className={styles.confirmTitle}>Hapus perangkat ini?</div>
        <div className={styles.confirmDesc}>
          Tindakan ini tidak dapat dibatalkan.<br />
          Pastikan tidak ada ONU/ODP yang masih terhubung.
        </div>
        <div className={styles.confirmActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Batal</button>
          <button className={styles.deleteBtn} onClick={onConfirm}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  );
}
