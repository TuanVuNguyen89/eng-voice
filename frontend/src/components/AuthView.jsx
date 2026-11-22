import { useState } from 'react';
import { login, makeToken, register, setToken } from '../api';

export default function AuthView({ onAuthed }) {
  const [mode, setMode] = useState('login'); // login | register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(() => localStorage.getItem('speakbot.remember') === '1');

  async function submit(e) {
    e.preventDefault();
    const name = username.trim();
    if (!name || !password) return setError('Enter both username and password');
    if (mode === 'register' && password.length < 6) return setError('Password must be at least 6 characters');

    setError('');
    setBusy(true);
    try {
      setToken(null);
      if (mode === 'register') await register(name, password);
      const token = makeToken(name, password);
      setToken(token);
      const me = await login(); // checks the credentials on the server
      try { localStorage.setItem('speakbot.remember', remember ? '1' : '0'); } catch (e) { /* ignore */ }
      onAuthed({ username: me.username, token }, remember);
    } catch (err) {
      setToken(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
        <label className="field">
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="field">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me on this device
        </label>
        {error && <div className="status err">{error}</div>}
        <button type="submit" className="primary wide" disabled={busy}>
          {busy ? 'Working...' : mode === 'login' ? 'Log in' : 'Sign up and start'}
        </button>
        <button
          type="button"
          className="ghost wide"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        >
          {mode === 'login' ? 'No account yet? Sign up' : 'Already have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
