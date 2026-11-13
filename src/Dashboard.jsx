// src/Dashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />,
};
const Icon = ({ name }) => <svg className="icon" viewBox="0 0 24 24">{ICONS[name]}</svg>;

const Dashboard = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching logs:', error);
    else setLogs(data);
    setLoading(false);
  };

  const handleDelete = async (log) => {
    if (!window.confirm(`Are you sure you want to delete the record for ${log.employee_id}?`)) return;

    try {
      const fileName = log.photo_url.split('/').pop();
      if (fileName) {
        const { error: storageError } = await supabase.storage.from('attendance-photos').remove([fileName]);
        if (storageError) console.error('Could not delete image from storage:', storageError);
      }

      const { error: dbError } = await supabase.from('attendance_logs').delete().eq('id', log.id);
      if (dbError) throw dbError;

      setLogs((prev) => prev.filter((item) => item.id !== log.id));
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete the record. Check the console for details.');
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await supabase.auth.signOut();
      window.location.href = '/';
    }
  };

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: logs.length,
      in: logs.filter((l) => l.type === 'in').length,
      out: logs.filter((l) => l.type === 'out').length,
      today: logs.filter((l) => new Date(l.created_at).toDateString() === today).length,
    };
  }, [logs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) =>
      (filter === 'all' || l.type === filter) &&
      (!q || String(l.employee_id).toLowerCase().includes(q))
    );
  }, [logs, filter, query]);

  return (
    <div className="shell">
      <aside className="side">
        <nav className="side-nav">
          <button className="side-item active" type="button">
            <span className="side-ico"><Icon name="grid" /></span>Dashboard
          </button>
          <a className="side-item" href="/">
            <span className="side-ico"><Icon name="scan" /></span>Scanner
          </a>
          <button className="side-item" type="button" onClick={handleLogout}>
            <span className="side-ico"><Icon name="logout" /></span>Logout
          </button>
        </nav>
      </aside>

      <main className="main glass">
        <div className="main-top">
          <div>
            <p className="crumb">Admin</p>
            <h1>Attendance</h1>
          </div>
          <div className="top-actions">
            <button className="btn ghost" onClick={fetchLogs}><Icon name="refresh" /> Refresh</button>
          </div>
        </div>

        <section className="stats">
          <div className="stat hero"><span>Total records</span><strong>{stats.total}</strong></div>
          <div className="stat in"><span>Time In</span><strong>{stats.in}</strong></div>
          <div className="stat out"><span>Time Out</span><strong>{stats.out}</strong></div>
          <div className="stat"><span>Today</span><strong>{stats.today}</strong></div>
        </section>

        <div className="toolbar">
          <h3>All Records</h3>
          <div className="tools">
            <input className="search" type="search" placeholder="Search name…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="seg">
              {['all', 'in', 'out'].map((f) => (
                <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="empty">Loading records...</p>
        ) : logs.length === 0 ? (
          <p className="empty">No attendance records found yet.</p>
        ) : visible.length === 0 ? (
          <p className="empty">No records match your filter.</p>
        ) : (
          <section className="logs">
            {visible.map((log) => (
              <article key={log.id} className={`log ${log.type}`}>
                <div className="log-head">
                  <a href={log.photo_url} target="_blank" rel="noopener noreferrer" title="View full size">
                    <img className="log-photo" src={log.photo_url} alt="Employee" />
                  </a>
                  <div className="log-info">
                    <p className="log-id">{log.employee_id}</p>
                    <span className={`badge ${log.type}`}>Time {log.type.toUpperCase()}</span>
                  </div>
                </div>
                <div className="log-foot">
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                  <button className="del" onClick={() => handleDelete(log)} title="Delete record" aria-label="Delete record">
                    <Icon name="trash" />
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default Dashboard;