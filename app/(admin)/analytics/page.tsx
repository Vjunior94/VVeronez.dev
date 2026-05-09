'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatBRL } from '@/lib/format';
import { MapPin, Clock, Eye, Monitor, Smartphone, Tablet } from 'lucide-react';

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

interface Acesso {
  id: string;
  proposta_id: string;
  cidade: string | null;
  estado: string | null;
  pais: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [propostaNames, setPropostaNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [leadsRes, propostasRes, acessosRes, pubRes] = await Promise.all([
        supabase.from('leads').select('id, status, temperatura, created_at, finalizado_em'),
        supabase.from('propostas').select('id, lead_id, custo_total_centavos, proposta_aceites(id)'),
        supabase.from('proposta_acessos').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('propostas').select('id, leads(nome_cliente)').not('senha_acesso', 'is', null),
      ]);

      const allLeads = leadsRes.data ?? [];
      const allPropostas = (propostasRes.data ?? []) as any[];

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

      const finalizadosComData = allLeads.filter(l => l.finalizado_em && l.created_at);
      const tempos = finalizadosComData.map(l => {
        const diff = new Date(l.finalizado_em!).getTime() - new Date(l.created_at).getTime();
        return diff / (1000 * 60 * 60 * 24);
      });
      const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

      // Proposta names map
      const namesMap: Record<string, string> = {};
      (pubRes.data ?? []).forEach((p: any) => {
        namesMap[p.id] = p.leads?.nome_cliente || 'Cliente sem nome';
      });

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
      setAcessos(acessosRes.data ?? []);
      setPropostaNames(namesMap);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <><h1 className="admin-page-title">Analytics</h1><p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando...</p></>;
  if (!data) return null;

  const funnel = [
    { label: 'Leads totais', value: data.totalLeads, color: '#888' },
    { label: 'Em qualificacao', value: data.emAndamento, color: '#e0a890' },
    { label: 'Qualificados', value: data.finalizados, color: '#d4a04a' },
    { label: 'Com proposta', value: data.comProposta, color: '#7c8cf5' },
    { label: 'Aceitos', value: data.aceitos, color: '#5fd0b8' },
  ];
  const maxFunnel = Math.max(...funnel.map(f => f.value), 1);

  const conversoes = [
    { label: 'Lead -> Qualificado', value: data.totalLeads > 0 ? ((data.finalizados / data.totalLeads) * 100).toFixed(1) : '0' },
    { label: 'Qualificado -> Proposta', value: data.finalizados > 0 ? ((data.comProposta / data.finalizados) * 100).toFixed(1) : '0' },
    { label: 'Proposta -> Aceite', value: data.comProposta > 0 ? ((data.aceitos / data.comProposta) * 100).toFixed(1) : '0' },
    { label: 'Lead -> Aceite (total)', value: data.totalLeads > 0 ? ((data.aceitos / data.totalLeads) * 100).toFixed(1) : '0' },
  ];

  // Acessos grouped
  const byProposta: Record<string, Acesso[]> = {};
  acessos.forEach(a => {
    if (!byProposta[a.proposta_id]) byProposta[a.proposta_id] = [];
    byProposta[a.proposta_id].push(a);
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' as ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatLocation(a: Acesso) {
    const parts = [a.cidade, a.estado, a.pais].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Local desconhecido';
  }

  function getDevice(ua: string | null) {
    if (!ua) return 'Desconhecido';
    if (/mobile|android|iphone/i.test(ua)) return 'Mobile';
    if (/tablet|ipad/i.test(ua)) return 'Tablet';
    return 'Desktop';
  }

  return (
    <>
      <h1 className="admin-page-title">Analytics</h1>

      {/* Funil */}
      <div className="dash-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="dash-card-label">Funil de Conversao</div>
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

      {/* Taxas de conversao */}
      <div className="dash-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="dash-card-label">Taxas de Conversao</div>
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

      {/* Acessos recentes */}
      <div style={{ marginTop: '0.5rem' }}>
        <h2 style={{
          fontSize: '0.72rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.15em',
          color: 'var(--gold-300)', textTransform: 'uppercase', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <Eye size={14} /> Acessos recentes as propostas
        </h2>

        {acessos.length === 0 ? (
          <div className="dash-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
            <Eye size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>Nenhum acesso registrado ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {Object.entries(byProposta).map(([propostaId, items]) => (
              <div key={propostaId} className="dash-card" style={{ padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--gold-100)' }}>
                      {propostaNames[propostaId] || 'Proposta'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: "var(--font-jetbrains)" }}>
                      {items.length} acesso{items.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  <a href={`/propostas/editor/${propostaId}`} style={{
                    fontSize: '0.68rem', color: 'var(--gold-300)', textDecoration: 'none',
                    border: '1px solid var(--border-subtle)', padding: '0.3rem 0.7rem',
                    fontFamily: "var(--font-jetbrains)",
                  }}>
                    Ver proposta
                  </a>
                </div>
                <div style={{ display: 'grid', gap: '0.3rem' }}>
                  {items.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0.8rem',
                      background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.78rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gold-300)', minWidth: '180px' }}>
                        <MapPin size={13} style={{ opacity: 0.6 }} />
                        <span>{formatLocation(a)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-dim)', minWidth: '160px' }}>
                        <Clock size={13} style={{ opacity: 0.6 }} />
                        <span>{formatDate(a.created_at)}</span>
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                        {getDevice(a.user_agent)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
