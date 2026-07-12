'use client';

import { useEffect, useState, useCallback } from 'react';
import { Building2, ScrollText, Wallet } from 'lucide-react';
import { carregarEmpresa, type EmpresaDados } from '@/lib/empresa-data';
import AbaIdentidade from '@/components/empresa/AbaIdentidade';

type Aba = 'identidade' | 'obrigacoes' | 'custos';

const ABAS: { id: Aba; label: string; icon: typeof Building2 }[] = [
  { id: 'identidade', label: 'Identidade', icon: Building2 },
  { id: 'obrigacoes', label: 'Obrigações', icon: ScrollText },
  { id: 'custos', label: 'Custo fixo', icon: Wallet },
];

export default function EmpresaPage() {
  const [aba, setAba] = useState<Aba>('identidade');
  const [empresa, setEmpresa] = useState<EmpresaDados | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setEmpresa(await carregarEmpresa());
    setLoading(false);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  if (loading) return <p style={{ opacity: 0.6 }}>Carregando…</p>;

  // A RLS é admin-only: se voltou null, ou o seed não rodou, ou quem chamou não é admin.
  if (!empresa) {
    return (
      <p style={{ opacity: 0.8 }}>
        Nenhum registro de empresa acessível. Confirme que a migration
        <code> 003_empresa_admin.sql </code> foi aplicada e que você está logado como admin.
      </p>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Empresa</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`admin-nav-link${aba === id ? ' active' : ''}`}
            style={{ padding: '0.5rem 1rem' }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {aba === 'identidade' && <AbaIdentidade empresa={empresa} onSalvo={recarregar} />}
      {aba === 'obrigacoes' && <p style={{ opacity: 0.6 }}>Em construção (Task 7).</p>}
      {aba === 'custos' && <p style={{ opacity: 0.6 }}>Em construção (Task 8).</p>}
    </div>
  );
}
