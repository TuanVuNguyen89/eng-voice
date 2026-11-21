import { useState } from 'react';
import { login, makeToken, register, setToken } from '../api';

export default function AuthView({ onAuthed }) {
  const [mode, setMode] = useState('login'); // login | register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const name = username.trim();
    if (!name || !password) return setError('Nhập đầy đủ tên đăng nhập và mật khẩu');
    if (mode === 'register' && password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự');

    setError('');
    setBusy(true);
    try {
      setToken(null);
      if (mode === 'register') await register(name, password);
      const token = makeToken(name, password);
      setToken(token);
      const me = await login(); // checks the credentials on the server
      onAuthed({ username: me.username, token });
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
        <h2>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
        <label className="field">
          Tên đăng nhập
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="field">
          Mật khẩu
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {error && <div className="status err">{error}</div>}
        <button type="submit" className="primary wide" disabled={busy}>
          {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký và vào học'}
        </button>
        <button
          type="button"
          className="ghost wide"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        >
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
