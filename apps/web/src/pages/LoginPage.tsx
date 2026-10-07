import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      const { accessToken, user } = res.data.data;
      setAuth(accessToken, user);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(135deg, #0b3b2e, #0f5a45)',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32, color: '#fff' }}>
          <div style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 60,
            height: 60,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #f5a04a, #e8730c)',
            marginBottom: 12,
            boxShadow: '0 8px 24px #e8730c50',
          }}>
            <span style={{ fontSize: 28 }}>💊</span>
          </div>
          <div style={{
            fontFamily: '"Bricolage Grotesque", Figtree, system-ui, sans-serif',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>HS Pharma</div>
          <div style={{ fontSize: 13, color: '#9fc7b8', marginTop: 2 }}>Pharmacy Management System</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          padding: 28,
          boxShadow: '0 24px 60px #00000040',
        }}>
          <h3 style={{ marginBottom: 20, textAlign: 'center', color: '#0b3b2e' }}>Sign In</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <label>
              USERNAME
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </label>
            <label>
              PASSWORD
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <div style={{
                background: '#fde7e3',
                color: '#b3281b',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            <button
              id="login-btn"
              type="submit"
              className="btn"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#9fc7b8', fontSize: 12, marginTop: 20 }}>
          HS Pharma v1.0 · Local Server
        </p>
      </div>
    </div>
  );
}
