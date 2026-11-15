// src/Dashboard.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />,
  download: <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};
const Icon = ({ name }) => <svg className="icon" viewBox="0 0 24 24">{ICONS[name]}</svg>;

const PAGE = 24;
const DAY = 864e5;
const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dkey = (d) => new Date(d).toLocaleDateString('en-CA');
const ekey = (l) => String(l.employee_id || '').trim().toLowerCase();
const byNew = (a, b) => new Date(b.created_at) - new Date(a.created_at);
const monday = (d) => new Date(sod(d).getTime() - ((d.getDay() + 6) % 7) * DAY);
const clock = (mins) => { const h = Math.floor(mins / 60), m = Math.round(mins % 60); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

const rel = (iso, now) => {
  const d = new Date(iso), s = (now - d) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400 && sod(d).getTime() === sod(now).getTime()) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.round((sod(now) - sod(d)) / DAY);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const Dashboard = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [count, setCount] = useState(PAGE);
  const [now, setNow] = useState(new Date());
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [lightId, setLightId] = useState(null);
  const [emp, setEmp] = useState(null);
  const [chartMode, setChartMode] = useState('daily');
  const searchRef = useRef(null);
  const sentinel = useRef(null);
  const pending = useRef(new Map());

  // ---------- toasts ----------
  const toast = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type: opts.type || 'info', action: opts.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3500);
    return id;
  }, []);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  // ---------- data ----------
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('attendance_logs').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching logs:', error); toast('Could not load records.', { type: 'error' }); }
    else setLogs(data);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  // ---------- optimistic delete + undo ----------
  const handleDelete = (log) => {
    setLogs((p) => p.filter((i) => i.id !== log.id));
    if (lightId === log.id) setLightId(null);
    const timer = setTimeout(async () => {
      pending.current.delete(log.id);
      try {
        const fileName = log.photo_url?.split('/').pop();
        if (fileName) {
          const { error } = await supabase.storage.from('attendance-photos').remove([fileName]);
          if (error) console.error('Could not delete image from storage:', error);
        }
        const { error: dbError } = await supabase.from('attendance_logs').delete().eq('id', log.id);
        if (dbError) throw dbError;
      } catch (e) {
        console.error(e);
        setLogs((p) => [...p, log].sort(byNew));
        toast(`Failed to delete ${log.employee_id}. Restored.`, { type: 'error' });
      }
    }, 5000);
    pending.current.set(log.id, timer);
    toast(`Deleted ${log.employee_id}'s record`, {
      duration: 5000,
      action: { label: 'Undo', fn: () => { clearTimeout(timer); pending.current.delete(log.id); setLogs((p) => [...p, log].sort(byNew)); } },
    });
  };

  const handleLogout = () => setConfirm({
    title: 'Log out?', text: 'You will return to the scanner page.', label: 'Log out',
    onYes: async () => { await supabase.auth.signOut(); window.location.href = '/'; },
  });

  // ---------- filtering ----------
  const inRange = useCallback((l) => {
    const t = new Date(l.created_at), today = sod(now);
    if (range === 'today') return t >= today;
    if (range === 'yesterday') return t >= new Date(today - DAY) && t < today;
    if (range === 'week') return t >= monday(now);
    if (range === 'custom') {
      if (from && t < new Date(from + 'T00:00:00')) return false;
      if (to && t > new Date(to + 'T23:59:59')) return false;
    }
    return true;
  }, [range, from, to, now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => (filter === 'all' || l.type === filter) && inRange(l) && (!q || ekey(l).includes(q)));
  }, [logs, filter, query, inRange]);

  useEffect(() => { setCount(PAGE); }, [filter, query, range, from, to]);
  const shown = visible.slice(0, count);

  // infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setCount((c) => c + PAGE); }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown.length, visible.length]);

  const stats = useMemo(() => {
    const today = sod(now);
    return {
      total: logs.length,
      in: logs.filter((l) => l.type === 'in').length,
      out: logs.filter((l) => l.type === 'out').length,
      today: logs.filter((l) => new Date(l.created_at) >= today).length,
    };
  }, [logs, now]);

  // ---------- chart ----------
  const chart = useMemo(() => {
    const buckets = [];
    const today = sod(now);
    if (chartMode === 'daily') {
      for (let i = 6; i >= 0; i--) { const d = new Date(today - i * DAY); buckets.push({ key: dkey(d), label: d.toLocaleDateString(undefined, { weekday: 'short' }), in: 0, out: 0 }); }
      logs.forEach((l) => { const b = buckets.find((x) => x.key === dkey(l.created_at)); if (b) b[l.type]++; });
    } else {
      const m0 = monday(now);
      for (let i = 7; i >= 0; i--) { const d = new Date(m0.getTime() - i * 7 * DAY); buckets.push({ start: d, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), in: 0, out: 0 }); }
      logs.forEach((l) => { const t = new Date(l.created_at); for (let i = buckets.length - 1; i >= 0; i--) if (t >= buckets[i].start) { buckets[i][l.type]++; break; } });
    }
    return buckets;
  }, [logs, chartMode, now]);
  const chartMax = Math.max(1, ...chart.map((b) => Math.max(b.in, b.out)));

  // ---------- employee summary ----------
  const summary = useMemo(() => {
    if (!emp) return null;
    const recs = logs.filter((l) => ekey(l) === emp.key).sort(byNew);
    const ins = recs.filter((l) => l.type === 'in');
    const avg = ins.length ? ins.reduce((s, l) => { const d = new Date(l.created_at); return s + d.getHours() * 60 + d.getMinutes(); }, 0) / ins.length : null;
    const days = new Set(recs.map((l) => dkey(l.created_at)));
    let streak = 0, cur = sod(now);
    if (!days.has(dkey(cur))) cur = new Date(cur - DAY);
    while (days.has(dkey(cur))) { streak++; cur = new Date(cur - DAY); }
    return { recs, avg, days: days.size, streak };
  }, [emp, logs, now]);

  // ---------- lightbox ----------
  const lightIdx = lightId ? visible.findIndex((l) => l.id === lightId) : -1;
  const light = lightIdx >= 0 ? visible[lightIdx] : null;
  const stepLight = (dir) => { if (visible.length) setLightId(visible[(lightIdx + dir + visible.length) % visible.length].id); };

  // ---------- export ----------
  const exportCSV = () => {
    if (!visible.length) return toast('Nothing to export.', { type: 'error' });
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Name', 'Type', 'Date', 'Time', 'Photo URL'], ...visible.map((l) => {
      const d = new Date(l.created_at);
      return [l.employee_id, l.type === 'in' ? 'Time In' : 'Time Out', d.toLocaleDateString(), d.toLocaleTimeString(), l.photo_url];
    })];
    const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${dkey(new Date())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    toast(`Exported ${visible.length} records`, { type: 'success' });
  };

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const h = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null); else if (lightId) setLightId(null); else if (emp) setEmp(null); else if (query) setQuery('');
        if (typing) e.target.blur();
        return;
      }
      if (lightId) { if (e.key === 'ArrowRight') stepLight(1); if (e.key === 'ArrowLeft') stepLight(-1); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key.toLowerCase() === 'r') fetchLogs();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const chips = [['all', 'All time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week']];

  return (
    <div className="shell">
      <aside className="side">
        <nav className="side-nav">
          <button className="side-item active" type="button"><span className="side-ico"><Icon name="grid" /></span>Dashboard</button>
          <a className="side-item" href="/"><span className="side-ico"><Icon name="scan" /></span>Scanner</a>
          <button className="side-item" type="button" onClick={handleLogout}><span className="side-ico"><Icon name="logout" /></span>Logout</button>
        </nav>
      </aside>

      <main className="main glass">
        <div className="main-top">
          <div><p className="crumb">Admin</p><h1>Attendance</h1></div>
          <div className="top-actions">
            <button className="btn ghost" onClick={exportCSV}><Icon name="download" /> Export CSV</button>
            <button className="btn ghost" onClick={fetchLogs} title="Refresh (R)"><Icon name="refresh" /> Refresh</button>
          </div>
        </div>

        <section className="stats">
          {loading ? [0, 1, 2, 3].map((i) => <div key={i} className="stat sk" />) : <>
            <div className="stat hero"><span>Total records</span><strong>{stats.total}</strong></div>
            <div className="stat in"><span>Time In</span><strong>{stats.in}</strong></div>
            <div className="stat out"><span>Time Out</span><strong>{stats.out}</strong></div>
            <div className="stat"><span>Today</span><strong>{stats.today}</strong></div>
          </>}
        </section>

        <section className="chart-card">
          <div className="toolbar">
            <h3>Attendance trends</h3>
            <div className="seg">
              {['daily', 'weekly'].map((m) => <button key={m} className={chartMode === m ? 'active' : ''} onClick={() => setChartMode(m)}>{m === 'daily' ? 'Daily' : 'Weekly'}</button>)}
            </div>
          </div>
          {loading ? <div className="sk" style={{ height: 170 }} /> : (
            <div className="chart">
              {chart.map((b, i) => (
                <div className="bar-col" key={i} title={`${b.label}: ${b.in} in, ${b.out} out`}>
                  <div className="bars">
                    <div className="bar in" style={{ height: `${(b.in / chartMax) * 100}%` }}>{b.in > 0 && <i>{b.in}</i>}</div>
                    <div className="bar out" style={{ height: `${(b.out / chartMax) * 100}%` }}>{b.out > 0 && <i>{b.out}</i>}</div>
                  </div>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="legend"><span><i className="in" /> Time In</span><span><i className="out" /> Time Out</span></div>
        </section>

        <div className="sticky-bar">
          <div className="tools">
            <input ref={searchRef} className="search" type="search" placeholder="Search name…  ( / )" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="seg">
              {['all', 'in', 'out'].map((f) => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}</button>)}
            </div>
          </div>
          <div className="tools">
            <div className="seg wrap">
              {chips.map(([k, l]) => <button key={k} className={range === k ? 'active' : ''} onClick={() => { setRange(k); setFrom(''); setTo(''); }}>{l}</button>)}
            </div>
            <label className="date"><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setRange('custom'); }} /></label>
            <label className="date"><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setRange('custom'); }} /></label>
          </div>
        </div>

        <div className="toolbar"><h3>All Records</h3><span className="crumb">{loading ? '' : `Showing ${shown.length} of ${visible.length}`}</span></div>

        {loading ? (
          <section className="logs">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="log sk" style={{ height: 130 }} />)}</section>
        ) : logs.length === 0 ? (
          <p className="empty">No attendance records found yet.</p>
        ) : visible.length === 0 ? (
          <p className="empty">No records match your filters.</p>
        ) : (
          <>
            <section className="logs">
              {shown.map((log) => (
                <article key={log.id} className={`log ${log.type}`}>
                  <div className="log-head">
                    <button className="photo-btn" onClick={() => setLightId(log.id)} title="View photo" aria-label="View photo">
                      <img className="log-photo" src={log.photo_url} alt={log.employee_id} loading="lazy" decoding="async" />
                    </button>
                    <div className="log-info">
                      <button className="log-id link" onClick={() => setEmp({ key: ekey(log), name: log.employee_id })} title="View summary">{log.employee_id}</button>
                      <span className={`badge ${log.type}`}>Time {log.type.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="log-foot">
                    <span title={new Date(log.created_at).toLocaleString()}>{rel(log.created_at, now)}</span>
                    <button className="del" onClick={() => handleDelete(log)} title="Delete record" aria-label="Delete record"><Icon name="trash" /></button>
                  </div>
                </article>
              ))}
            </section>
            {shown.length < visible.length && (
              <div ref={sentinel} className="more"><button className="btn ghost" onClick={() => setCount((c) => c + PAGE)}>Load more</button></div>
            )}
          </>
        )}
      </main>

      {/* ---------- Lightbox ---------- */}
      {light && (
        <div className="overlay dark" onClick={() => setLightId(null)}>
          <button className="lb-nav l" onClick={(e) => { e.stopPropagation(); stepLight(-1); }} aria-label="Previous"><Icon name="left" /></button>
          <figure className="lb" onClick={(e) => e.stopPropagation()}>
            <img src={light.photo_url} alt={light.employee_id} />
            <figcaption>
              <strong>{light.employee_id}</strong>
              <span className={`badge ${light.type}`}>Time {light.type.toUpperCase()}</span>
              <small>{new Date(light.created_at).toLocaleString()} · {lightIdx + 1}/{visible.length}</small>
            </figcaption>
          </figure>
          <button className="lb-nav r" onClick={(e) => { e.stopPropagation(); stepLight(1); }} aria-label="Next"><Icon name="right" /></button>
          <button className="lb-close" onClick={() => setLightId(null)} aria-label="Close"><Icon name="close" /></button>
        </div>
      )}

      {/* ---------- Employee summary ---------- */}
      {summary && (
        <div className="overlay" onClick={() => setEmp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>{emp.name}</h3><button className="del" onClick={() => setEmp(null)} aria-label="Close"><Icon name="close" /></button></div>
            <div className="emp-stats">
              <div><strong>{summary.recs.length}</strong><span>Records</span></div>
              <div><strong>{summary.days}</strong><span>Days present</span></div>
              <div><strong>{summary.avg == null ? '—' : clock(summary.avg)}</strong><span>Avg time-in</span></div>
              <div><strong>{summary.streak} 🔥</strong><span>Day streak</span></div>
            </div>
            <ul className="emp-list">
              {summary.recs.slice(0, 12).map((l) => (
                <li key={l.id}><span className={`badge ${l.type}`}>{l.type.toUpperCase()}</span><span>{new Date(l.created_at).toLocaleString()}</span><small>{rel(l.created_at, now)}</small></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ---------- Confirm modal ---------- */}
      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm.title}</h3><p className="crumb">{confirm.text}</p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn red" onClick={() => { const f = confirm.onYes; setConfirm(null); f(); }}>{confirm.label}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Toasts ---------- */}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.msg}</span>
            {t.action && <button onClick={() => { t.action.fn(); dismiss(t.id); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;