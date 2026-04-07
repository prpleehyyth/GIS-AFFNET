"use client";

import { Notif, Severity } from './NotifPanel';

// ── Types ─────────────────────────────────────────────────────
export interface Onu {
  id: number;
  mac_address: string;
  customer: string;
  latitude: string;
  longitude: string;
  rx_power: string;
  odp_id?: number | null;
}
export interface Odp {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  total_port: number;
}
export interface Infra {
  hostid: string;
  name: string;
  interfaces?: { type: string; available: string }[];
  inventory: { location_lat: string; location_lon: string };
}

// ── Marker icon components ────────────────────────────────────
// Dibungkus div bulat putih agar konsisten dengan versi Leaflet

interface IconWrapProps {
  size?: number;
  pulse?: boolean;
  children: React.ReactNode;
}

export function IconWrap({ size = 36, pulse = false, children }: IconWrapProps) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {pulse && (
        <>
          <span style={{
            position: 'absolute', inset: -7, borderRadius: '50%',
            border: '2.5px solid #ef4444', opacity: 0,
            animation: 'mapPulse 1.5s ease-out infinite',
          }} />
          <span style={{
            position: 'absolute', inset: -7, borderRadius: '50%',
            border: '2.5px solid #ef4444', opacity: 0,
            animation: 'mapPulse 1.5s ease-out .5s infinite',
          }} />
        </>
      )}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: '#fff', border: '2px solid #e4e7ef',
        boxShadow: '0 2px 8px rgba(0,0,0,.14)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

// OLT icon
export function OltIcon({ down }: { down: boolean }) {
  return (
    <IconWrap size={38} pulse={down}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="6" width="18" height="10" rx="2"
          fill={down ? '#fecaca' : '#dbeafe'}
          stroke={down ? '#ef4444' : '#3b82f6'} strokeWidth="1.5" />
        <circle cx="6" cy="11" r="1.5" fill={down ? '#ef4444' : '#3b82f6'} />
        <circle cx="10" cy="11" r="1.5" fill={down ? '#ef4444' : '#22c55e'} />
        <rect x="13" y="9" width="5" height="4" rx="1"
          fill={down ? '#ef4444' : '#3b82f6'} opacity={0.7} />
        <rect x="7" y="3" width="8" height="3" rx="1"
          fill={down ? '#ef4444' : '#6366f1'} opacity={0.6} />
      </svg>
    </IconWrap>
  );
}

// MikroTik icon
export function MikrotikIcon({ down }: { down: boolean }) {
  return (
    <IconWrap size={38} pulse={down}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="7" width="18" height="8" rx="2"
          fill={down ? '#fecaca' : '#f3e8ff'}
          stroke={down ? '#ef4444' : '#9333ea'} strokeWidth="1.5" />
        <rect x="4" y="9" width="3" height="4" rx="0.5"
          fill={down ? '#ef4444' : '#9333ea'} opacity={0.8} />
        <rect x="9" y="9" width="3" height="4" rx="0.5"
          fill={down ? '#ef4444' : '#9333ea'} opacity={0.6} />
        <rect x="14" y="9" width="3" height="4" rx="0.5"
          fill={down ? '#ef4444' : '#9333ea'} opacity={0.4} />
        <path d="M5 7V4M11 7V4M17 7V4"
          stroke={down ? '#ef4444' : '#9333ea'} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </IconWrap>
  );
}

// ODP icon
export function OdpIcon({ full }: { full: boolean }) {
  return (
    <IconWrap size={32}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="16" height="12" rx="2"
          fill={full ? '#fff7ed' : '#f0fdf4'}
          stroke={full ? '#f59e0b' : '#16a34a'} strokeWidth="1.5" />
        <circle cx="6" cy="10" r="1.5" fill={full ? '#f59e0b' : '#16a34a'} />
        <circle cx="10" cy="10" r="1.5" fill={full ? '#f59e0b' : '#16a34a'} opacity={0.7} />
        <circle cx="14" cy="10" r="1.5" fill={full ? '#f59e0b' : '#16a34a'} opacity={0.35} />
        <rect x="8" y="2" width="4" height="2" rx="0.5"
          fill={full ? '#f59e0b' : '#16a34a'} opacity={0.6} />
      </svg>
    </IconWrap>
  );
}

// ONU icon
export function OnuIcon({ level }: { level: 'ok' | 'warning' | 'critical' }) {
  const c = level === 'ok'
    ? { bg: '#f0fdf4', s: '#16a34a', d: '#16a34a' }
    : level === 'warning'
    ? { bg: '#fffbeb', s: '#d97706', d: '#d97706' }
    : { bg: '#fff1f2', s: '#ef4444', d: '#ef4444' };
  return (
    <IconWrap size={28} pulse={level === 'critical'}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="5" width="14" height="8" rx="2"
          fill={c.bg} stroke={c.s} strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2" fill={c.d} />
        <path d="M6 5V3M12 5V3" stroke={c.s} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </IconWrap>
  );
}

// ── Signal bars ───────────────────────────────────────────────
export function SignalBars({ rx }: { rx: number }) {
  const bars = rx >= -20 ? 4 : rx >= -23 ? 3 : rx >= -25 ? 2 : rx >= -27 ? 1 : 0;
  const col  = rx <= -27 ? '#ef4444' : rx <= -25 ? '#f59e0b' : '#16a34a';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {[1, 2, 3, 4].map(b => (
        <span key={b} style={{
          width: 4, borderRadius: 1, height: 4 + b * 2.5,
          background: b <= bars ? col : '#e4e7ef',
          display: 'inline-block',
        }} />
      ))}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────
export function StatusBadge({ ok, okLabel = 'ONLINE', failLabel = 'OFFLINE' }: {
  ok: boolean; okLabel?: string; failLabel?: string;
}) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: ok ? '#f0fdf4' : '#fff1f2',
      color:      ok ? '#16a34a' : '#ef4444',
      border:     `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
    }}>
      {ok ? okLabel : failLabel}
    </span>
  );
}

// ── Popup style tokens ────────────────────────────────────────
export const pp: Record<string, React.CSSProperties> = {
  wrap:  { fontFamily: "'Plus Jakarta Sans',sans-serif", minWidth: 190, padding: 2 },
  head:  { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 },
  icon:  { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 },
  name:  { fontWeight: 700, fontSize: 13, color: '#111827', lineHeight: 1.3 },
  sub:   { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  row:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px solid #f3f4f6' },
  lbl:   { fontSize: 11, color: '#6b7280' },
  val:   { fontSize: 12, fontWeight: 600, color: '#111827' },
  badge: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
};

// ── Build notifs ──────────────────────────────────────────────
// buildNotifs hanya deteksi kondisi error — timestamp dihandle di Map.tsx
// supaya ts tidak berubah selama error masih berlangsung
export function buildNotifs(onus: Onu[], infras: Infra[]): Omit<Notif, 'seen' | 'ts'>[] {
  const list: Omit<Notif, 'seen' | 'ts'>[] = [];

  infras.forEach(infra => {
    if (infra.interfaces?.some(i => i.available === '2')) {
      const isMikro = infra.name.toLowerCase().includes('mikrotik');
      list.push({
        id: `infra-${infra.hostid}`, severity: 'critical' as Severity,
        title: `${infra.name} DOWN`,
        desc: `Perangkat ${isMikro ? 'router' : 'OLT'} tidak merespons`,
      });
    }
  });

  onus.forEach(onu => {
    const rx = parseFloat(onu.rx_power);
    if (rx <= -27) {
      list.push({
        id: `onu-crit-${onu.id}`, severity: 'critical' as Severity,
        title: onu.customer || onu.mac_address,
        desc: `Sinyal kritis: ${onu.rx_power} dBm`,
      });
    } else if (!onu.latitude || !onu.longitude) {
      list.push({
        id: `onu-noloc-${onu.id}`, severity: 'info' as Severity,
        title: onu.customer || onu.mac_address,
        desc: 'ONU belum memiliki koordinat lokasi',
      });
    }
  });

  return list;
}