import { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alert, Field, PageHeader, label } from '../components/ui';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, department: user.department || '', rollNumber: user.rollNumber || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState({ profile: null, password: null });
  const [busy, setBusy] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try { const r = await api.patch('/auth/profile', form); setUser(r.data.user); setMsg({ ...msg, profile: { ok: true, text: 'Profile updated' } }); }
    catch (err) { setMsg({ ...msg, profile: { ok: false, text: err.message } }); }
    setBusy('');
  };
  const savePassword = async (e) => {
    e.preventDefault();
    setBusy('password');
    try { await api.patch('/auth/password', pw); setPw({ currentPassword: '', newPassword: '' }); setMsg({ ...msg, password: { ok: true, text: 'Password updated. Other devices have been signed out.' } }); }
    catch (err) { setMsg({ ...msg, password: { ok: false, text: err.message } }); }
    setBusy('');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Profile" subtitle={`${user.email} · ${label(user.role)}`} />
      <form className="card p-6 space-y-4" onSubmit={saveProfile}>
        <h2 className="font-bold">Your details</h2>
        <Field label="Full name"><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></Field>
        <Field label="Department" hint={user.role === 'FACULTY' ? 'Student submissions from this department are routed to you.' : ''}><input className="field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
        {user.role === 'STUDENT' && <Field label="Roll number"><input className="field" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} /></Field>}
        <Alert type={msg.profile?.ok ? 'success' : 'error'}>{msg.profile?.text}</Alert>
        <button className="btn btn-primary" disabled={busy === 'profile'}>Save changes</button>
      </form>
      <form className="card p-6 space-y-4" onSubmit={savePassword}>
        <h2 className="font-bold">Change password</h2>
        <Field label="Current password"><input className="field" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></Field>
        <Field label="New password" hint="At least 10 characters."><input className="field" type="password" autoComplete="new-password" minLength={10} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></Field>
        <Alert type={msg.password?.ok ? 'success' : 'error'}>{msg.password?.text}</Alert>
        <button className="btn btn-primary" disabled={busy === 'password'}>Update password</button>
      </form>
    </div>
  );
}
