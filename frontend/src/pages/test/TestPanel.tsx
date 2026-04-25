import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function TestPanel() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Test Panel | AFF NET GIS";
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/logs", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setLogs(data.slice(0, 5)); // Tampilkan 5 log terakhir saja
    } catch (e) {
      console.error(e);
    }
  };

  const handleTest = async (scenarioId: number) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/test-onu-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ scenario: scenarioId, mac_address: "AA:BB:CC:11:22:33" })
      });
      const data = await res.json();
      alert(`Hasil:\n${data.message || data.error}`);
      fetchLogs(); // Refresh logs setelah test
    } catch (err: any) {
      alert("Gagal memanggil API: " + err.message);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
      <Link to="/dashboard" style={{ color: '#aaa', textDecoration: 'none', marginBottom: '20px', display: 'inline-block' }}>
        ← Kembali ke Dashboard
      </Link>
      
      <h1 style={{ marginBottom: '10px' }}>🛠️ Halaman Testing Skenario ONU</h1>
      <p style={{ color: '#aaa', marginBottom: '30px' }}>
        Halaman ini tersembunyi dari Navbar. Gunakan tombol di bawah ini untuk mensimulasikan skenario pengujian.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
        <button 
          onClick={() => handleTest(1)}
          style={{ padding: '16px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', textAlign: 'left' }}
        >
          🚨 Skenario 1: ONU Dimatikan (Down)
        </button>
        
        <button 
          onClick={() => handleTest(2)}
          style={{ padding: '16px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', textAlign: 'left' }}
        >
          ✅ Skenario 2: ONU Diaktifkan Kembali (Up)
        </button>
        
        <button 
          onClick={() => handleTest(3)}
          style={{ padding: '16px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', textAlign: 'left' }}
        >
          📡 Skenario 3: Perangkat ONU Baru Terdeteksi (Auto-Discovery)
        </button>
        
        <button 
          onClick={() => handleTest(4)}
          style={{ padding: '16px', background: '#f39c12', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', textAlign: 'left' }}
        >
          📍 Skenario 4: Mengubah Koordinat Lokasi ONU
        </button>
      </div>

      <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>📋 5 Log Terakhir di Database</h3>
        {logs.length === 0 ? (
          <p style={{ color: '#aaa', margin: 0 }}>Belum ada log...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {logs.map((log: any) => (
              <div key={log.id} style={{ background: '#2a2a2a', padding: '12px', borderRadius: '6px', borderLeft: `4px solid ${log.severity === 'critical' ? '#e74c3c' : '#3498db'}` }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                  {new Date(log.created_at).toLocaleString('id-ID')} • {log.severity.toUpperCase()}
                </div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{log.title}</div>
                <div style={{ fontSize: '14px', color: '#ccc' }}>{log.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
