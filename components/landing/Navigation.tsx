'use client';

export default function Navigation() {
  return (
    <nav className="landing-nav">
      <a href="#" className="brand-logo" aria-label="VVeronez.Dev">
        <span className="brand-wordmark">
          <span className="brand-vv">VV</span>
          <span className="brand-eronez">eronez</span>
          <svg
            className="brand-underline"
            viewBox="0 0 200 12"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="underlineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#b8826b" stopOpacity={0} />
                <stop offset="15%" stopColor="#d8a890" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#f0e0d0" stopOpacity={1} />
                <stop offset="85%" stopColor="#d8a890" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#b8826b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path
              d="M 4 8 Q 50 2 100 5 T 196 9"
              fill="none"
              stroke="url(#underlineGrad)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="brand-dot">.</span>
        <span className="brand-tld">Dev</span>
      </a>
      <div className="nav-links">
        <a href="#servicos">Serviços</a>
        <a href="#projetos">Projetos</a>
        <a href="#contato">Contato</a>
        <a href="/dashboard" className="admin-entry" aria-label="Painel administrativo">◈</a>
      </div>
    </nav>
  );
}
