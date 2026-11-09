import { useState } from 'react';
import { Download, KeyRound, Plus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import api, { downloadFile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useLoad from '../hooks/useLoad';
import { Alert, Empty, Field, PageHeader, Pagination, Spinner, fmtDate, fmtDateTime, label } from '../components/ui';

/* ---------------------------------- Users --------------------------------- */

function CreateUser({ isSuper, onCreated }) {
  const blank = { name: '', email: '', password: '', role: 'FACULTY', department: '' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setOk(''); setBusy(true);
    try { await api.post('/admin/users', form); setOk(`Account created for ${form.email}`); setForm(blank); onCreated(); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="card p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <h2 className="font-bold sm:col-span-2 lg:col-span-3">Create faculty or admin account</h2>
      <Field label="Full name"><input className="field" value={form.name} onChange={set('name')} required minLength={2} /></Field>
      <Field label="Email"><input className="field" type="email" value={form.email} onChange={set('email')} required /></Field>
      <Field label="Temporary password" hint="10+ characters. Ask the user to change it after first sign-in."><input className="field" type="text" value={form.password} onChange={set('password')} required minLength={10} autoComplete="off" /></Field>
      <Field label="Role">
        <select className="field" value={form.role} onChange={set('role')}>
          <option value="FACULTY">Faculty</option>
          {isSuper && <option value="ADMIN">Admin</option>}
          {isSuper && <option value="SUPER_ADMIN">Super Admin</option>}
        </select>
      </Field>
      <Field label="Department" hint="Faculty receive submissions from students in the same department."><input className="field" value={form.department} onChange={set('department')} /></Field>
      <div className="flex items-end"><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Create account</button></div>
      <div className="sm:col-span-2 lg:col-span-3"><Alert>{error}</Alert><Alert type="success">{ok}</Alert></div>
    </form>
  );
}

export function Users() {
  const { user: me } = useAuth();
  const isSuper = me.role === 'SUPER_ADMIN';
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const { data, error, loading, reload } = useLoad(
    () => api.get('/admin/users', { params: { page, ...(role ? { role } : {}), ...(search ? { q: search } : {}) } }).then((r) => r.data),
    [page, role, search]
  );

  const manageable = (u) => isSuper || ['STUDENT', 'FACULTY'].includes(u.role);
  const toggle = async (u) => {
    try { await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive }); setMsg({ type: 'success', text: `${u.name} ${u.isActive ? 'deactivated' : 'reactivated'}` }); reload(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };
  const reset = async (u) => {
    const password = window.prompt(`New temporary password for ${u.name} (10+ characters). They will be signed out everywhere.`);
    if (!password) return;
    try { await api.post(`/admin/users/${u._id}/reset-password`, { password }); setMsg({ type: 'success', text: `Password reset for ${u.name}` }); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <div>
      <PageHeader title="User management" subtitle="Provision faculty and admin accounts, and manage access." />
      <CreateUser isSuper={isSuper} onCreated={reload} />
      <div className="flex flex-wrap gap-2 mb-3">
        <form className="flex gap-2 flex-1 min-w-[200px]" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}>
          <input className="field" placeholder="Search name, email or department" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
          <button className="btn btn-secondary">Search</button>
        </form>
        <select className="field !w-auto" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role">
          <option value="">All roles</option>{['STUDENT', 'FACULTY', 'ADMIN', 'SUPER_ADMIN'].map((r) => <option key={r} value={r}>{label(r)}</option>)}
        </select>
      </div>
      <Alert>{error}</Alert><Alert type={msg.type}>{msg.text}</Alert>
      <div className="card overflow-x-auto mt-3">
        {loading && !data ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>{['Name', 'Email', 'Role', 'Department', 'Status', ''].map((h) => <th className="th" key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {(data?.users || []).map((u) => (
                <tr className="border-t" key={u._id}>
                  <td className="td font-semibold">{u.name}</td><td className="td">{u.email}</td><td className="td">{label(u.role)}</td><td className="td">{u.department || '—'}</td>
                  <td className="td"><span className={`pill ${u.isActive ? 'status-APPROVED' : 'status-REJECTED'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="td text-right whitespace-nowrap">
                    {manageable(u) && u._id !== me.id && (
                      <>
                        <button className="btn btn-secondary btn-sm mr-2" onClick={() => reset(u)} title="Reset password"><KeyRound size={14} /> Reset</button>
                        <button className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-secondary'}`} onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !data?.users?.length && <Empty>No users match.</Empty>}
        <Pagination page={data?.page || 1} pages={data?.pages} onChange={setPage} />
      </div>
    </div>
  );
}

/* --------------------------------- Policy --------------------------------- */

export function Policy() {
  const { data: policy, reload: reloadActive } = useLoad(() => api.get('/admin/credit-policy').then((r) => r.data.policy), []);
  const { data: history, reload: reloadHistory } = useLoad(() => api.get('/admin/credit-policies').then((r) => r.data.policies), []);
  return <PolicyForm key={policy?._id || 'none'} policy={policy} history={history || []} onSaved={() => { reloadActive(); reloadHistory(); }} />;
}

function PolicyForm({ policy, history, onSaved }) {
  const [form, setForm] = useState({
    name: policy?.name || 'Institution policy',
    weeksPerCredit: policy?.weeksPerCredit ?? 4,
    minimumScore: policy?.minimumScore ?? 0,
    maxCreditsPerStudent: policy?.maxCreditsPerStudent ?? 20,
    eligiblePlatforms: (policy?.eligiblePlatforms || []).join(', '),
  });
  const [msg, setMsg] = useState({ type: 'success', text: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/credit-policy', {
        name: form.name, weeksPerCredit: Number(form.weeksPerCredit), minimumScore: Number(form.minimumScore),
        maxCreditsPerStudent: Number(form.maxCreditsPerStudent),
        eligiblePlatforms: form.eligiblePlatforms.split(',').map((x) => x.trim()).filter(Boolean),
      });
      setMsg({ type: 'success', text: 'New policy version saved. It applies to future approvals only; existing awards are unchanged.' });
      onSaved();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Credit policy" subtitle="Rules used to convert approved certificates into academic credits. Every save creates a new version." />
      <form className="card p-6 grid sm:grid-cols-2 gap-4" onSubmit={submit}>
        <Field className="sm:col-span-2" label="Policy name"><input className="field" value={form.name} onChange={set('name')} required /></Field>
        <Field label="Weeks per credit" hint="Credits = floor(duration ÷ weeks per credit)."><input className="field" type="number" min="1" max="52" step="any" value={form.weeksPerCredit} onChange={set('weeksPerCredit')} required /></Field>
        <Field label="Minimum assessment score (%)" hint="0 = no score needed. Above 0, a score must be provided."><input className="field" type="number" min="0" max="100" value={form.minimumScore} onChange={set('minimumScore')} required /></Field>
        <Field label="Maximum credits per student"><input className="field" type="number" min="0" value={form.maxCreditsPerStudent} onChange={set('maxCreditsPerStudent')} required /></Field>
        <Field label="Eligible platforms" hint="Comma separated. Leave blank to allow all."><input className="field" value={form.eligiblePlatforms} onChange={set('eligiblePlatforms')} placeholder="NPTEL, Coursera" /></Field>
        <div className="sm:col-span-2"><Alert type={msg.type}>{msg.text}</Alert></div>
        <div className="sm:col-span-2"><button className="btn btn-primary">Save as new version</button></div>
      </form>
      <h2 className="font-bold mt-8 mb-3">Version history</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr>{['Name', 'Weeks/credit', 'Min score', 'Max credits', 'Platforms', 'Created', ''].map((h) => <th className="th" key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {history.map((p) => (
              <tr className="border-t" key={p._id}>
                <td className="td font-semibold">{p.name}</td><td className="td">{p.weeksPerCredit}</td><td className="td">{p.minimumScore}%</td><td className="td">{p.maxCreditsPerStudent}</td>
                <td className="td">{p.eligiblePlatforms?.length ? p.eligiblePlatforms.join(', ') : 'All'}</td>
                <td className="td">{fmtDate(p.createdAt)}{p.createdBy?.name ? ` · ${p.createdBy.name}` : ''}</td>
                <td className="td">{p.active && <span className="pill status-APPROVED">Active</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!history.length && <Empty>No policy yet. The system falls back to 4 weeks per credit and a 20-credit cap.</Empty>}
      </div>
    </div>
  );
}

/* --------------------------------- Reports -------------------------------- */

const STATUS_COLORS = { APPROVED: '#16a34a', REJECTED: '#dc2626', PENDING: '#d97706', UNDER_REVIEW: '#f59e0b', CORRECTION_REQUIRED: '#ea580c' };

export function Reports() {
  const { data, error, loading } = useLoad(() => api.get('/admin/reports').then((r) => r.data), []);
  const [err, setErr] = useState('');
  const exportCsv = async () => { try { await downloadFile('/admin/reports/credits.csv', 'awarded-credits.csv'); } catch (e) { setErr(e.message); } };
  if (loading) return <Spinner />;
  if (!data) return <Alert>{error}</Alert>;
  const total = data.byStatus.reduce((a, s) => a + s.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Submission and credit activity across the institution.">
        <button className="btn btn-secondary" onClick={exportCsv}><Download size={16} /> Export credits (CSV)</button>
      </PageHeader>
      <Alert>{err}</Alert>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[['Submissions', total], ['Credits awarded', data.totalCredits], ['Students', data.users.STUDENT || 0], ['Faculty', data.users.FACULTY || 0]].map(([k, v]) => (
          <div className="card p-5" key={k}><div className="text-sm muted">{k}</div><div className="text-3xl font-extrabold mt-2">{v}</div></div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="font-bold mb-2">Submissions by status</h2>
          {total ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.byStatus.map((s) => ({ name: label(s.status), value: s.count, key: s.status }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {data.byStatus.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] || '#64748b'} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty>No submissions yet.</Empty>}
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-2">Submissions per month</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={30} /><Tooltip /><Bar dataKey="count" name="Submissions" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-2">Top platforms</h2>
          {data.byPlatform.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byPlatform} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="platform" width={80} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="count" name="Submissions" fill="#4f46e5" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <Empty>No data yet.</Empty>}
        </div>
        <div className="card p-5">
          <h2 className="font-bold mb-2">Credits by department</h2>
          {data.creditsByDepartment.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.creditsByDepartment} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="department" width={110} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="credits" name="Credits" fill="#16a34a" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <Empty>No credits awarded yet.</Empty>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Audit --------------------------------- */

export function Audit() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useLoad(() => api.get('/admin/audit-logs', { params: { page, limit: 30 } }).then((r) => r.data), [page]);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Who did what, and when. Entries cannot be edited from the app." />
      <Alert>{error}</Alert>
      <div className="card overflow-x-auto">
        {loading && !data ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>{['When', 'Actor', 'Action', 'Entity', 'Details'].map((h) => <th className="th" key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {(data?.logs || []).map((l) => (
                <tr className="border-t" key={l._id}>
                  <td className="td whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="td">{l.actor ? `${l.actor.name} (${label(l.actor.role)})` : 'System'}</td>
                  <td className="td font-mono text-xs">{l.action}</td>
                  <td className="td">{l.entityType}</td>
                  <td className="td max-w-sm text-xs muted break-words">{l.details && Object.keys(l.details).length ? JSON.stringify(l.details) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !data?.logs?.length && <Empty>No activity recorded yet.</Empty>}
        <Pagination page={data?.page || 1} pages={data?.pages} onChange={setPage} />
      </div>
    </div>
  );
}
