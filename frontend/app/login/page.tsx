"use client";

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Nembak lewat jalur Nginx (path relatif)
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        // 2. WAJIB ADA: Biar browser ngizinin Golang nyimpen HttpOnly Cookie
        credentials: 'include',
      });

      const data = await res.json();

      // 3. Cuma cek res.ok (200 OK), nggak perlu nyari data.token lagi
      if (res.ok) {
        // Backend otomatis nge-set cookie 'token'. Kita gak usah document.cookie lagi.
        // 4. Pakai Hard Redirect biar proxy.ts mereset cache dan ngebaca cookie baru
        window.location.href = '/dashboard';
      } else {
        // Tampilkan pesan error dari backend kalau password salah
        setError(data.error || 'Gagal login, periksa kembali data Anda.');
      }
    } catch (err) {
      setError('Gagal menghubungi server Backend.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
      <form onSubmit={handleLogin} style={{ background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#1f2937' }}>📡 AFF NET</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Login NOC (JWT Auth)</p>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '5px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#374151' }}>Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#374151' }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
        
        <button type="submit" disabled={isLoading} style={{ marginTop: '10px', width: '100%', padding: '12px', background: isLoading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
          {isLoading ? 'Memverifikasi...' : 'Masuk Jaringan'}
        </button>
      </form>
    </div>
  );
}