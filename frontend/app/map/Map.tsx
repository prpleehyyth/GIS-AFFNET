/// <reference types="google.maps" />
"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  useMap,
  InfoWindow,
} from '@vis.gl/react-google-maps';

import NotifPanel, { Notif } from './NotifPanel';
import {
  Onu, Odp, Infra,
  OltIcon, MikrotikIcon, OdpIcon, OnuIcon,
  SignalBars, StatusBadge, pp,
  buildNotifs,
} from './Components';
import { writeLog, resolveLog } from '@/lib/logService';
import styles from './map.module.css';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string;
const MAP_ID              = process.env.NEXT_PUBLIC_MAP_ID as string;
const POLL_MS             = 15_000;

// ── Inject pulse keyframes once ───────────────────────────────
if (typeof window !== 'undefined') {
  const id = 'map-global-style';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
      @keyframes mapPulse {
        0%   { transform:scale(1);   opacity:.9; }
        70%  { transform:scale(2.4); opacity:0;  }
        100% { transform:scale(2.4); opacity:0;  }
      }
    `;
    document.head.appendChild(s);
  }
}

// ── Polyline wrapper untuk Google Maps ────────────────────────
function Polyline({ path, options }: { path: google.maps.LatLngLiteral[]; options: google.maps.PolylineOptions }) {
  const map = useMap();
  const ref = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;
    ref.current = new google.maps.Polyline({ ...options, path, map });
    return () => { ref.current?.setMap(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.setPath(path);
    ref.current.setOptions(options);
  }, [path, options]);

  return null;
}

// ── Popup card ────────────────────────────────────────────────
function InfoCard({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans',sans-serif",
      background: '#fff', borderRadius: 12,
      border: '1px solid #e4e7ef',
      boxShadow: '0 8px 24px rgba(0,0,0,.12)',
      padding: 14, minWidth: 200, position: 'relative',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 8, right: 8,
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: 0,
      }}>×</button>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MapView() {
  const [isMounted, setIsMounted]   = useState(false);
  const [isLoading, setIsLoading]   = useState(true);

  const [onus,      setOnus]        = useState<Onu[]>([]);
  const [infras,    setInfras]      = useState<Infra[]>([]);
  const [odps,      setOdps]        = useState<Odp[]>([]);
  const [notifs,    setNotifs]      = useState<Notif[]>([]);
  const [panelOpen, setPanelOpen]   = useState(false);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);

  const seenIds      = useRef<Set<string>>(new Set());
  const firstSeenAt  = useRef<Map<string, Date>>(new Map());

  // activeErrors disimpan di localStorage supaya tidak reset saat navigasi
  const getActiveErrors = () => {
    try { return new Set<string>(JSON.parse(localStorage.getItem('ae') || '[]')); }
    catch { return new Set<string>(); }
  };
  const saveActiveErrors = (s: Set<string>) => {
    localStorage.setItem('ae', JSON.stringify([...s]));
  };

  useEffect(() => { setIsMounted(true); }, []);

  const fetchAll = useCallback(async () => {
    try {
      const opts = { credentials: 'include' as RequestCredentials };
      const [onuData, infraData, odpData] = await Promise.all([
        fetch('http://localhost:8888/api/onu',          opts).then(r => r.json()),
        fetch('http://localhost:8888/api/zabbix-infra', opts)
          .then(r => r.ok ? r.json() : { result: [] })
          .catch(() => ({ result: [] })),
        fetch('http://localhost:8888/api/odp',          opts).then(r => r.json()),
      ]);

      const allOnus   = Array.isArray(onuData)   ? onuData   : (onuData.result   || []);
      const allInfras = Array.isArray(infraData)  ? infraData : (infraData.result || []);
      const allOdps   = Array.isArray(odpData)    ? odpData   : (odpData.result   || []);

      setOnus(allOnus.filter((o: Onu)     => o.latitude && o.longitude));
      setInfras(allInfras.filter((i: Infra) => i.inventory?.location_lat && i.inventory?.location_lon));
      setOdps(allOdps.filter((o: Odp)     => o.latitude && o.longitude));

      // ── writeLog: ONU kritis ──────────────────────────────
      // Hanya tulis log saat error BARU muncul (belum ada di activeErrors)
      // Resolve saat kondisi kembali normal
      const prevErrors    = getActiveErrors();
      const currentErrors = new Set<string>();

      allOnus.forEach((onu: Onu) => {
        const rx  = parseFloat(onu.rx_power);
        const key = `onu-crit-${onu.id}`;
        if (rx <= -27) {
          currentErrors.add(key);
          if (!prevErrors.has(key)) {
            writeLog('critical', 'ONU', onu.customer || onu.mac_address, `Sinyal kritis terdeteksi: ${onu.rx_power} dBm`);
          }
        } else if (prevErrors.has(key)) {
          resolveLog(onu.customer || onu.mac_address, 'ONU');
        }
      });

      // ── writeLog: Infra down ──────────────────────────────
      allInfras.forEach((infra: Infra) => {
        const isDown  = infra.interfaces?.some((i: any) => i.available === '2') || false;
        const isMikro = infra.name.toLowerCase().includes('mikrotik');
        const key     = `infra-${infra.hostid}`;
        if (isDown) {
          currentErrors.add(key);
          if (!prevErrors.has(key)) {
            writeLog('critical', 'Infra', infra.name, `Perangkat ${isMikro ? 'router' : 'OLT'} tidak merespons`);
          }
        } else if (prevErrors.has(key)) {
          resolveLog(infra.name, 'Infra');
        }
      });

      // Simpan ke localStorage supaya persist saat navigasi
      saveActiveErrors(currentErrors);

      // ── Notif panel (tetap seperti sebelumnya) ────────────
      const fresh    = buildNotifs(allOnus, allInfras);
      const freshIds = new Set(fresh.map((n: any) => n.id));
      const now      = new Date();

      for (const id of firstSeenAt.current.keys()) {
        if (!freshIds.has(id)) firstSeenAt.current.delete(id);
      }
      for (const n of fresh) {
        if (!firstSeenAt.current.has(n.id)) firstSeenAt.current.set(n.id, now);
      }

      setNotifs(prev => {
        const prevMap = new Map(prev.map(n => [n.id, n]));
        return fresh.map((n: any) => ({
          ...n,
          ts:   firstSeenAt.current.get(n.id) ?? now,
          seen: prevMap.get(n.id)?.seen ?? seenIds.current.has(n.id) ?? false,
        }));
      });

    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    fetchAll();
    const t = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(t);
  }, [fetchAll, isMounted]);

  const mikrotik  = infras.find(i => i.name.toLowerCase().includes('mikrotik'));
  const olt       = infras.find(i => i.name.toLowerCase().includes('olt'));
  const isOltDown = olt?.interfaces?.some(i => i.available === '2')      || false;
  const isMikDown = mikrotik?.interfaces?.some(i => i.available === '2') || false;
  const coreDown  = isOltDown || isMikDown;
  const unseen    = notifs.filter(n => !n.seen).length;

  const handleClear   = (id: string) => { seenIds.current.add(id); setNotifs(p => p.filter(n => n.id !== id)); };
  const handleMarkAll = () => setNotifs(p => p.map(n => { seenIds.current.add(n.id); return { ...n, seen: true }; }));
  const togglePanel   = () => { setPanelOpen(o => !o); if (!panelOpen) handleMarkAll(); };

  const selectedInfra = typeof selectedId === 'string' ? infras.find(i => i.hostid === selectedId) : null;
  const selectedOdp   = typeof selectedId === 'number' ? odps.find(o => o.id === selectedId && odps.some(x => x.id === selectedId)) : null;
  const selectedOnu   = typeof selectedId === 'number' ? onus.find(o => o.id === selectedId) : null;

  if (!isMounted) return null;

  return (
    <div className={styles.mapWrap} style={{ position: 'relative' }}>

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.7)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, color: '#374151'
        }}>
          Memuat data jaringan...
        </div>
      )}

      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>

        <button
          className={`${styles.bellBtn} ${panelOpen ? styles.bellBtnShifted : ''}`}
          onClick={togglePanel}
        >
          <span>🔔</span>
          {unseen > 0 && !panelOpen && (
            <span className={styles.bellBadge}>{unseen > 9 ? '9+' : unseen}</span>
          )}
        </button>

        <GMap
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          defaultCenter={{ lat: -7.5361, lng: 112.4368 }}
          defaultZoom={15}
          mapId={MAP_ID}
          mapTypeId="hybrid"
          disableDefaultUI={false}
          onClick={() => setSelectedId(null)}
        >

          {/* Backbone MikroTik ↔ OLT */}
          {mikrotik && olt && (
            <Polyline
              path={[
                { lat: parseFloat(mikrotik.inventory.location_lat), lng: parseFloat(mikrotik.inventory.location_lon) },
                { lat: parseFloat(olt.inventory.location_lat),      lng: parseFloat(olt.inventory.location_lon) },
              ]}
              options={{ strokeColor: coreDown ? '#ef4444' : '#6366f1', strokeWeight: 4, strokeOpacity: 0.85, strokePattern: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '12px' }] }}
            />
          )}

          {/* Trunk OLT → ODP */}
          {olt && odps.map(odp => (
            <Polyline key={`trunk-${odp.id}`}
              path={[
                { lat: parseFloat(olt.inventory.location_lat), lng: parseFloat(olt.inventory.location_lon) },
                { lat: parseFloat(odp.latitude),               lng: parseFloat(odp.longitude) },
              ]}
              options={{ strokeColor: coreDown ? '#ef4444' : '#3b82f6', strokeWeight: 3, strokeOpacity: 0.7 }}
            />
          ))}

          {/* Drop ODP → ONU */}
          {onus.filter(o => o.odp_id).map(onu => {
            const parent = odps.find(o => o.id === onu.odp_id);
            if (!parent) return null;
            const rx    = parseFloat(onu.rx_power);
            const color = rx <= -27 ? '#ef4444' : rx <= -25 ? '#f59e0b' : '#22c55e';
            return (
              <Polyline key={`drop-${onu.id}`}
                path={[
                  { lat: parseFloat(parent.latitude), lng: parseFloat(parent.longitude) },
                  { lat: parseFloat(onu.latitude),    lng: parseFloat(onu.longitude) },
                ]}
                options={{ strokeColor: color, strokeWeight: 2, strokeOpacity: 0.8 }}
              />
            );
          })}

          {/* Marker Infra */}
          {infras.map(infra => {
            const isDown  = infra.interfaces?.some(i => i.available === '2') || false;
            const isMikro = infra.name.toLowerCase().includes('mikrotik');
            return (
              <AdvancedMarker
                key={infra.hostid}
                position={{ lat: parseFloat(infra.inventory.location_lat), lng: parseFloat(infra.inventory.location_lon) }}
                onClick={() => setSelectedId(infra.hostid)}
              >
                {isMikro ? <MikrotikIcon down={isDown} /> : <OltIcon down={isDown} />}
              </AdvancedMarker>
            );
          })}

          {/* Marker ODP */}
          {odps.map(odp => {
            const terisi = onus.filter(o => o.odp_id === odp.id).length;
            const isFull = terisi >= odp.total_port;
            return (
              <AdvancedMarker
                key={`odp-${odp.id}`}
                position={{ lat: parseFloat(odp.latitude), lng: parseFloat(odp.longitude) }}
                onClick={() => setSelectedId(odp.id)}
              >
                <OdpIcon full={isFull} />
              </AdvancedMarker>
            );
          })}

          {/* Marker ONU */}
          {onus.map(onu => {
            const rx         = parseFloat(onu.rx_power);
            const isCritical = rx <= -27;
            const isWarning  = rx <= -25 && !isCritical;
            const level      = isCritical ? 'critical' : isWarning ? 'warning' : 'ok';
            return (
              <AdvancedMarker
                key={`onu-${onu.id}`}
                position={{ lat: parseFloat(onu.latitude), lng: parseFloat(onu.longitude) }}
                onClick={() => setSelectedId(onu.id)}
              >
                <OnuIcon level={level} />
              </AdvancedMarker>
            );
          })}

          {/* InfoWindow: Infra */}
          {selectedInfra && (() => {
            const isDown  = selectedInfra.interfaces?.some(i => i.available === '2') || false;
            const isMikro = selectedInfra.name.toLowerCase().includes('mikrotik');
            return (
              <InfoWindow
                position={{ lat: parseFloat(selectedInfra.inventory.location_lat), lng: parseFloat(selectedInfra.inventory.location_lon) }}
                onCloseClick={() => setSelectedId(null)}
                pixelOffset={[0, -24]}
              >
                <InfoCard onClose={() => setSelectedId(null)}>
                  <div style={pp.head}>
                    <div style={{ ...pp.icon, background: isDown ? '#fff1f2' : isMikro ? '#f3e8ff' : '#dbeafe' }}>
                      {isMikro ? '🔀' : '📡'}
                    </div>
                    <div>
                      <div style={pp.name}>{selectedInfra.name}</div>
                      <div style={pp.sub}>{isMikro ? 'Router Core' : 'Optical Line Terminal'}</div>
                    </div>
                  </div>
                  <div style={pp.row}><span style={pp.lbl}>Status</span><StatusBadge ok={!isDown} /></div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Tipe</span>
                    <span style={{ ...pp.val, color: isMikro ? '#9333ea' : '#3b82f6' }}>
                      {isMikro ? 'MikroTik' : 'OLT HIOSO'}
                    </span>
                  </div>
                </InfoCard>
              </InfoWindow>
            );
          })()}

          {/* InfoWindow: ODP */}
          {selectedOdp && (() => {
            const terisi = onus.filter(o => o.odp_id === selectedOdp.id).length;
            const isFull = terisi >= selectedOdp.total_port;
            const pct    = selectedOdp.total_port > 0 ? Math.round((terisi / selectedOdp.total_port) * 100) : 0;
            return (
              <InfoWindow
                position={{ lat: parseFloat(selectedOdp.latitude), lng: parseFloat(selectedOdp.longitude) }}
                onCloseClick={() => setSelectedId(null)}
                pixelOffset={[0, -20]}
              >
                <InfoCard onClose={() => setSelectedId(null)}>
                  <div style={pp.head}>
                    <div style={{ ...pp.icon, background: isFull ? '#fff7ed' : '#f0fdf4' }}>🔌</div>
                    <div>
                      <div style={pp.name}>{selectedOdp.name}</div>
                      <div style={pp.sub}>Optical Distribution Point</div>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Port terpakai</span>
                    <span style={{ ...pp.val, color: isFull ? '#ef4444' : '#16a34a' }}>{terisi} / {selectedOdp.total_port}</span>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Kapasitas</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 4, background: '#e4e7ef', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: isFull ? '#ef4444' : '#16a34a', borderRadius: 2 }} />
                      </div>
                      <span style={{ ...pp.val, fontSize: 11 }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={pp.row}><span style={pp.lbl}>Status</span><StatusBadge ok={!isFull} okLabel="Tersedia" failLabel="Penuh" /></div>
                </InfoCard>
              </InfoWindow>
            );
          })()}

          {/* InfoWindow: ONU */}
          {selectedOnu && (() => {
            const rx         = parseFloat(selectedOnu.rx_power);
            const isCritical = rx <= -27;
            const isWarning  = rx <= -25 && !isCritical;
            const rxColor    = isCritical ? '#ef4444' : isWarning ? '#d97706' : '#16a34a';
            return (
              <InfoWindow
                position={{ lat: parseFloat(selectedOnu.latitude), lng: parseFloat(selectedOnu.longitude) }}
                onCloseClick={() => setSelectedId(null)}
                pixelOffset={[0, -18]}
              >
                <InfoCard onClose={() => setSelectedId(null)}>
                  <div style={pp.head}>
                    <div style={{ ...pp.icon, background: isCritical ? '#fff1f2' : isWarning ? '#fffbeb' : '#f0fdf4' }}>🏠</div>
                    <div>
                      <div style={pp.name}>{selectedOnu.customer || 'Pelanggan'}</div>
                      <div style={pp.sub} title={selectedOnu.mac_address}>
                        {selectedOnu.mac_address.length > 14 ? selectedOnu.mac_address.slice(0, 14) + '…' : selectedOnu.mac_address}
                      </div>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Redaman (Rx)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SignalBars rx={rx} />
                      <span style={{ ...pp.val, color: rxColor }}>{selectedOnu.rx_power} dBm</span>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Kondisi sinyal</span>
                    <span style={{
                      ...pp.badge, color: rxColor,
                      background: isCritical ? '#fff1f2' : isWarning ? '#fffbeb' : '#f0fdf4',
                      border: `1px solid ${isCritical ? '#fecaca' : isWarning ? '#fde68a' : '#bbf7d0'}`,
                    }}>
                      {isCritical ? 'Kritis' : isWarning ? 'Warning' : 'Aman'}
                    </span>
                  </div>
                </InfoCard>
              </InfoWindow>
            );
          })()}

        </GMap>
      </APIProvider>

      {/* Notif Panel */}
      {panelOpen && (
        <NotifPanel notifs={notifs} onClear={handleClear} onMarkAll={handleMarkAll} />
      )}
    </div>
  );
}