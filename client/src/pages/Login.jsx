import { useState } from 'react';
import { describeError } from '../api.js';
import { useAuth } from '../auth.jsx';
import Notice from '../components/Notice.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>ComplianceIQ</h1>
        <p className="muted">
          {mode === 'login' ? 'Sign in to continue' : 'Create a customer account to start your KYC application'}
        </p>
        <Notice error={error} />
        {mode === 'register' && (
          <label>
            Full name
            <input value={form.name} onChange={update('name')} required minLength={2} />
          </label>
        )}
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={update('password')} required minLength={mode === 'login' ? 1 : 8} />
        </label>
        <button className="primary" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New customer? Create an account' : 'Already registered? Sign in'}
        </button>
      </form>
    </div>
  );
}
