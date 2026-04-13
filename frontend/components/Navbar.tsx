"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();

  if (pathname === '/login') return null;

  const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); 
    
    try {
      console.log("1. Mengirim request logout ke Nginx/Backend...");
      
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });

      console.log("2. Response diterima dengan status:", response.status);

      if (response.ok) {
        console.log("3. Logout sukses! Mengarahkan ke /login...");
        localStorage.clear(); 
        sessionStorage.clear();
        window.location.href = '/login';
      } else {
        const errText = await response.text();
        console.error("Backend menolak:", errText);
        alert(`Gagal logout dari server. Status: ${response.status}`);
      }

    } catch (error) {
      console.error('Fetch gagal total:', error);
      if (error instanceof Error) {
        alert(`Error dari browser: ${error.message}`);
      } else {
        alert(`Error dari browser: ${String(error)}`);
      }
    }
  };

  const navLinks = [
    { href: '/',     label: 'Dashboard',     icon: '▦' },
    { href: '/odp',  label: 'Manajemen ODP', icon: '⬡' },
    { href: '/onu',  label: 'Manajemen ONU', icon: '⊡' },
    { href: '/map',  label: 'Peta Topologi', icon: '◈' },
    { href: '/logs', label: 'Event Logs',    icon: '📋' },
  ];

  return (
    <nav className={styles.nav}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>📡</div>
        <div>
          <div className={styles.brandName}>AFF NET</div>
          <div className={styles.brandSub}>GIS Platform</div>
        </div>
      </div>

      {/* Links */}
      <div className={styles.links}>
        {navLinks.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.link} ${pathname === href ? styles.linkActive : ''}`}
          >
            <span className={styles.linkIcon}>{icon}</span>
            {label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className={styles.right}>
        <div className={styles.separator} />
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}