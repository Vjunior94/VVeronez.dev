import type { CSSProperties } from 'react';

// Mesmo padrão inline usado em app/(app)/agenda/page.tsx e app/(admin)/settings/page.tsx —
// não existe classe global de input no globals.css, cada tela estiliza os campos.
// Extraído de AbaIdentidade.tsx/AbaObrigacoes.tsx (Tasks 6 e 7) na Task 8 para não
// triplicar o mesmo objeto de estilo num terceiro componente (AbaCustos.tsx).
export const inputStyle: CSSProperties = {
  padding: '0.5rem', background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-subtle)', color: 'var(--gold-100)',
  fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none',
};

export const botaoStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)',
  cursor: 'pointer', padding: '0.4rem 0.6rem', fontSize: '0.78rem', fontFamily: 'inherit',
};

export const labelStyle: CSSProperties = { fontSize: '0.75rem', opacity: 0.7, color: 'var(--text-dim)' };

export const botaoPrimarioStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.5rem 1rem', cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: '0.85rem',
};
