'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CalendarDays, LogOut, LayoutDashboard } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      if (user.email) setEmail(user.email);
      const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
      setIsAdmin(!!data?.is_admin);
    });
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <a href="/" className="brand-logo" aria-label="VVeronez.Dev">
            <span className="brand-wordmark"><span className="brand-vv" style={{ fontSize: '1.2rem' }}>VV</span>
              <span className="brand-eronez" style={{ fontSize: '0.9rem' }}>eronez</span></span>
            <span className="brand-dot" style={{ fontSize: '0.9rem' }}>.</span>
            <span className="brand-tld" style={{ fontSize: '0.7rem' }}>Dev</span>
          </a>
        </div>
        <nav className="admin-sidebar-nav">
          <a href="/agenda" className="admin-nav-link active"><CalendarDays /><span>Agenda</span></a>
          {isAdmin && <a href="/dashboard" className="admin-nav-link"><LayoutDashboard /><span>Área admin</span></a>}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-user-avatar">{email ? email[0].toUpperCase() : '?'}</div>
            <span className="admin-user-email">{email}</span>
          </div>
          <button className="admin-logout" onClick={logout}><LogOut size={16} /><span>Sair</span></button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-header"><div className="admin-breadcrumb"><span>agenda</span></div></header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
