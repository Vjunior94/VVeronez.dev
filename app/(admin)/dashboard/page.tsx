'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Stats {
  total: number;
  emAndamento: number;
  finalizados: number;
  quentes: number;
  propostas: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, emAndamento: 0, finalizados: 0, quentes: 0, propostas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: leads } = await supabase.from('leads').select('status, temperatura');
      const { count: propCount } = await supabase.from('propostas').select('id', { count: 'exact', head: true });

      const all = leads ?? [];
      setStats({
        total: all.length,
        emAndamento: all.filter(l => l.status === 'em_andamento').length,
        finalizados: all.filter(l => l.status === 'finalizado').length,
        quentes: all.filter(l => l.temperatura === 'quente').length,
        propostas: propCount ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: 'Total de leads', value: stats.total, sub: 'Desde o início' },
    { label: 'Em atendimento', value: stats.emAndamento, sub: 'Conversas ativas' },
    { label: 'Finalizados', value: stats.finalizados, sub: 'Qualificados pela Sofia' },
    { label: 'Quentes', value: stats.quentes, sub: 'Alta prioridade' },
    { label: 'Propostas', value: stats.propostas, sub: 'Geradas pelo Arquiteto' },
  ];

  return (
    <>
      <h1 className="admin-page-title">Dashboard</h1>
      <div className="dashboard-grid">
        {cards.map((c) => (
          <div className="dash-card" key={c.label}>
            <div className="dash-card-label">{c.label}</div>
            <div className="dash-card-value">{loading ? '—' : c.value}</div>
            <div className="dash-card-sub">{c.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}
