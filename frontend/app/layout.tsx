import type { Metadata } from 'next';
import './globals.css';

// Pastikan path import ini sesuai dengan lokasi file Navbar kamu
import Navbar from '@/components/Navbar';



export const metadata: Metadata = {
  title: {
    // %s akan digantikan oleh judul dari masing-masing halaman
    template: "%s | AFF NET GIS",
    // Judul default jika halaman tidak menentukan judulnya sendiri
    default: "AFF NET GIS Platform",
  },
  description: "Sistem Informasi Geografis dan Manajemen Jaringan AFF NET",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: '#f9fafb', // Warna abu-abu sangat muda biar bersih
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>

        {/* Navbar akan selalu nempel di atas di semua halaman */}
        <Navbar />

        {/* 'children' ini adalah tempat di mana isi halaman (page.tsx) kamu akan dirender */}
        <main style={{ flex: 1 }}>
          {children}
        </main>

      </body>
    </html>
  );
}