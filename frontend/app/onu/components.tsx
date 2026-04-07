"use client";

import { useState } from 'react';
import { 
  APIProvider, 
  Map as GMap, 
  AdvancedMarker, 
  Pin, 
  InfoWindow 
} from '@vis.gl/react-google-maps';
import styles from './onu.module.css';

// ── Types ────────────────────────────────────────────────────
export interface Onu {
  id: number;
  mac_address: string;
  customer: string;
  latitude: string;
  longitude: string;
  rx_power: string;
  status: string;
  odp_id?: number | null;
}
export interface Odp {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
}
export interface OnuForm {
  customer: string;
  latitude: string;
  longitude: string;
  odp_id: string;
}
export type FilterMode = 'all' | 'complete' | 'incomplete';

// ── OnuTable ─────────────────────────────────────────────────
interface TableProps {
  onus: Onu[];
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  totalCount: number;
  onEdit: (onu: Onu) => void;
}
export function OnuTable({ onus, filterMode, onFilterChange, totalCount, onEdit }: TableProps) {
  const completeCount   = onus.filter(o => o.latitude && o.longitude).length;
  const incompleteCount = onus.filter(o => !o.latitude || !o.longitude).length;

  return (
    <>
      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Filter:</span>
        <button
          className={`${styles.filterBtn} ${filterMode === 'all' ? styles.filterActive : ''}`}
          onClick={() => onFilterChange('all')}
        >
          Semua ({totalCount})
        </button>
        <button
          className={`${styles.filterBtn} ${filterMode === 'complete' ? styles.filterComplete : ''}`}
          onClick={() => onFilterChange('complete')}
        >
          ✅ Lengkap ({completeCount})
        </button>
        <button
          className={`${styles.filterBtn} ${filterMode === 'incomplete' ? styles.filterIncomplete : ''}`}
          onClick={() => onFilterChange('incomplete')}
        >
          ❌ Belum Diatur ({incompleteCount})
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>MAC Address</th>
              <th>Nama Pelanggan</th>
              <th>Redaman</th>
              <th>Status Lokasi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {onus.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  <div className={styles.emptyIcon}>🗄️</div>
                  Tidak ada data yang sesuai filter.
                </td>
              </tr>
            ) : onus.map(onu => {
              const rxVal      = parseFloat(onu.rx_power);
              const isWeak     = rxVal <= -25;
              const hasLocation = !!onu.latitude && !!onu.longitude;
              return (
                <tr key={onu.id}>
                  <td><span className={styles.macCell}>{onu.mac_address}</span></td>
                  <td><span className={styles.customerName}>{onu.customer || '—'}</span></td>
                  <td>
                    <span className={isWeak ? styles.rxWeak : styles.rxOk}>
                      {onu.rx_power} dBm
                    </span>
                  </td>
                  <td>
                    {hasLocation
                      ? <span className={styles.badgeComplete}>Lengkap</span>
                      : <span className={styles.badgeIncomplete}>Belum Diatur</span>}
                  </td>
                  <td>
                    <button className={styles.editBtn} onClick={() => onEdit(onu)}>
                      ✏️ Edit & Set Lokasi
                    </button>
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

// ── OnuModal ─────────────────────────────────────────────────
interface ModalProps {
  onu: Onu;
  form: OnuForm;
  setForm: (f: OnuForm) => void;
  odps: Odp[];
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onMapClick: (lat: number, lng: number) => void;
  onOdpChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}
export function OnuModal({ onu, form, setForm, odps, isLoading, onClose, onSubmit, onMapClick, onOdpChange }: ModalProps) {
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string;
  const MAP_ID = process.env.NEXT_PUBLIC_MAP_ID as string;

  const [activeInfoId, setActiveInfoId] = useState<number | string | null>(null);

  const center = form.latitude && form.longitude
    ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }
    : { lat: -7.536199, lng: 112.436890 };

  // Tangkap event klik dari Google Maps
  const handleMapClick = (e: any) => {
    if (e.detail.latLng) {
      onMapClick(e.detail.latLng.lat, e.detail.latLng.lng);
      setActiveInfoId('new');
    }
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>✏️ Edit Data ONU</div>
            <div className={styles.modalSub}>{onu.mac_address}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>

          {/* Form */}
          <div className={styles.formSide}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Nama Pelanggan</label>
              <input
                className={styles.fieldInput}
                type="text"
                placeholder="Masukkan nama pelanggan"
                value={form.customer}
                onChange={e => setForm({ ...form, customer: e.target.value })}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Pilih ODP</label>
              <div className={styles.coordHint}>🔗 Memilih ODP akan mengisi koordinat otomatis</div>
              <select className={styles.fieldSelect} value={form.odp_id} onChange={onOdpChange}>
                <option value="">— Pilih ODP —</option>
                {odps.map(odp => (
                  <option key={odp.id} value={odp.id}>{odp.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Koordinat Lokasi</label>
              <div className={styles.coordHint}>🗺️ Klik peta atau pilih ODP untuk mengisi otomatis</div>
              <div className={styles.coordRow}>
                <input
                  className={`${styles.fieldInput} ${styles.mono}`}
                  placeholder="Latitude"
                  value={form.latitude}
                  readOnly
                />
                <input
                  className={`${styles.fieldInput} ${styles.mono}`}
                  placeholder="Longitude"
                  value={form.longitude}
                  readOnly
                />
              </div>
            </div>

            <button className={styles.submitBtn} onClick={onSubmit} disabled={isLoading || !form.customer}>
              {isLoading ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>

          {/* Map */}
          <div className={styles.mapSide}>
            <div className={styles.mapLabel}>🖱️ Klik peta untuk geser titik lokasi</div>
            <div style={{ height: '100%', width: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <GMap
                  defaultCenter={center}
                  defaultZoom={16}
                  mapId={MAP_ID}
                  mapTypeId={'hybrid'}
                  onClick={handleMapClick}
                  disableDefaultUI={false}
                  gestureHandling={'greedy'}
                >
                  
                  {/* Marker biru: lokasi pelanggan */}
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
                            <strong>{form.customer || 'Lokasi Pelanggan'}</strong>
                          </div>
                        </InfoWindow>
                      )}
                    </AdvancedMarker>
                  )}

                  {/* Marker hitam: referensi ODP */}
                  {odps.filter(o => o.latitude).map(odp => (
                    <AdvancedMarker 
                      key={`odp-${odp.id}`} 
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
                            <span style={{ fontSize: '12px' }}>Titik ODP Referensi</span>
                          </div>
                        </InfoWindow>
                      )}
                    </AdvancedMarker>
                  ))}

                </GMap>
              </APIProvider>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}