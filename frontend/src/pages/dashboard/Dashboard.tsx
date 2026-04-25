import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Onu, Odp, Infra,
  CoreStatusCard,
  OdcStatusCard,
  OdpCapacityCard,
  OnuHealthCard,
  LoadingScreen
} from './components';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const [onus, setOnus] = useState<Onu[]>([]);
  const [infras, setInfras] = useState<Infra[]>([]);
  const [odps, setOdps] = useState<Odp[]>([]);
  const [odcs, setOdcs] = useState<Odp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [infraError, setInfraError] = useState(false);

  useEffect(() => {

    document.title = "Dashboard | AFF NET GIS";

    // ✅ UBAH KETIGA FETCH MENJADI RELATIVE PATH:
    Promise.all([
      fetch('/api/onu', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/zabbix-infra', { credentials: 'include' })
        .then(r => { if (!r.ok) { setInfraError(true); return { result: [] }; } return r.json(); })
        .catch(() => { setInfraError(true); return { result: [] }; }),
      fetch('/api/odp', { credentials: 'include' }).then(r => r.json()),
    ]).then(([onuData, infraData, odpData]) => {
      const rawInfras = Array.isArray(infraData) ? infraData : (infraData.result || []);
      const rawOdps = Array.isArray(odpData) ? odpData : (odpData.result || []);
      const rawOnus = Array.isArray(onuData) ? onuData : (onuData.result || []);

      setOnus(rawOnus);
      setInfras(rawInfras);
      setOdps(rawOdps.filter((o: Odp) => o.type === 'ODP' || !o.type));
      setOdcs(rawOdps.filter((o: Odp) => o.type === 'ODC'));
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  if (isLoading) return <LoadingScreen />;

  // ── Core ───────────────────────────────────────────────────
  const mikrotik = infras.find(i => i.name.toLowerCase().includes('mikrotik'));
  const olt = infras.find(i => i.name.toLowerCase().includes('olt'));
  const isOltDown = olt?.interfaces?.some(i => i.available === '2') || false;
  const isMikrotikDown = mikrotik?.interfaces?.some(i => i.available === '2') || false;

  // ── ONU ───────────────────────────────────────────────────
  const totalOnu = onus.length;
  const criticalOnu = onus.filter(o => parseFloat(o.rx_power) <= -27).length;
  const warningOnu = onus.filter(o => parseFloat(o.rx_power) <= -25 && parseFloat(o.rx_power) > -27).length;
  const safeOnu = totalOnu - criticalOnu - warningOnu;

  // ── ODC ───────────────────────────────────────────────────
  const totalOdc = odcs.length;
  const odcUsage = odcs.map(odc => {
    const connected = odps.filter(o => o.odc_id === odc.id).length;
    return { ...odc, connected, pct: odc.total_port > 0 ? Math.round((connected / odc.total_port) * 100) : 0 };
  });
  const fullOdcs = odcUsage.filter(o => o.pct > 80).length;
  const avgOdcUsage = totalOdc > 0 ? odcUsage.reduce((s, o) => s + o.pct, 0) / totalOdc : 0;

  // ── ODP ───────────────────────────────────────────────────
  const totalOdp = odps.length;
  const totalPorts = odps.reduce((s, o) => s + (o.total_port || 0), 0);
  const usedPorts = onus.filter(o => o.odp_id).length;
  const freePorts = totalPorts - usedPorts;
  const usagePercent = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0;

  // ── Quick links ────────────────────────────────────────────
  const quickLinks = [
    { href: '/odp', icon: '📡', label: 'Manajemen ODP & ODC' },
    { href: '/onu', icon: '🏠', label: 'Manajemen ONU' },
    { href: '/map', icon: '🗺️', label: 'Peta Topologi' },
    {
      href: '/logs', icon: '📋', label: 'Event Logs',
      badge: criticalOnu > 0 ? criticalOnu : undefined
    },
  ];

  return (
    <div className={styles.page}>

      {/* Header */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AFF NET · FTTH</p>
          <h1 className={styles.title}>Network Overview</h1>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.lastUpdate}>
            Diperbarui: {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
          </span>
          <Link to="/map" className={styles.mapBtn}>Peta Jaringan →</Link>
        </div>
      </header>

      <div className={styles.divider} />

      {/* Cards */}
      <div className={styles.grid}>
        <CoreStatusCard isOltDown={isOltDown} isMikrotikDown={isMikrotikDown} infraUnreachable={infraError} />
        <OdcStatusCard totalOdc={totalOdc} fullOdcs={fullOdcs} avgOdcUsage={avgOdcUsage} />
        <OdpCapacityCard totalOdp={totalOdp} totalPorts={totalPorts} usedPorts={usedPorts} freePorts={freePorts} usagePercent={usagePercent} />
        <OnuHealthCard totalOnu={totalOnu} safeOnu={safeOnu} warningOnu={warningOnu} criticalOnu={criticalOnu} />
      </div>



    </div>
  );
}