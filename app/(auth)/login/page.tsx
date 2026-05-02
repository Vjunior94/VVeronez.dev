'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Credenciais inválidas. Verifique email e senha.');
      setLoading(false);
      return;
    }

    // Full page navigation to ensure middleware picks up the new session cookies
    window.location.href = '/dashboard';
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <a href="/" className="brand-logo" aria-label="VVeronez.Dev" style={{ justifyContent: 'center' }}>
            <span className="brand-wordmark">
              <span className="brand-vv">VV</span>
              <span className="brand-eronez">eronez</span>
            </span>
            <span className="brand-dot">.</span>
            <span className="brand-tld">Dev</span>
          </a>
          <p className="login-subtitle">Acesso administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
