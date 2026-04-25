import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToString } from 'react-dom/server';
import MarkerClusterGroup from 'react-leaflet-cluster';

import {
  Onu, Odp, Infra,
  OltIcon, MikrotikIcon, OdcIcon, OdpIcon, OnuIcon,
  SignalBars, StatusBadge, pp,
} from './Components';
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

// ── Helper: create L.divIcon from React component ─────────────
const createIcon = (comp: React.ReactElement, size: [number, number]) => {
  return L.divIcon({
    html: renderToString(comp),
    className: 'custom-leaflet-icon',
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -size[1] / 2],
  });
};

// ── Helper: custom cluster icon ───────────────────────────────
const createCoreClusterIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  
  // Kita bikin desain icon server core yang elegan
  return L.divIcon({
    html: renderToString(
      <div style={{
        width: 44,
        height: 44,
        background: '#1E293B', // Warna dark slate yang elegan
        color: '#fff',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 14,
        border: '3px solid #38BDF8', // Border biru terang khas networking
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        position: 'relative'
      }}>
        {/* Ikon kecil untuk nandain ini rak server */}
        <span style={{ position: 'absolute', top: -8, fontSize: 16 }}>🖥️</span>
        {count}
      </div>
    ),
    className: 'custom-leaflet-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// ── Popup card ────────────────────────────────────────────────
function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans',sans-serif",
      background: '#fff',
      borderRadius: 12,
      minWidth: 200,
      position: 'relative',
    }}>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MapView() {
  const [isMounted, setIsMounted]   = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [onus,   setOnus]           = useState<Onu[]>([]);
  const [infras, setInfras]         = useState<Infra[]>([]);
  const [odps,   setOdps]           = useState<Odp[]>([]);

  useEffect(() => { setIsMounted(true); }, []);

  const fetchAll = useCallback(async () => {
    try {
      const opts = { credentials: 'include' as RequestCredentials };
      const [onuData, infraData, odpData] = await Promise.all([
        fetch('/api/onu',         opts).then(r => r.json()),
        fetch('/api/zabbix-infra',opts).then(r => r.ok ? r.json() : { result: [] }).catch(() => ({ result: [] })),
        fetch('/api/odp',         opts).then(r => r.json()),
      ]);

      const allOnus   = Array.isArray(onuData)   ? onuData   : (onuData.result   || []);
      const allInfras = Array.isArray(infraData)  ? infraData : (infraData.result || []);
      const allOdps   = Array.isArray(odpData)    ? odpData   : (odpData.result   || []);

      setOnus  (allOnus  .filter((o: Onu)   => o.latitude && o.longitude));
      setInfras(allInfras.filter((i: Infra) => i.inventory?.location_lat && i.inventory?.location_lon));
      setOdps  (allOdps  .filter((o: Odp)   => o.latitude && o.longitude));
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

  if (!isMounted) return null;

  return (
    <div className={styles.mapWrap} style={{ position: 'relative' }}>

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.7)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, color: '#374151',
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

        {/* ── Backbone: MikroTik ↔ OLT ──────────────────────── */}
        {mikrotik && olt && (
          <Polyline
            positions={[
              [parseFloat(mikrotik.inventory.location_lat), parseFloat(mikrotik.inventory.location_lon)],
              [parseFloat(olt.inventory.location_lat),      parseFloat(olt.inventory.location_lon)],
            ]}
            pathOptions={{
              color:     coreDown ? '#EF4444' : '#6366F1',
              weight:    4,
              opacity:   0.85,
              dashArray: '10, 8',
            }}
          />
        )}

        {/* ── Trunk: OLT → ODC ──────────────────────────────── */}
        {olt && odps.filter(o => o.type === 'ODC').map(odc => (
          <Polyline
            key={`trunk-odc-${odc.id}`}
            positions={[
              [parseFloat(olt.inventory.location_lat), parseFloat(olt.inventory.location_lon)],
              [parseFloat(odc.latitude),               parseFloat(odc.longitude)],
            ]}
            pathOptions={{ color: coreDown ? '#EF4444' : '#3B82F6', weight: 4, opacity: 0.9 }}
          />
        ))}

        {/* ── Distribusi: ODC → ODP ─────────────────────────── */}
        {odps.filter(o => o.type === 'ODP' && o.odc_id).map(odp => {
          const parentOdc = odps.find(x => x.id === odp.odc_id);
          if (!parentOdc) return null;
          return (
            <Polyline
              key={`dist-${odp.id}`}
              positions={[
                [parseFloat(parentOdc.latitude), parseFloat(parentOdc.longitude)],
                [parseFloat(odp.latitude),       parseFloat(odp.longitude)],
              ]}
              pathOptions={{ color: '#10B981', weight: 3, opacity: 0.8 }}
            />
          );
        })}

        {/* ── Drop: ODP → ONU ───────────────────────────────── */}
        {onus.filter(o => o.odp_id).map(onu => {
          const parent = odps.find(o => o.id === onu.odp_id);
          if (!parent) return null;
          const rx    = parseFloat(onu.rx_power);
          const color = rx <= -27 ? '#EF4444' : rx <= -25 ? '#F59E0B' : '#22C55E';
          return (
            <Polyline
              key={`drop-${onu.id}`}
              positions={[
                [parseFloat(parent.latitude), parseFloat(parent.longitude)],
                [parseFloat(onu.latitude),    parseFloat(onu.longitude)],
              ]}
              pathOptions={{ color, weight: 2, opacity: 0.75 }}
            />
          );
        })}

        {/* @ts-ignore - Bypass TS error karena type bawaan library kurang lengkap */}
        <MarkerClusterGroup iconCreateFunction={createCoreClusterIcon}>
          {infras.map(infra => {
            const isDown  = infra.interfaces?.some(i => i.available === '2') || false;
            const isMikro = infra.name.toLowerCase().includes('mikrotik');
            const iconEl  = isMikro
              ? <MikrotikIcon down={isDown} />
              : <OltIcon      down={isDown} />;
            const iconSize: [number, number] = isMikro ? [38, 38] : [40, 40];

            return (
              <Marker
                key={infra.hostid}
                // Pakai koordinat asli, nggak usah ditambah/dikurang 0.00015 lagi
                position={[
                  parseFloat(infra.inventory.location_lat),
                  parseFloat(infra.inventory.location_lon),
                ]}
                icon={createIcon(iconEl, iconSize)}
              >
                <Popup>
                  <InfoCard>
                    <div style={pp.head}>
                      <div style={{
                        ...pp.icon,
                        background: isDown ? '#FFF1F2' : isMikro ? '#F3E8FF' : '#DBEAFE',
                      }}>
                        {isMikro ? '🔀' : '📡'}
                      </div>
                      <div>
                        <div style={pp.name}>{infra.name}</div>
                        <div style={pp.sub}>{isMikro ? 'Router Core' : 'Optical Line Terminal'}</div>
                      </div>
                    </div>
                    <div style={pp.row}>
                      <span style={pp.lbl}>Status</span>
                      <StatusBadge ok={!isDown} />
                    </div>
                    <div style={pp.row}>
                      <span style={pp.lbl}>Tipe</span>
                      <span style={{ ...pp.val, color: isMikro ? '#7C3AED' : '#2563EB' }}>
                        {isMikro ? 'MikroTik' : 'OLT HIOSO'}
                      </span>
                    </div>
                  </InfoCard>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {/* ── Marker: ODC ───────────────────────────────────── */}
        {odps.filter(o => o.type === 'ODC').map(odc => (
          <Marker
            key={`odc-${odc.id}`}
            position={[parseFloat(odc.latitude), parseFloat(odc.longitude)]}
            icon={createIcon(<OdcIcon full={false} />, [36, 36])} 
          >
            <Popup>
              <InfoCard>
                <div style={pp.head}>
                  <div style={{ ...pp.icon, background: '#EDE9FE' }}>🔀</div>
                  <div>
                    <div style={pp.name}>{odc.name}</div>
                    <div style={pp.sub}>Optical Distribution Cabinet</div>
                  </div>
                </div>
                <div style={pp.row}>
                  <span style={pp.lbl}>Tipe</span>
                  <span style={{ ...pp.val, color: '#6D28D9' }}>ODC Splitter</span>
                </div>
                <div style={pp.row}>
                  <span style={pp.lbl}>ODP terhubung</span>
                  <span style={pp.val}>
                    {odps.filter(o => o.type === 'ODP' && o.odc_id === odc.id).length}
                  </span>
                </div>
              </InfoCard>
            </Popup>
          </Marker>
        ))}

        {/* ── Marker: ODP ───────────────────────────────────── */}
        {odps.filter(o => o.type === 'ODP').map(odp => {
          const terisi = onus.filter(o => o.odp_id === odp.id).length;
          const pct    = odp.total_port > 0 ? Math.round((terisi / odp.total_port) * 100) : 0;
          const level: 'ok' | 'warn' | 'full' =
            pct >= 100 ? 'full' : pct >= 75 ? 'warn' : 'ok';
          const levelColor =
            level === 'full' ? '#EF4444' : level === 'warn' ? '#EA580C' : '#16A34A';

          return (
            <Marker
              key={`odp-${odp.id}`}
              position={[parseFloat(odp.latitude), parseFloat(odp.longitude)]}
              icon={createIcon(<OdpIcon level={level} />, [32, 32])}
            >
              <Popup>
                <InfoCard>
                  <div style={pp.head}>
                    <div style={{
                      ...pp.icon,
                      background: level === 'full' ? '#FFF1F2' : level === 'warn' ? '#FFF7ED' : '#F0FDF4',
                    }}>
                      🔌
                    </div>
                    <div>
                      <div style={pp.name}>{odp.name}</div>
                      <div style={pp.sub}>Optical Distribution Point</div>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Port terpakai</span>
                    <span style={{ ...pp.val, color: levelColor }}>
                      {terisi} / {odp.total_port}
                    </span>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Kapasitas</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 60, height: 4, background: '#E4E7EF',
                        borderRadius: 2, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: levelColor, borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ ...pp.val, fontSize: 11 }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Status</span>
                    <StatusBadge
                      ok={level === 'ok'}
                      okLabel="Tersedia"
                      failLabel={level === 'full' ? 'Penuh' : 'Hampir Penuh'}
                    />
                  </div>
                </InfoCard>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Marker: ONU ───────────────────────────────────── */}
        {onus.map(onu => {
          const rx         = parseFloat(onu.rx_power);
          const isCritical = rx <= -27;
          const isWarning  = rx > -27 && rx <= -25;
          const level      = isCritical ? 'critical' : isWarning ? 'warning' : 'ok';
          const rxColor    = isCritical ? '#EF4444'  : isWarning ? '#D97706' : '#16A34A';

          return (
            <Marker
              key={`onu-${onu.id}`}
              position={[parseFloat(onu.latitude), parseFloat(onu.longitude)]}
              icon={createIcon(<OnuIcon level={level} />, [28, 28])}
            >
              <Popup>
                <InfoCard>
                  <div style={pp.head}>
                    <div style={{
                      ...pp.icon,
                      background: isCritical ? '#FFF1F2' : isWarning ? '#FFFBEB' : '#F0FDF4',
                    }}>
                      🏠
                    </div>
                    <div>
                      <div style={pp.name}>{onu.customer || 'Pelanggan'}</div>
                      <div style={pp.sub} title={onu.mac_address}>
                        {onu.mac_address.length > 14
                          ? onu.mac_address.slice(0, 14) + '…'
                          : onu.mac_address}
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
                      ...pp.badge,
                      color:      rxColor,
                      background: isCritical ? '#FFF1F2' : isWarning ? '#FFFBEB' : '#F0FDF4',
                      border:     `1px solid ${isCritical ? '#FECACA' : isWarning ? '#FDE68A' : '#BBF7D0'}`,
                    }}>
                      {isCritical ? 'Kritis' : isWarning ? 'Warning' : 'Aman'}
                    </span>
                  </div>
                  {onu.odp_id && (
                    <div style={pp.row}>
                      <span style={pp.lbl}>ODP</span>
                      <span style={pp.val}>
                        {odps.find(o => o.id === onu.odp_id)?.name || `#${onu.odp_id}`}
                      </span>
                    </div>
                  )}
                </InfoCard>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>
    </div>
  );
}