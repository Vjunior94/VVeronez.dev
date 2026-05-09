'use client';

import { createClient } from '@/lib/supabase/client';
import { useCachedFetch } from '@/lib/use-cached-fetch';
import { formatBRL, timeAgo, tempIcon } from '@/lib/format';
import { DollarSign, TrendingUp, Clock, Snowflake, ChevronRight } from 'lucide-react';

interface LeadRow { id: string; nome_cliente: string | null; status: string; temperatura: string | null; created_at: string; finalizado_em: string | null; }
interface PropostaRow { id: string; lead_id: string; status: string; custo_total_centavos: number; total_horas: number; created_at: string; senha_acesso: string | null; leads: { nome_cliente: string | null } | null; proposta_aceites: { id: string } | null; }

export default function DashboardPage() {
  const [cached, loading] = useCachedFetch('dashboard-v2', async () => {
    const supabase = createClient();
    const [leadsRes, propRes] = await Promise.all([
      supabase.from('leads').select('id, nome_cliente, status, temperatura, created_at, finalizado_em').is('arquivado_em', null).order('created_at', { ascending: false }),
      supabase.from('propostas').select('id, lead_id, status, custo_total_centavos, total_horas, created_at, senha_acesso, leads(nome_cliente), proposta_aceites(id)').order('created_at', { ascending: false }),
    ]);
    return {
      leads: leadsRes.data ?? [],
      propostas: (propRes.data ?? []) as unknown as PropostaRow[],
    };
  });

  const leads = cached?.leads ?? [];
  const propostas = cached?.propostas ?? [];
  const v = loading ? '--' : undefined;

  // KPIs
  const receitaPipeline = propostas.reduce((a, p) => a + (p.custo_total_centavos || 0), 0);
  const propostasAceitas = propostas.filter(p => p.proposta_aceites);
  const receitaAceita = propostasAceitas.reduce((a, p) => a + (p.custo_total_centavos || 0), 0);

  const finalizados = leads.filter(l => l.finalizado_em && l.created_at);
  const tempos = finalizados.map(l => (new Date(l.finalizado_em!).getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const tempoMedio = tempos.length > 0 ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10 : 0;

  const frios = leads.filter(l => l.temperatura === 'frio').length;

  const kpis = [
    { label: 'Receita Pipeline', value: v ?? formatBRL(receitaPipeline), color: '#d4a04a', icon: DollarSign },
    { label: 'Receita Aceita', value: v ?? formatBRL(receitaAceita), color: '#5fd0b8', icon: TrendingUp },
    { label: 'Tempo Med. Qualif.', value: v ?? `${tempoMedio} dias`, color: '#e0a890', icon: Clock },
    { label: 'Leads Frios', value: v ?? String(frios), color: '#5ba8d4', icon: Snowflake },
  ];

  // Funil
  const totalLeads = leads.length;
  const emAndamento = leads.filter(l => l.status === 'em_andamento').length;
  const finalizadosCount = leads.filter(l => l.status === 'finalizado').length;
  const comProposta = new Set(propostas.map(p => p.lead_id)).size;
  const aceitos = new Set(propostasAceitas.map(p => p.lead_id)).size;

  const funnel = [
    { label: 'Leads totais', value: totalLeads, color: '#888' },
    { label: 'Em qualificacao', value: emAndamento, color: '#e0a890' },
    { label: 'Qualificados', value: finalizadosCount, color: '#d4a04a' },
    { label: 'Com proposta', value: comProposta, color: '#7c8cf5' },
    { label: 'Aceitos', value: aceitos, color: '#5fd0b8' },
  ];
  const maxFunnel = Math.max(...funnel.map(f => f.value), 1);

  const recentLeads = leads.slice(0, 5);
  const recentPropostas = propostas.slice(0, 5);

  return (
    <>
      <h1 className="admin-page-title">Dashboard</h1>

      {/* KPIs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.8rem', marginBottom: '1.5rem',
      }}>
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="dash-card" style={{ padding: '1.2rem', borderLeft: `3px solid ${kpi.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-jetbrains)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                <Icon size={13} style={{ opacity: 0.6 }} /> {kpi.label}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 600, color: kpi.color, fontFamily: 'var(--font-jetbrains)' }}>
                {kpi.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Funil */}
      {!loading && (
        <div className="dash-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="dash-card-label">Funil de Conversao</div>
          <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.8rem' }}>
            {funnel.map((step, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{step.label}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: step.color, fontFamily: 'var(--font-jetbrains)' }}>{step.value}</span>
                </div>
                <div style={{ height: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(step.value / maxFunnel) * 100}%`,
                    background: step.color, borderRadius: '4px',
                    transition: 'width 0.6s ease',
                    minWidth: step.value > 0 ? '8px' : '0',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recentes */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Leads recentes */}
          <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
            <div className="dash-card-label" style={{ marginBottom: '0.8rem' }}>Leads recentes</div>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              {recentLeads.map(l => (
                <a key={l.id} href={`/leads/${l.id}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)',
                  textDecoration: 'none', color: 'inherit',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {tempIcon(l.temperatura)}
                    <span style={{ fontSize: '0.85rem', color: 'var(--gold-100)' }}>{l.nome_cliente || 'Sem nome'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{timeAgo(l.created_at)}</span>
                    <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                  </div>
                </a>
              ))}
            </div>
            <a href="/leads" style={{ display: 'block', marginTop: '0.8rem', fontSize: '0.72rem', color: 'var(--gold-300)', textDecoration: 'none', fontFamily: "var(--font-jetbrains)" }}>
              Ver todos →
            </a>
          </div>

          {/* Propostas recentes */}
          <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
            <div className="dash-card-label" style={{ marginBottom: '0.8rem' }}>Propostas recentes</div>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              {recentPropostas.map(p => (
                <a key={p.id} href={`/propostas/editor/${p.id}`} style={{
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
