'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCachedFetch } from '@/lib/use-cached-fetch';
import { Flame, Sun, Snowflake } from 'lucide-react';

interface LeadRow { id: string; nome_cliente: string | null; status: string; temperatura: string | null; created_at: string; }
interface PropostaRow { id: string; lead_id: string; status: string; custo_total_centavos: number; created_at: string; senha_acesso: string | null; leads: { nome_cliente: string | null } | null; }

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const tempIcon: Record<string, React.ReactNode> = {
  quente: <Flame size={12} style={{ color: '#e85d75' }} />,
  morno: <Sun size={12} style={{ color: '#d4a04a' }} />,
  frio: <Snowflake size={12} style={{ color: '#5ba8d4' }} />,
};

export default function DashboardPage() {
  const [cached, loading] = useCachedFetch('dashboard', async () => {
    const supabase = createClient();
    const [leadsRes, propRes] = await Promise.all([
      supabase.from('leads').select('id, nome_cliente, status, temperatura, created_at').is('arquivado_em', null).order('created_at', { ascending: false }),
      supabase.from('propostas').select('id, lead_id, status, custo_total_centavos, created_at, senha_acesso, leads(nome_cliente)').order('created_at', { ascending: false }).limit(5),
    ]);
    return {
      leads: leadsRes.data ?? [],
      propostas: (propRes.data ?? []) as unknown as PropostaRow[],
    };
  });
  const leads = cached?.leads ?? [];
  const propostas = cached?.propostas ?? [];

  const all = leads;
  const stats = {
    total: all.length,
    emAndamento: all.filter(l => l.status === 'em_andamento').length,
    finalizados: all.filter(l => l.status === 'finalizado').length,
    quentes: all.filter(l => l.temperatura === 'quente').length,
    mornos: all.filter(l => l.temperatura === 'morno').length,
    frios: all.filter(l => l.temperatura === 'frio').length,
    propostas: propostas.length,
    publicadas: propostas.filter(p => p.senha_acesso).length,
  };

  const v = loading ? '—' : undefined;

  const cards = [
    { label: 'Total de leads', value: stats.total, sub: 'Desde o início' },
    { label: 'Em atendimento', value: stats.emAndamento, sub: 'Conversas ativas' },
    { label: 'Finalizados', value: stats.finalizados, sub: 'Qualificados pela Sofia' },
    { label: 'Quentes', value: stats.quentes, sub: 'Alta prioridade', color: '#e85d75' },
    { label: 'Mornos', value: stats.mornos, sub: 'Potencial médio', color: '#d4a04a' },
    { label: 'Frios', value: stats.frios, sub: 'Baixa prioridade', color: '#5ba8d4' },
    { label: 'Propostas', value: stats.propostas, sub: 'Geradas pelo Agenor' },
    { label: 'Publicadas', value: stats.publicadas, sub: 'Com link ativo' },
  ];

  const recentLeads = all.slice(0, 5);
  const recentPropostas = propostas.slice(0, 3);

  return (
    <>
      <h1 className="admin-page-title">Dashboard</h1>

      <div className="dashboard-grid">
        {cards.map((c) => (
          <div className="dash-card" key={c.label}>
            <div className="dash-card-label">{c.label}</div>
            <div className="dash-card-value" style={{ color: (c as any).color || undefined }}>{v ?? c.value}</div>
            <div className="dash-card-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
          {/* Leads recentes */}
          <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
            <div className="dash-card-label" style={{ marginBottom: '0.8rem' }}>Leads recentes</div>
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {recentLeads.map(l => (
                <a key={l.id} href={`/sofia/${l.id}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)',
                  textDecoration: 'none', color: 'inherit',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {tempIcon[l.temperatura || ''] || null}
                    <span style={{ fontSize: '0.85rem', color: 'var(--gold-100)' }}>{l.nome_cliente || 'Sem nome'}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{timeAgo(l.created_at)}</span>
                </a>
              ))}
            </div>
            <a href="/sofia" style={{ display: 'block', marginTop: '0.8rem', fontSize: '0.72rem', color: 'var(--gold-300)', textDecoration: 'none', fontFamily: "var(--font-jetbrains)" }}>
              Ver todos →
            </a>
          </div>

          {/* Propostas recentes */}
          <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
            <div className="dash-card-label" style={{ marginBottom: '0.8rem' }}>Propostas recentes</div>
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {recentPropostas.map(p => (
                <a key={p.id} href={`/sofia/${p.lead_id}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)',
                  textDecoration: 'none', color: 'inherit',
                }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--gold-100)' }}>{p.leads?.nome_cliente || 'Cliente'}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>{formatBRL(p.custo_total_centavos)}</span>
                  </div>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                    padding: '0.15rem 0.4rem', borderRadius: '3px',
                    color: p.senha_acesso ? '#5fd0b8' : 'var(--text-dim)',
                    background: p.senha_acesso ? 'rgba(95,208,184,0.12)' : 'rgba(255,255,255,0.05)',
                  }}>
                    {p.senha_acesso ? 'Publicada' : p.status}
                  </span>
                </a>
              ))}
            </div>
            <a href="/propostas" style={{ display: 'block', marginTop: '0.8rem', fontSize: '0.72rem', color: 'var(--gold-300)', textDecoration: 'none', fontFamily: "var(--font-jetbrains)" }}>
              Ver todas →
            </a>
          </div>
        </div>
      )}
    </>
  );
}
