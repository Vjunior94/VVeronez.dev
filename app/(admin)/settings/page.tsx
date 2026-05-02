'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email || '');
        setCreatedAt(new Date(user.created_at).toLocaleDateString('pt-BR'));
      }
    });
  }, []);

  return (
    <>
      <h1 className="admin-page-title">Configurações</h1>

      <div className="dash-card" style={{ maxWidth: '500px' }}>
        <div className="dash-card-label">Conta</div>
        <div style={{ display: 'grid', gap: '1rem', marginTop: '0.8rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>Email</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{email}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>Membro desde</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{createdAt}</div>
          </div>
        </div>
      </div>
    </>
  );
}
