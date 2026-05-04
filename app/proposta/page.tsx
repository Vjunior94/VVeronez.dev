'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PropostaAccessPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const handleAccess = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Accept full URL or just the ID
    const id = trimmed.includes('/') ? trimmed.split('/').pop() : trimmed;
    if (id) router.push(`/proposta/${id}`);
  };

  return (
    <>
      <style>{`
        :root { --bg: #09080f; --bg2: #12101e; --bg3: #1a1728; --border: rgba(255,255,255,0.07); --bronze: #c8826b; --bronze2: #e0a890; --cream: #f0e6dc; --muted: #6a6470; }
        .access-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 2rem; }
        .access-card { width: 100%; max-width: 460px; padding: 3rem 2.5rem; background: var(--bg2); border: 1px solid var(--border); position: relative; overflow: hidden; }
        .access-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--bronze), transparent); }
      `}</style>
      <div className="access-page">
        <div className="access-card">
          <a href="/" style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: '22px', fontWeight: 700, color: 'var(--cream)', textDecoration: 'none', display: 'block', marginBottom: '2.5rem' }}>
            VV<span style={{ color: 'var(--bronze)' }}>eronez</span>.dev
          </a>
          <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            Acesso à proposta
          </div>
          <div style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: '24px', fontWeight: 600, color: 'var(--cream)', lineHeight: 1.2, marginBottom: '2rem' }}>
            Cole o link da sua proposta
          </div>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAccess()}
            placeholder="Cole o link ou código aqui"
            autoFocus
            style={{
              width: '100%', padding: '14px 16px', background: 'var(--bg3)',
              border: '1px solid var(--border)', color: 'var(--cream)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '14px',
              outline: 'none', marginBottom: '1rem', boxSizing: 'border-box',
            }}
          />
          <button onClick={handleAccess} style={{
            width: '100%', padding: '14px', background: 'transparent',
            border: '1px solid var(--bronze)', color: 'var(--bronze2)',
            fontSize: '13px', fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', cursor: 'pointer',
          }}>
            Acessar proposta →
          </button>
          <div style={{ marginTop: '2rem', fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', lineHeight: 1.6 }}>
            Você recebeu um link exclusivo por WhatsApp ou e-mail.<br />
            Em caso de dúvidas, entre em contato.
          </div>
        </div>
      </div>
    </>
  );
}
