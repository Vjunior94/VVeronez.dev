'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LayoutDashboard, MessageSquare, FileText, Settings, LogOut, Menu, ChevronsLeft, ChevronsRight, Globe, Columns3, BarChart3 } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sofia', label: 'Sofia', icon: MessageSquare },
  { href: '/agenor', label: 'Agenor', icon: FileText },
  { href: '/propostas', label: 'Propostas Publicadas', icon: Globe },
  { href: '/pipeline', label: 'Pipeline', icon: Columns3 },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const activeSection = navItems.find((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <div className={`admin-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
      <button
        className="admin-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        <Menu />
      </button>

      <div
        className={`admin-overlay${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`admin-sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="admin-sidebar-header">
          <a href="/" className="brand-logo" aria-label="VVeronez.Dev">
            <span className="brand-wordmark">
              <span className="brand-vv" style={{ fontSize: '1.2rem' }}>VV</span>
              {!collapsed && <span className="brand-eronez" style={{ fontSize: '0.9rem' }}>eronez</span>}
            </span>
            {!collapsed && (
              <>
                <span className="brand-dot" style={{ fontSize: '0.9rem' }}>.</span>
                <span className="brand-tld" style={{ fontSize: '0.7rem' }}>Dev</span>
              </>
            )}
          </a>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`admin-nav-link${isActive ? ' active' : ''}`}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
              >
                <Icon />
                {!collapsed && <span>{item.label}</span>}
              </a>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          {!collapsed && (
            <div className="admin-user-info">
              <div className="admin-user-avatar">
                {userEmail ? userEmail[0].toUpperCase() : 'V'}
              </div>
              <span className="admin-user-email">{userEmail}</span>
            </div>
          )}
          <button className="admin-logout" onClick={handleLogout} title={collapsed ? 'Sair' : undefined}>
            <LogOut size={16} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-breadcrumb">
            <span>admin</span> / {activeSection?.label || 'Dashboard'}
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
