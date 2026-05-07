'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AnalyticsData {
  totalLeads: number;
  emAndamento: number;
  finalizados: number;
  comProposta: number;
  aceitos: number;
  frios: number;
  receitaPipeline: number;
  receitaAceita: number;
  tempoMedioQualificacaoDias: number;
}

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: leads } = await supabase
        .from('leads')
        .select('id, status, temperatura, created_at, finalizado_em');

      const { data: propostas } = await supabase
        .from('propostas')
        .select('id, lead_id, custo_total_centavos, proposta_aceites(id)');

      const allLeads = leads ?? [];
      const allPropostas = (propostas ?? []) as any[];

      const totalLeads = allLeads.length;
      const emAndamento = allLeads.filter(l => l.status === 'em_andamento').length;
      const finalizados = allLeads.filter(l => l.status === 'finalizado').length;
      const frios = allLeads.filter(l => l.status === 'frio' || l.temperatura === 'frio').length;

      const leadsComProposta = new Set(allPropostas.map(p => p.lead_id));
      const comProposta = leadsComProposta.size;

      const propostasAceitas = allPropostas.filter(p => p.proposta_aceites);
      const aceitos = new Set(propostasAceitas.map(p => p.lead_id)).size;

      const receitaPipeline = allPropostas.reduce((a: number, p: any) => a + (p.custo_total_centavos || 0), 0);
      const receitaAceita = propostasAceitas.reduce((a: number, p: any) => a + (p.custo_total_centavos || 0), 0);

      // Tempo medio de qualificacao
      const finalizadosComData = allLeads.filter(l => l.finalizado_em && l.created_at);
      const tempos = finalizadosComData.map(l => {
        const diff = new Date(l.finalizado_em!).getTime() - new Date(l.created_at).getTime();
        return diff / (1000 * 60 * 60 * 24);
      });
      const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

      setData({
        totalLeads,
        emAndamento,
        finalizados,
        comProposta,
        aceitos,
        frios,
        receitaPipeline,
        receitaAceita,
        tempoMedioQualificacaoDias: Math.round(tempoMedio * 10) / 10,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <><h1 className="admin-page-title">Analytics</h1><p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando...</p></>;
  if (!data) return null;

  const funnel = [
    { label: 'Leads totais', value: data.totalLeads, color: '#888' },
    { label: 'Em qualificação', value: data.emAndamento, color: '#e0a890' },
    { label: 'Qualificados', value: data.finalizados, color: '#d4a04a' },
    { label: 'Com proposta', value: data.comProposta, color: '#7c8cf5' },
    { label: 'Aceitos', value: data.aceitos, color: '#5fd0b8' },
  ];
  const maxFunnel = Math.max(...funnel.map(f => f.value), 1);

  const conversoes = [
    { label: 'Lead → Qualificado', value: data.totalLeads > 0 ? ((data.finalizados / data.totalLeads) * 100).toFixed(1) : '0' },
    { label: 'Qualificado → Proposta', value: data.finalizados > 0 ? ((data.comProposta / data.finalizados) * 100).toFixed(1) : '0' },
    { label: 'Proposta → Aceite', value: data.comProposta > 0 ? ((data.aceitos / data.comProposta) * 100).toFixed(1) : '0' },
    { label: 'Lead → Aceite (total)', value: data.totalLeads > 0 ? ((data.aceitos / data.totalLeads) * 100).toFixed(1) : '0' },
  ];

  return (
    <>
      <h1 className="admin-page-title">Analytics</h1>

      {/* KPI Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.8rem', marginBottom: '2rem',
      }}>
        {[
          { label: 'Receita Pipeline', value: formatBRL(data.receitaPipeline), color: '#d4a04a' },
          { label: 'Receita Aceita', value: formatBRL(data.receitaAceita), color: '#5fd0b8' },
          { label: 'Tempo Médio Qualif.', value: `${data.tempoMedioQualificacaoDias} dias`, color: '#e0a890' },
          { label: 'Leads Frios', value: String(data.frios), color: '#666' },
        ].map((kpi, i) => (
          <div key={i} className="dash-card" style={{ padding: '1.2rem', borderLeft: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-jetbrains)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 600, color: kpi.color, fontFamily: 'var(--font-jetbrains)' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Funil Visual */}
      <div className="dash-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div className="dash-card-label">Funil de Conversão</div>
        <div style={{ display: 'grid', gap: '0.8rem', marginTop: '1rem' }}>
          {funnel.map((step, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #aaa)' }}>{step.label}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: step.color, fontFamily: 'var(--font-jetbrains)' }}>{step.value}</span>
              </div>
              <div style={{ height: '24px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
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

      {/* Conversão por etapa */}
      <div className="dash-card" style={{ padding: '1.5rem' }}>
        <div className="dash-card-label">Taxas de Conversão</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          {conversoes.map((c, i) => (
            <div key={i} style={{
              padding: '1rem', background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>{c.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold-100, #f0e6dc)', fontFamily: 'var(--font-jetbrains)' }}>
                {c.value}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
