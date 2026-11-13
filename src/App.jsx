// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AttendanceScanner from './AttendanceScanner';
import Dashboard from './Dashboard';
import Login from './Login';
import { supabase } from './supabaseClient';
import './App.css';

const ADMIN_EMAIL = 'admin@nemintsco.com';

const AdminRoute = ({ session }) => {
  if (!session || session.user.email !== ADMIN_EMAIL) {
    return <Navigate to="/login" replace />;
  }
  return <Dashboard />;
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="screen"><p className="splash">Loading App...</p></div>;
  }

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AttendanceScanner />} />
        <Route path="/login" element={isAdmin ? <Navigate to="/admin" replace /> : <Login />} />
        <Route path="/admin" element={<AdminRoute session={session} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;