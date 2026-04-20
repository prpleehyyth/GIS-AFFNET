import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './login.module.css';

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Login | AFF NET GIS";
  }, []);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        // PERBAIKAN: Simpan flag login ke Local Storage
        localStorage.setItem('auth_token', data.token || 'true');
        navigate('/dashboard');
      } else {
        setError(data.error || 'Username atau password salah.');
      }
    } catch {
      setError('Gagal menghubungi server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Brand */}
        <div className={styles.brand}>
          <img
            src="/logoicon.png"
            alt="Logo AFF NET"
            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
          />
          <div className={styles.brandName}>AFF NET</div>
          <div className={styles.brandSub}>GIS Platform · NOC Dashboard</div>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Username</label>
            <input
              className={styles.fieldInput}
              type="text"
              placeholder="Masukkan username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Password</label>
            <div className={styles.passwordWrap}>
              <input
                className={styles.fieldInput}
                type={showPass ? 'text' : 'password'}
                placeholder="Masukkan password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.showPassBtn}
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading}
          >
            {isLoading ? 'Memverifikasi...' : 'Masuk'}
          </button>
        </form>

      </div>
    </div>
  );
}