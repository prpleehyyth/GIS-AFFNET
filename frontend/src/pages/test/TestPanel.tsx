import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function TestPanel() {
  const [macInput, setMacInput] = useState<string>("44:22:95:49:71:68");

  useEffect(() => {
    document.title = "Test Panel | AFF NET GIS";
  }, []);

  const handleTest = async (scenarioId: number) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/test-onu-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ scenario: scenarioId, mac_address: macInput || "44:22:95:49:71:68" })
      });
      const data = await res.json();
      alert(`Hasil:\n${data.message || data.error}`);
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
      <p style={{ color: '#aaa', marginBottom: '20px' }}>
        Halaman ini tersembunyi dari Navbar. Gunakan tombol di bawah ini untuk mensimulasikan ONU mati.
      </p>

      <div style={{ marginBottom: '30px', background: '#1e1e1e', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Target MAC Address:</label>
        <input 
          type="text" 
          value={macInput}
          onChange={(e) => setMacInput(e.target.value)}
          placeholder="Contoh: 44:22:95:49:71:68"
          style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #555', background: '#2a2a2a', color: '#fff', fontSize: '16px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
        <button 
          onClick={() => handleTest(1)}
          style={{ padding: '16px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', textAlign: 'left' }}
        >
          🚨 Skenario 1: ONU Dimatikan (Down)
        </button>
      </div>

    </div>
  );
}
