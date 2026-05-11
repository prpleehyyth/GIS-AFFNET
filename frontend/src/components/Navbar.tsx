import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import styles from './navbar.module.css';

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
      alert(`Error dari browser: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: '▦' },
    { href: '/odp', label: 'Manajemen ODP', icon: '⬡' },
    { href: '/onu', label: 'Manajemen ONU', icon: '⊡' },
    { href: '/map', label: 'Peta Topologi', icon: '◈' },
    { href: '/logs', label: 'Event Logs', icon: '📋' },
  ];

  return (
    <nav className={styles.nav}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          {/* PERBAIKAN: Path diawali '/' dan tambahkan styling agar tidak luber */}
          <img src="/logoonly.png" alt="AFF NET Logo" className={styles.logoImg} />
        </div>
        <div className={styles.brandText}>
          <div className={styles.brandName}>AFF NET</div>
          <div className={styles.brandSub}>GIS Platform</div>
        </div>
      </div>

      {/* Mobile Toggle */}
      <button 
        className={styles.mobileToggle} 
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? '✕' : '☰'}
      </button>

      {/* Menu */}
      <div className={`${styles.menu} ${isMobileOpen ? styles.menuOpen : ''}`}>
        <div className={styles.links}>
          {navLinks.map(({ href, label, icon }) => (
            <Link
              key={href}
              to={href}
              className={`${styles.link} ${pathname === href ? styles.linkActive : ''}`}
              onClick={() => setIsMobileOpen(false)}
            >
              <span className={styles.linkIcon}>{icon}</span>
              {label}
            </Link>
          ))}
        </div>

        <div className={styles.right}>
          <div className={styles.separator} />
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}