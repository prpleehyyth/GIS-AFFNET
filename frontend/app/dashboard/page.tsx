"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Onu, Odp, Infra, CoreStatusCard, OdpCapacityCard, OnuHealthCard, LoadingScreen } from './components';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const [onus,      setOnus]      = useState<Onu[]>([]);
  const [infras,    setInfras]    = useState<Infra[]>([]);
  const [odps,      setOdps]      = useState<Odp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:8888/api/onu').then(r => r.json()),
      fetch('http://localhost:8888/api/zabbix-infra').then(r => r.json()),
      fetch('http://localhost:8888/api/odp').then(r => r.json()),
    ]).then(([onuData, infraData, odpData]) => {
      setOnus(Array.isArray(onuData)   ? onuData   : (onuData.result   || []));
      setInfras(Array.isArray(infraData) ? infraData : (infraData.result || []));
      setOdps(Array.isArray(odpData)   ? odpData   : (odpData.result   || []));
      setIsLoading(false);
    }).catch(err => {
      console.error('Gagal mengambil data:', err);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return <LoadingScreen />;

  // ── Derived values ─────────────────────────────────────────
  const mikrotik       = infras.find(i => i.name.toLowerCase().includes('mikrotik'));
  const olt            = infras.find(i => i.name.toLowerCase().includes('olt'));
  const isOltDown      = olt?.interfaces?.some(i => i.available === '2') || false;
  const isMikrotikDown = mikrotik?.interfaces?.some(i => i.available === '2') || false;

  const totalOnu    = onus.length;
  const criticalOnu = onus.filter(o => parseFloat(o.rx_power) <= -27).length;
  const warningOnu  = onus.filter(o => parseFloat(o.rx_power) <= -25 && parseFloat(o.rx_power) > -27).length;
  const safeOnu     = totalOnu - criticalOnu - warningOnu;

  const totalOdp      = odps.length;
  const totalPorts    = odps.reduce((sum, o) => sum + (o.total_port || 0), 0);
  const usedPorts     = onus.filter(o => o.odp_id).length;
  const freePorts     = totalPorts - usedPorts;
  const usagePercent  = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0;

  return (
    <div className={styles.page}>

      {/* Header */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AFF NET · FTTH</p>
          <h1 className={styles.title}>Network Overview</h1>
        </div>
        <Link href="/map" className={styles.mapBtn}>Peta Jaringan →</Link>
      </header>

      <div className={styles.divider} />

      {/* Cards */}
      <div className={styles.grid}>
        <CoreStatusCard isOltDown={isOltDown} isMikrotikDown={isMikrotikDown} />
        <OdpCapacityCard
          totalOdp={totalOdp}
          totalPorts={totalPorts}
          usedPorts={usedPorts}
          freePorts={freePorts}
          usagePercent={usagePercent}
        />
        <OnuHealthCard
          totalOnu={totalOnu}
          safeOnu={safeOnu}
          warningOnu={warningOnu}
          criticalOnu={criticalOnu}
        />
      </div>

    </div>
  );
}