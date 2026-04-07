"use client";

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Odp, OdpForm, OdpTable, OdpModal, DeleteConfirmModal } from './components';
import styles from './odp.module.css';

const BASE_URL  = 'http://localhost:8888/api/odp';
const EMPTY: OdpForm = { name: '', latitude: '', longitude: '', total_port: 8 };

export default function OdpPage() {
  const [odps,            setOdps]            = useState<Odp[]>([]);
  const [form,            setForm]            = useState<OdpForm>(EMPTY);
  const [editId,          setEditId]          = useState<number | null>(null);
  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isLoading,       setIsLoading]       = useState(false);

  // ── API calls ──────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const res  = await fetch(BASE_URL);
    const data = await res.json();
    setOdps(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const url    = editId ? `${BASE_URL}/${editId}` : BASE_URL;
    const method = editId ? 'PUT' : 'POST';
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { closeModal(); await refresh(); }
    setIsLoading(false);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId === null) return;
    await fetch(`${BASE_URL}/${deleteConfirmId}`, { method: 'DELETE' });
    setDeleteConfirmId(null);
    await refresh();
  };

  // ── Modal helpers ──────────────────────────────────────────
  const openCreate = () => { setEditId(null); setForm(EMPTY); setIsModalOpen(true); };
  const openEdit   = (odp: Odp) => { setEditId(odp.id); setForm({ name: odp.name, latitude: odp.latitude, longitude: odp.longitude, total_port: odp.total_port }); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditId(null); setForm(EMPTY); };

  // ── Derived stats ──────────────────────────────────────────
  const totalAvailable = odps.reduce((acc, o) => acc + (o.total_port - (o.onus?.length || 0)), 0);
  const fullCount      = odps.filter(o => (o.onus?.length || 0) >= o.total_port).length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📡</div>
          <div>
            <div className={styles.headerTitle}>Manajemen ODP</div>
            <div className={styles.headerSub}>Optical Distribution Point — Kelola titik distribusi jaringan fiber</div>
          </div>
        </div>
        <Link href="/" className={styles.backBtn}>← Kembali ke Peta</Link>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total ODP</div>
          <div className={styles.statValue}>{odps.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Port Tersedia</div>
          <div className={`${styles.statValue} ${styles.green}`}>{totalAvailable}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>ODP Penuh</div>
          <div className={`${styles.statValue} ${styles.red}`}>{fullCount}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.sectionTitle}>Daftar ODP ({odps.length} titik)</div>
        <button className={styles.createBtn} onClick={openCreate}>+ Tambah ODP</button>
      </div>

      {/* Table */}
      <OdpTable odps={odps} onEdit={openEdit} onDelete={setDeleteConfirmId} />

      {/* Modal create / edit */}
      {isModalOpen && (
        <OdpModal
          editId={editId} form={form} setForm={setForm}
          existingOdps={odps} isLoading={isLoading}
          onClose={closeModal} onSubmit={handleSubmit}
          onMapClick={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
        />
      )}

      {/* Modal hapus */}
      {deleteConfirmId !== null && (
        <DeleteConfirmModal onCancel={() => setDeleteConfirmId(null)} onConfirm={confirmDelete} />
      )}
    </div>
  );
}