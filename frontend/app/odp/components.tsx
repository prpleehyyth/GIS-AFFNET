"use client";

import { useState } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow 
} from '@vis.gl/react-google-maps';
import styles from './odp.module.css';

// ── Types ────────────────────────────────────────────────────
export interface Onu { id: number; customer: string; }
export interface Odp {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  total_port: number;
  onus: Onu[];
}
export interface OdpForm {
  name: string;
  latitude: string;
  longitude: string;
  total_port: number;
}

// ── OdpTable ─────────────────────────────────────────────────
interface TableProps {
  odps: Odp[];
  onEdit: (odp: Odp) => void;
  onDelete: (id: number) => void;
}
export function OdpTable({ odps, onEdit, onDelete }: TableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nama ODP</th>
            <th>Koordinat</th>
            <th>Port</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {odps.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.emptyCell}>
                <div className={styles.emptyIcon}>📡</div>
                Belum ada data ODP. Klik <strong>+ Tambah ODP</strong> untuk memulai.
              </td>
            </tr>
          ) : odps.map(odp => {
            const terisi = odp.onus?.length || 0;
            const isFull = terisi >= odp.total_port;
            const pct    = Math.min((terisi / odp.total_port) * 100, 100);
            return (
              <tr key={odp.id}>
                <td><span className={styles.odpName}>{odp.name}</span></td>
                <td>
                  <span className={styles.coordCell}>
                    {parseFloat(odp.latitude).toFixed(5)}, {parseFloat(odp.longitude).toFixed(5)}
                  </span>
                </td>
                <td>
                  <div className={styles.portBarWrap}>
                    <span className={styles.portText}>
                      <span className={isFull ? styles.portFull : styles.portOk}>{terisi}</span>
                      <span className={styles.portSlash}> / </span>
                      <span className={styles.portTotal}>{odp.total_port}</span>
                    </span>
                    <div className={styles.portBar}>
                      <div className={styles.portBarFill} style={{ width: `${pct}%`, background: isFull ? '#f87171' : '#34d399' }} />
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
                  <button className={styles.delBtn}  onClick={() => onDelete(odp.id)}>🗑 Hapus</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── OdpModal ─────────────────────────────────────────────────
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
  // Gunakan variabel environment yang sama dengan halaman Map utama
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string;
  const MAP_ID = process.env.NEXT_PUBLIC_MAP_ID as string;

  const [activeInfoId, setActiveInfoId] = useState<number | string | null>(null);

  const center = form.latitude && form.longitude
    ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }
    : { lat: -7.536199, lng: 112.436890 };

  const canSubmit = !isLoading && !!form.name && !!form.latitude && !!form.longitude;

  // Tangkap event klik dari Google Maps
  const handleMapClick = (e: any) => {
    if (e.detail.latLng) {
      onMapClick(e.detail.latLng.lat, e.detail.latLng.lng);
      setActiveInfoId('new'); // Otomatis buka pop-up untuk titik baru
    }
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>{editId ? '✏️ Edit ODP' : '📍 Tambah ODP Baru'}</div>
            <div className={styles.modalSub}>{editId ? 'Ubah data ODP yang sudah ada' : 'Isi form atau klik lokasi langsung di peta'}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>

          {/* Form */}
          <div className={styles.formSide}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Nama ODP</label>
              <input className={styles.fieldInput} type="text" placeholder="Contoh: ODP-A-01"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Total Port</label>
              <input className={styles.fieldInput} type="number" min={1}
                value={form.total_port} onChange={e => setForm({ ...form, total_port: parseInt(e.target.value) })} />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Koordinat</label>
              <div className={styles.coordHint}>🗺️ Klik titik di peta untuk mengisi otomatis</div>
              <div className={styles.coordRow}>
                <input className={`${styles.fieldInput} ${styles.mono}`} placeholder="Latitude"
                  value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
                <input className={`${styles.fieldInput} ${styles.mono}`} placeholder="Longitude"
                  value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
              </div>
            </div>

            <button className={styles.submitBtn} onClick={onSubmit} disabled={!canSubmit}>
              {isLoading ? 'Menyimpan...' : editId ? 'Update ODP' : 'Simpan ODP'}
            </button>
          </div>

          {/* Map */}
          <div className={styles.mapSide}>
            <div className={styles.mapLabel}>🖱️ Klik peta untuk memilih lokasi</div>
            <div style={{ height: '100%', width: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                  defaultCenter={center}
                  defaultZoom={16}
                  mapId={MAP_ID}
                  mapTypeId={'hybrid'}
                  onClick={handleMapClick}
                  disableDefaultUI={false}
                  gestureHandling={'greedy'}
                >
                  
                  {/* Marker untuk Lokasi Baru/Edit */}
                  {form.latitude && form.longitude && (
                    <AdvancedMarker 
                      position={{ lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }}
                      onClick={() => setActiveInfoId('new')}
                    >
                      <Pin background="#3b82f6" borderColor="#fff" glyphColor="#fff" scale={1.2} />
                      {activeInfoId === 'new' && (
                        <InfoWindow 
                          position={{ lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }}
                          onCloseClick={() => setActiveInfoId(null)}
                        >
                          <div style={{ padding: '4px', color: '#1e293b' }}>
                            <strong>{form.name || 'Lokasi Pilihanmu'}</strong>
                          </div>
                        </InfoWindow>
                      )}
                    </AdvancedMarker>
                  )}

                  {/* Marker untuk ODP yang sudah ada di DB */}
                  {existingOdps.filter(o => editId === null || o.id !== editId).map(odp => (
                    <AdvancedMarker 
                      key={odp.id} 
                      position={{ lat: parseFloat(odp.latitude), lng: parseFloat(odp.longitude) }}
                      onClick={() => setActiveInfoId(odp.id)}
                    >
                      <Pin background="#475569" borderColor="#fff" glyphColor="#fff" scale={0.9} />
                      {activeInfoId === odp.id && (
                        <InfoWindow 
                          position={{ lat: parseFloat(odp.latitude), lng: parseFloat(odp.longitude) }}
                          onCloseClick={() => setActiveInfoId(null)}
                        >
                          <div style={{ padding: '4px', color: '#1e293b' }}>
                            <strong>{odp.name}</strong><br />
                            <span style={{ fontSize: '12px' }}>{odp.onus?.length || 0} / {odp.total_port} port terpakai</span>
                          </div>
                        </InfoWindow>
                      )}
                    </AdvancedMarker>
                  ))}

                </Map>
              </APIProvider>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ───────────────────────────────────────
interface DeleteProps { onCancel: () => void; onConfirm: () => void; }
export function DeleteConfirmModal({ onCancel, onConfirm }: DeleteProps) {
  return (
    <div className={styles.confirmOverlay}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmIcon}>⚠️</div>
        <div className={styles.confirmTitle}>Hapus ODP ini?</div>
        <div className={styles.confirmDesc}>Pastikan tidak ada ONU yang masih terhubung. Tindakan ini tidak dapat dibatalkan.</div>
        <div className={styles.confirmActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Batal</button>
          <button className={styles.deleteBtn} onClick={onConfirm}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  );
} 