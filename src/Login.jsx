// src/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (email !== 'admin@nemintsco.com') {
      setMessage('❌ Access Denied: Only the admin account is allowed.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/admin');
    } catch (error) {
      setMessage('❌ Error: Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <form onSubmit={handleAuth} className="auth-card glass">
        <div className="brand"><span className="brand-mark">N</span>nemintsco</div>
        <h2>Admin Login</h2>
        <p className="auth-sub">Sign in to manage attendance records</p>

        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="" autoComplete="email" />
        </label>

        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password" />
        </label>

        <button type="submit" disabled={loading} className="btn">{loading ? 'Logging in...' : 'Log In'}</button>

        {message && <p className="msg err">{message}</p>}

        <a href="/" className="back-link">← Back to Scanner</a>
      </form>
    </div>
  );
};

export default Login;