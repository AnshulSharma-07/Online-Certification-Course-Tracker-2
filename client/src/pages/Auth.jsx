import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert, Field } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';

export default function Auth({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', rollNumber: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form);
      else await login({ email: form.email, password: form.password });
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">
      <div className="hidden md:flex bg-gradient-to-br from-blue-700 to-indigo-900 text-white p-14 flex-col justify-between">
        <div className="flex items-center gap-3"><Award size={30} /><span className="text-2xl font-bold">CertTrack</span></div>
        <div>
          <div className="text-5xl font-extrabold leading-tight">Your learning.<br />Your achievements.<br />One place.</div>
          <p className="text-blue-100 mt-5 max-w-md">Submit credentials, get verified by faculty and track your academic credit progress.</p>
        </div>
        <p className="text-blue-200 text-sm">Academic certification management platform</p>
      </div>
      <div className="relative flex items-center justify-center p-6">
        <ThemeToggle className="absolute top-4 right-4" />
        <form onSubmit={submit} className="w-full max-w-md space-y-5">
          <div className="md:hidden flex items-center gap-2 text-blue-700 font-bold text-xl"><Award /> CertTrack</div>
          <div>
            <h1 className="text-3xl font-extrabold">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
            <p className="muted mt-2">{isRegister ? 'Register as a student to get started.' : 'Sign in to your academic workspace.'}</p>
          </div>
          {isRegister && (
            <>
              <Field label="Full name"><input className="field" name="name" value={form.name} onChange={change} required minLength={2} autoComplete="name" /></Field>
              <Field label="Department" hint="Used to route your submissions to faculty in your department."><input className="field" name="department" value={form.department} onChange={change} /></Field>
              <Field label="Roll number"><input className="field" name="rollNumber" value={form.rollNumber} onChange={change} /></Field>
            </>
          )}
          <Field label="Email"><input className="field" type="email" name="email" value={form.email} onChange={change} required autoComplete="email" /></Field>
          <Field label="Password" hint={isRegister ? 'At least 10 characters.' : ''}>
            <input className="field" type="password" name="password" value={form.password} onChange={change} minLength={isRegister ? 10 : undefined} required autoComplete={isRegister ? 'new-password' : 'current-password'} />
          </Field>
          <Alert>{error}</Alert>
          <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
          <p className="text-sm text-center muted">
            {isRegister ? 'Already registered? ' : 'New student? '}
            <Link className="text-blue-700 font-semibold" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
