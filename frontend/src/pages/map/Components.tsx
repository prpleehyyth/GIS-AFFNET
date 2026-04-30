import React from 'react';

// ── Types ─────────────────────────────────────────────────────
export interface Onu {
  id: number;
  mac_address: string;
  customer: string;
  latitude: string;
  longitude: string;
  rx_power: string;
  status?: string;
  updated_at?: string;
  odp_id?: number | null;
}
export interface Odp {
  id: number;
  name: string;
  type: 'ODP' | 'ODC';
  latitude: string;
  longitude: string;
  total_port: number;
  odc_id: number | null;
  onus?: any[];
}
export interface Infra {
  hostid: string;
  name: string;
  interfaces?: { type: string; available: string }[];
  inventory: { location_lat: string; location_lon: string };
}

// ── Wrapper bulat ─────────────────────────────────────────────
interface IconWrapProps {
  size?: number;
  pulse?: boolean;
  rounded?: boolean; // false = pakai border-radius 8px (untuk ODC)
  borderColor?: string;
  children: React.ReactNode;
}

export function IconWrap({
  size = 36,
  pulse = false,
  rounded = true,
  borderColor = '#e4e7ef',
  children,
}: IconWrapProps) {
  const radius = rounded ? '50%' : '8px';
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
        width: size,
        height: size,
        borderRadius: radius,
        background: '#fff',
        border: `1.5px solid ${borderColor}`,
        boxShadow: '0 1px 6px rgba(0,0,0,.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── OLT icon ──────────────────────────────────────────────────
export function OltIcon({ down }: { down: boolean }) {
  const c = down
    ? { bg: '#FCEBEB', stroke: '#E24B4A', port1: '#E24B4A', port2: '#F09595', port3: '#FCEBEB', portBorder: '#F09595', fiber1: '#E24B4A', fiber2: '#F09595', fiber3: '#F7C1C1', uplink: '#E24B4A', led: '#E24B4A', border: '#F7C1C1' }
    : { bg: '#E6F1FB', stroke: '#378ADD', port1: '#378ADD', port2: '#85B7EB', port3: '#E6F1FB', portBorder: '#B5D4F4', fiber1: '#378ADD', fiber2: '#85B7EB', fiber3: '#B5D4F4', uplink: '#378ADD', led: '#16a34a', border: '#B5D4F4' };

  return (
    <IconWrap size={40} pulse={down} borderColor={c.border}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="2" y="7" width="22" height="13" rx="2.5" fill={c.bg} stroke={c.stroke} strokeWidth="1.4" />
        <rect x="4" y="10" width="4" height="3" rx=".8" fill={c.port1} />
        <rect x="9.5" y="10" width="4" height="3" rx=".8" fill={c.port2} />
        <rect x="15" y="10" width="4" height="3" rx=".8" fill={c.port3} stroke={c.portBorder} strokeWidth="1" />
        <line x1="6" y1="13" x2="6" y2="18" stroke={c.fiber1} strokeWidth="1.2" strokeLinecap="round" strokeDasharray={down ? '2 1.5' : undefined} />
        <line x1="11.5" y1="13" x2="11.5" y2="18" stroke={c.fiber2} strokeWidth="1.2" strokeLinecap="round" strokeDasharray={down ? '2 1.5' : undefined} />
        <line x1="17" y1="13" x2="17" y2="18" stroke={c.fiber3} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 1.5" />
        <rect x="9" y="4" width="8" height="3" rx=".8" fill={c.uplink} opacity=".5" />
        <circle cx="22" cy="9" r="1.3" fill={c.led} />
      </svg>
    </IconWrap>
  );
}

// ── MikroTik icon ─────────────────────────────────────────────
export function MikrotikIcon({ down }: { down: boolean }) {
  const c = down
    ? { bg: '#FCEBEB', stroke: '#E24B4A', p1: '#E24B4A', p2: '#F09595', p3: '#FCEBEB', pBorder: '#F09595', ant: '#E24B4A', antDash: '2 1.5', led: '#E24B4A', border: '#F7C1C1' }
    : { bg: '#EEEDFE', stroke: '#7F77DD', p1: '#7F77DD', p2: '#AFA9EC', p3: '#EEEDFE', pBorder: '#CECBF6', ant: '#7F77DD', antDash: undefined, led: '#16a34a', border: '#CECBF6' };

  return (
    <IconWrap size={40} pulse={down} borderColor={c.border}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="2" y="9" width="22" height="10" rx="2.5" fill={c.bg} stroke={c.stroke} strokeWidth="1.4" />
        <rect x="4.5" y="11.5" width="3.5" height="5" rx="1" fill={c.p1} />
        <rect x="10" y="11.5" width="3.5" height="5" rx="1" fill={c.p2} />
        <rect x="15.5" y="11.5" width="3.5" height="5" rx="1" fill={c.p3} stroke={c.pBorder} strokeWidth="1" />
        <line x1="6.5" y1="9" x2="6.5" y2="5" stroke={c.ant} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="13" y1="9" x2="13" y2="5" stroke={c.ant} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="19.5" y1="9" x2="19.5" y2="5" stroke={c.ant} strokeWidth="1.4" strokeLinecap="round" strokeDasharray={c.antDash} />
        <circle cx="21.5" cy="12.5" r="1.2" fill={c.led} />
        {down && (
          <>
            <line x1="19" y1="3" x2="21.5" y2="5.5" stroke="#E24B4A" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="21.5" y1="3" x2="19" y2="5.5" stroke="#E24B4A" strokeWidth="1.3" strokeLinecap="round" />
          </>
        )}
      </svg>
    </IconWrap>
  );
}

// ── ODC icon ─────────────────────────────────────────────────
export function OdcIcon({ full }: { full: boolean }) {
  const c = full
    ? { bg: '#FAEEDA', stroke: '#EF9F27', slot: '#EF9F27', fiber: '#EF9F27', lock: '#EF9F27', border: '#FAC775' }
    : { bg: '#E1F5EE', stroke: '#1D9E75', slot: '#1D9E75', fiber: '#1D9E75', lock: '#1D9E75', border: '#9FE1CB' };

  return (
    <IconWrap size={38} pulse={false} rounded={false} borderColor={c.border}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="18" height="20" rx="2" fill={c.bg} stroke={c.stroke} strokeWidth="1.4" />
        <line x1="12" y1="2" x2="12" y2="22" stroke={c.border} strokeWidth="1" />
        <rect x="4.5" y="5" width="6.5" height="2" rx=".5" fill={c.slot} opacity=".8" />
        <rect x="4.5" y="8.5" width="6.5" height="2" rx=".5" fill={c.slot} opacity=".55" />
        <rect x="4.5" y="12" width="6.5" height="2" rx=".5" fill={c.slot} opacity=".3" />
        <line x1="13" y1="6" x2="20" y2="6" stroke={c.fiber} strokeWidth="1.1" strokeLinecap="round" />
        <line x1="13" y1="9.5" x2="20" y2="9.5" stroke={c.fiber} strokeWidth="1.1" strokeLinecap="round" opacity=".7" />
        <line x1="13" y1="13" x2="20" y2="13" stroke={c.fiber} strokeWidth="1.1" strokeLinecap="round" opacity=".4" />
        <circle cx="12" cy="17" r="1.5" fill={c.lock} opacity=".6" />
      </svg>
    </IconWrap>
  );
}

// ── ODP icon ─────────────────────────────────────────────────
export function OdpIcon({ level }: { level: 'ok' | 'warn' | 'full' }) {
  const c = level === 'full'
    ? { bg: '#FCEBEB', stroke: '#E24B4A', p1: '#E24B4A', p2: '#E24B4A', p3op: '.8', cable: '#E24B4A', led: '#E24B4A', border: '#F7C1C1' }
    : level === 'warn'
    ? { bg: '#FAEEDA', stroke: '#EF9F27', p1: '#EF9F27', p2: '#EF9F27', p3op: '.5', cable: '#EF9F27', led: '#EF9F27', border: '#FAC775' }
    : { bg: '#E1F5EE', stroke: '#1D9E75', p1: '#1D9E75', p2: '#1D9E75', p3op: '.2', cable: '#1D9E75', led: '#16a34a', border: '#9FE1CB' };

  return (
    <IconWrap size={34} pulse={false} borderColor={c.border}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="5" width="18" height="12" rx="2" fill={c.bg} stroke={c.stroke} strokeWidth="1.3" />
        <circle cx="6" cy="11" r="1.4" fill={c.p1} />
        <circle cx="11" cy="11" r="1.4" fill={c.p2} opacity=".6" />
        <circle cx="16" cy="11" r="1.4" fill={c.bg} stroke={c.border} strokeWidth="1" opacity={c.p3op} />
        <rect x="8.5" y="2.5" width="5" height="2.5" rx=".7" fill={c.cable} opacity=".5" />
        <circle cx="17.5" cy="6.5" r="1.2" fill={c.led} />
      </svg>
    </IconWrap>
  );
}

// ── ONU icon ─────────────────────────────────────────────────
export function OnuIcon({ level }: { level: 'ok' | 'warning' | 'critical' }) {
  const c =
    level === 'ok'
      ? { bg: '#EAF3DE', stroke: '#639922', arc1: '#639922', arc2: '#639922', arc1dash: undefined, arc2dash: undefined, dot: '#639922', cable: '#639922', led1: '#639922', led2op: '.5', border: '#C0DD97' }
      : level === 'warning'
      ? { bg: '#FAEEDA', stroke: '#EF9F27', arc1: '#EF9F27', arc2: '#EF9F27', arc1dash: undefined, arc2dash: '1.5 1', dot: '#EF9F27', cable: '#EF9F27', led1: '#EF9F27', led2op: '0', border: '#FAC775' }
      : { bg: '#FCEBEB', stroke: '#E24B4A', arc1: '#F09595', arc2: '#E24B4A', arc1dash: '2 1.2', arc2dash: '1.5 1', dot: '#E24B4A', cable: '#E24B4A', led1: '#E24B4A', led2op: '0', border: '#F7C1C1' };

  return (
    <IconWrap size={30} pulse={level === 'critical'} borderColor={c.border}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="6" width="16" height="9" rx="2" fill={c.bg} stroke={c.stroke} strokeWidth="1.2" />
        <path d="M7 9.5 Q10 6.5 13 9.5" stroke={c.arc1} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeDasharray={c.arc1dash} />
        <path d="M8.5 11 Q10 9.5 11.5 11" stroke={c.arc2} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeDasharray={c.arc2dash} />
        <circle cx="10" cy="12.5" r="1" fill={c.dot} />
        <line x1="10" y1="15" x2="10" y2="17.5" stroke={c.cable} strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="4" cy="8" r=".8" fill={c.led1} />
        <circle cx="6" cy="8" r=".8" fill={c.led1} opacity={c.led2op} />
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