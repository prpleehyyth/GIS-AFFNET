import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToString } from 'react-dom/server';

import {
  Onu, Odp, Infra,
  OltIcon, MikrotikIcon, OdpIcon, OnuIcon,
  SignalBars, StatusBadge, pp,
} from './Components';
import { writeLog, resolveLog } from '@/lib/logService';
import styles from './Map.module.css';

const POLL_MS = 15_000;

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
      .custom-leaflet-icon {
        background: transparent;
        border: none;
      }
    `;
    document.head.appendChild(s);
  }
}

// Helper to create L.divIcon from React component
const createIcon = (comp: React.ReactElement, size: [number, number]) => {
  return L.divIcon({
    html: renderToString(comp),
    className: 'custom-leaflet-icon',
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -size[1] / 2],
  });
};

// ── Popup card ────────────────────────────────────────────────
function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans',sans-serif",
      background: '#fff', borderRadius: 12,
      minWidth: 200, position: 'relative',
    }}>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MapView() {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [onus, setOnus] = useState<Onu[]>([]);
  const [infras, setInfras] = useState<Infra[]>([]);
  const [odps, setOdps] = useState<Odp[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const seenIds = useRef<Set<string>>(new Set());
  const firstSeenAt = useRef<Map<string, Date>>(new Map());

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
        fetch('/api/onu', opts).then(r => r.json()),
        fetch('/api/zabbix-infra', opts)
          .then(r => r.ok ? r.json() : { result: [] })
          .catch(() => ({ result: [] })),
        fetch('/api/odp', opts).then(r => r.json()),
      ]);

      const allOnus = Array.isArray(onuData) ? onuData : (onuData.result || []);
      const allInfras = Array.isArray(infraData) ? infraData : (infraData.result || []);
      const allOdps = Array.isArray(odpData) ? odpData : (odpData.result || []);

      setOnus(allOnus.filter((o: Onu) => o.latitude && o.longitude));
      setInfras(allInfras.filter((i: Infra) => i.inventory?.location_lat && i.inventory?.location_lon));
      setOdps(allOdps.filter((o: Odp) => o.latitude && o.longitude));

      // ── writeLog: ONU kritis ──────────────────────────────
      const prevErrors = getActiveErrors();
      const currentErrors = new Set<string>();

      allOnus.forEach((onu: Onu) => {
        const rx = parseFloat(onu.rx_power);
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
        const isDown = infra.interfaces?.some((i: any) => i.available === '2') || false;
        const key = `infra-${infra.hostid}`;

        if (isDown) {
          currentErrors.add(key);
          if (!prevErrors.has(key)) {
            const nameLow = infra.name.toLowerCase();
            let deviceType = 'Perangkat Jaringan';
            if (nameLow.includes('mikrotik')) deviceType = 'Router MikroTik';
            else if (nameLow.includes('olt')) deviceType = 'OLT HiOSO';
            else deviceType = `Server (${infra.name})`;

            writeLog('critical', 'Infra', infra.name, `${deviceType} tidak merespons / down`);
          }
        } else if (prevErrors.has(key)) {
          resolveLog(infra.name, 'Infra');
        }
      });

      saveActiveErrors(currentErrors);

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

  const mikrotik = infras.find(i => i.name.toLowerCase().includes('mikrotik'));
  const olt = infras.find(i => i.name.toLowerCase().includes('olt'));
  const isOltDown = olt?.interfaces?.some(i => i.available === '2') || false;
  const isMikDown = mikrotik?.interfaces?.some(i => i.available === '2') || false;
  const coreDown = isOltDown || isMikDown;
 


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


      <MapContainer
        center={[-7.5361, 112.4368]}
        zoom={15}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Backbone MikroTik ↔ OLT */}
        {mikrotik && olt && (
          <Polyline
            positions={[
              [parseFloat(mikrotik.inventory.location_lat), parseFloat(mikrotik.inventory.location_lon)],
              [parseFloat(olt.inventory.location_lat), parseFloat(olt.inventory.location_lon)],
            ]}
            pathOptions={{
              color: coreDown ? '#ef4444' : '#6366f1',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 10' // simulating the dashed look
            }}
          />
        )}

        {/* 1. Trunk: OLT → ODC */}
        {olt && odps.filter(o => o.type === 'ODC').map(odc => (
          <Polyline key={`trunk-odc-${odc.id}`}
            positions={[
              [parseFloat(olt.inventory.location_lat), parseFloat(olt.inventory.location_lon)],
              [parseFloat(odc.latitude), parseFloat(odc.longitude)],
            ]}
            pathOptions={{ color: coreDown ? '#ef4444' : '#3b82f6', weight: 4, opacity: 0.9 }}
          />
        ))}

        {/* 2. Distribusi: ODC → ODP */}
        {odps.filter(o => o.type === 'ODP' && o.odc_id).map(odp => {
          const parentOdc = odps.find(x => x.id === odp.odc_id);
          if (!parentOdc) return null;
          return (
            <Polyline key={`dist-${odp.id}`}
              positions={[
                [parseFloat(parentOdc.latitude), parseFloat(parentOdc.longitude)],
                [parseFloat(odp.latitude), parseFloat(odp.longitude)],
              ]}
              pathOptions={{ color: '#10b981', weight: 3, opacity: 0.8 }}
            />
          );
        })}

        {/* Drop ODP → ONU */}
        {onus.filter(o => o.odp_id).map(onu => {
          const parent = odps.find(o => o.id === onu.odp_id);
          if (!parent) return null;
          const rx = parseFloat(onu.rx_power);
          const color = rx <= -27 ? '#ef4444' : rx <= -25 ? '#f59e0b' : '#22c55e';
          return (
            <Polyline key={`drop-${onu.id}`}
              positions={[
                [parseFloat(parent.latitude), parseFloat(parent.longitude)],
                [parseFloat(onu.latitude), parseFloat(onu.longitude)],
              ]}
              pathOptions={{ color, weight: 2, opacity: 0.8 }}
            />
          );
        })}

        {/* Marker Infra */}
        {infras.map(infra => {
          const isDown = infra.interfaces?.some(i => i.available === '2') || false;
          const isMikro = infra.name.toLowerCase().includes('mikrotik');
          const iconComp = isMikro ? <MikrotikIcon down={isDown} /> : <OltIcon down={isDown} />;
          return (
            <Marker
              key={infra.hostid}
              position={[parseFloat(infra.inventory.location_lat), parseFloat(infra.inventory.location_lon)]}
              icon={createIcon(iconComp, [38, 38])}
            >
              <Popup>
                <InfoCard>
                  <div style={pp.head}>
                    <div style={{ ...pp.icon, background: isDown ? '#fff1f2' : isMikro ? '#f3e8ff' : '#dbeafe' }}>
                      {isMikro ? '🔀' : '📡'}
                    </div>
                    <div>
                      <div style={pp.name}>{infra.name}</div>
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
              </Popup>
            </Marker>
          );
        })}

        {/* Marker ODP */}
        {odps.map(odp => {
          const terisi = onus.filter(o => o.odp_id === odp.id).length;
          const isFull = terisi >= odp.total_port;
          const pct = odp.total_port > 0 ? Math.round((terisi / odp.total_port) * 100) : 0;
          return (
            <Marker
              key={`odp-${odp.id}`}
              position={[parseFloat(odp.latitude), parseFloat(odp.longitude)]}
              icon={createIcon(<OdpIcon full={isFull} />, [32, 32])}
            >
              <Popup>
                <InfoCard>
                  <div style={pp.head}>
                    <div style={{ ...pp.icon, background: isFull ? '#fff7ed' : '#f0fdf4' }}>🔌</div>
                    <div>
                      <div style={pp.name}>{odp.name}</div>
                      <div style={pp.sub}>Optical Distribution Point</div>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Port terpakai</span>
                    <span style={{ ...pp.val, color: isFull ? '#ef4444' : '#16a34a' }}>{terisi} / {odp.total_port}</span>
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
              </Popup>
            </Marker>
          );
        })}

        {/* Marker ONU */}
        {onus.map(onu => {
          const rx = parseFloat(onu.rx_power);
          const isCritical = rx <= -27;
          const isWarning = rx <= -25 && !isCritical;
          const level = isCritical ? 'critical' : isWarning ? 'warning' : 'ok';
          const rxColor = isCritical ? '#ef4444' : isWarning ? '#d97706' : '#16a34a';
          return (
            <Marker
              key={`onu-${onu.id}`}
              position={[parseFloat(onu.latitude), parseFloat(onu.longitude)]}
              icon={createIcon(<OnuIcon level={level} />, [28, 28])}
            >
              <Popup>
                <InfoCard>
                  <div style={pp.head}>
                    <div style={{ ...pp.icon, background: isCritical ? '#fff1f2' : isWarning ? '#fffbeb' : '#f0fdf4' }}>🏠</div>
                    <div>
                      <div style={pp.name}>{onu.customer || 'Pelanggan'}</div>
                      <div style={pp.sub} title={onu.mac_address}>
                        {onu.mac_address.length > 14 ? onu.mac_address.slice(0, 14) + '…' : onu.mac_address}
                      </div>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Redaman (Rx)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SignalBars rx={rx} />
                      <span style={{ ...pp.val, color: rxColor }}>{onu.rx_power} dBm</span>
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
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
