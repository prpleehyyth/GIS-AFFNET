import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';

// Pages
import Dashboard from '@/pages/dashboard/Dashboard';
import Login from '@/pages/login/Login';
import Logs from '@/pages/logs/Logs';
import MapPage from '@/pages/map/MapPage';
import Odp from '@/pages/odp/Odp';
import Onu from '@/pages/onu/Onu';
import TestPanel from '@/pages/test/TestPanel';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // PERBAIKAN: Baca dari Local Storage
  const hasToken = localStorage.getItem('auth_token');

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RootRedirect = () => {
  // PERBAIKAN: Baca dari Local Storage
  const hasToken = localStorage.getItem('auth_token');

  if (hasToken) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/odp" element={<Odp />} />
          <Route path="/onu" element={<Onu />} />
          <Route path="/test-panel" element={<TestPanel />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}