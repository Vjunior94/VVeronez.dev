'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatPhone } from '@/lib/ddd';
import { ArrowLeft, FileText, MessageSquare, ClipboardList, Flame, Sun, Snowflake } from 'lucide-react';

interface Lead {
  id: string;
  whatsapp_numero: string;
  nome_cliente: string | null;
  status: string;
  temperatura: string | null;
  resumo_executivo: string | null;
  justificativa_temperatura: string | null;
  tipo_solucao_sugerida: string | null;
  alertas: string | null;
  total_mensagens: number;
  created_at: string;
  finalizado_em: string | null;
}

interface FichaCampo {
  id: string;
  campo: string;
  valor_estruturado: string;
  frase_original: string | null;
  confianca: string;
}

interface Mensagem {
  id: string;
  origem: string;
  tipo: string;
  conteudo: string;
  created_at: string;
}

interface Proposta {
  id: string;
  status: string;
  resumo: string | null;
  stack_recomendada: Record<string, string> | null;
  cronograma: { fase: string; descricao: string; semanas: number; entregaveis: string[] }[] | null;
  total_horas: number;
  custo_total_centavos: number;
  riscos: string | null;
  observacoes: string | null;
}

interface Modulo {
  id: string;
  nome: string;
  descricao: string;
  complexidade: string;
  horas_estimadas: number;
  fase: string;
  ordem: number;
}

const campoLabels: Record<string, string> = {
  tipo_projeto: 'Tipo de Projeto',
  problema_objetivo: 'Problema / Objetivo',
  estagio_atual: 'Estágio Atual',
  tamanho_escala: 'Tamanho / Escala',
  prazo: 'Prazo',
  investimento: 'Investimento',
  decisao_contexto: 'Decisão / Contexto',
  nome_cliente: 'Nome',
  observacoes_extras: 'Observações',
};

const confiancaColors: Record<string, string> = {
  alta: '#5fd0b8',
  media: '#d4a04a',
  baixa: '#e85d75',
};

const tempConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  quente: { label: 'Quente', icon: <Flame size={14} />, color: '#e85d75' },
  morno: { label: 'Morno', icon: <Sun size={14} />, color: '#d4a04a' },
  frio: { label: 'Frio', icon: <Snowflake size={14} />, color: '#5ba8d4' },
};

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [ficha, setFicha] = useState<FichaCampo[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [tab, setTab] = useState<'ficha' | 'conversa' | 'proposta'>('ficha');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [leadRes, fichaRes, msgsRes, propRes] = await Promise.all([
        supabase.from('leads').select('*').eq('id', id).single(),
        supabase.from('ficha_campos').select('*').eq('lead_id', id).order('created_at'),
        supabase.from('mensagens').select('id,origem,tipo,conteudo,created_at')
          .eq('lead_id', id).in('tipo', ['texto', 'audio']).order('created_at'),
        supabase.from('propostas').select('*').eq('lead_id', id).order('created_at'),
      ]);

      setLead(leadRes.data);
      setFicha(fichaRes.data ?? []);
      setMensagens(msgsRes.data ?? []);
      setPropostas(propRes.data ?? []);

      if (propRes.data && propRes.data.length > 0) {
        const { data: mods } = await supabase
          .from('proposta_modulos')
          .select('*')
          .eq('proposta_id', propRes.data[0].id)
          .order('ordem');
        setModulos(mods ?? []);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <p style={{ color: 'var(--text-dim)' }}>Carregando...</p>;
  if (!lead) return <p style={{ color: 'var(--text-dim)' }}>Lead não encontrado.</p>;

  const temp = tempConfig[lead.temperatura || ''];

  // Deduplicate ficha fields (keep latest)
  const fichaMap = new Map<string, FichaCampo>();
  ficha.forEach(f => fichaMap.set(f.campo, f));
  const fichaUnique = Array.from(fichaMap.values());

  const tabs = [
    { key: 'ficha' as const, label: 'Ficha', icon: <ClipboardList size={14} /> },
    { key: 'conversa' as const, label: 'Conversa', icon: <MessageSquare size={14} /> },
    { key: 'proposta' as const, label: `Proposta${propostas.length > 0 ? ` (${propostas.length})` : ''}`, icon: <FileText size={14} /> },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <a href="/sofia" style={{ color: 'var(--gold-300)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </a>
        <div style={{ flex: 1 }}>
          <h1 className="admin-page-title" style={{ marginBottom: '0.3rem' }}>
            {lead.nome_cliente || formatPhone(lead.whatsapp_numero)}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.78rem' }}>
            {lead.nome_cliente && (
              <span style={{ color: 'var(--text-dim)' }}>{formatPhone(lead.whatsapp_numero)}</span>
            )}
            {temp && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: temp.color }}>
                {temp.icon} {temp.label}
              </span>
            )}
            <span style={{ color: 'var(--text-dim)' }}>{lead.total_mensagens} mensagens</span>
            <span style={{ color: 'var(--text-dim)' }}>{formatDate(lead.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Resumo executivo */}
      {lead.resumo_executivo && (
        <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
          <div className="dash-card-label">Resumo executivo</div>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--text-primary)' }}>
            {lead.resumo_executivo}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.7rem 1.2rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--gold-500)' : '2px solid transparent',
              color: tab === t.key ? 'var(--gold-100)' : 'var(--text-dim)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
              letterSpacing: '0.05em',
              transition: 'color 0.2s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Ficha */}
      {tab === 'ficha' && (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {fichaUnique.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhum campo preenchido ainda.</p>
          ) : (
            fichaUnique.map((f) => (
              <div key={f.id} className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="dash-card-label" style={{ margin: 0 }}>{campoLabels[f.campo] || f.campo}</span>
                  <span style={{ fontSize: '0.65rem', color: confiancaColors[f.confianca] || 'var(--text-dim)', fontWeight: 500 }}>
                    {f.confianca === 'alta' ? 'Alta' : f.confianca === 'media' ? 'Média' : 'Baixa'}
                  </span>
                </div>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{f.valor_estruturado}</p>
                {f.frase_original && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                    &ldquo;{f.frase_original}&rdquo;
                  </p>
                )}
              </div>
            ))
          )}

          {lead.alertas && (
            <div className="dash-card" style={{ borderColor: 'rgba(220, 150, 50, 0.3)', padding: '1.2rem 1.5rem' }}>
              <div className="dash-card-label" style={{ color: '#d4a04a' }}>Alertas</div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{lead.alertas}</p>
            </div>
          )}

          {lead.justificativa_temperatura && (
            <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
              <div className="dash-card-label">Justificativa da temperatura</div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{lead.justificativa_temperatura}</p>
            </div>
          )}

          {lead.tipo_solucao_sugerida && (
            <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
              <div className="dash-card-label">Solução sugerida</div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{lead.tipo_solucao_sugerida}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Conversa */}
      {tab === 'conversa' && (
        <div className="dash-card" style={{ padding: 0, maxHeight: '65vh', overflowY: 'auto' }}>
          <div style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {mensagens.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: '1rem 0' }}>Nenhuma mensagem.</p>
            ) : (
              mensagens.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.origem === 'cliente' ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    padding: '0.6rem 0.9rem',
                    background: msg.origem === 'cliente'
                      ? 'rgba(184, 130, 107, 0.12)'
                      : 'rgba(20, 16, 30, 0.8)',
                    border: msg.origem !== 'cliente' ? '1px solid var(--border-subtle)' : 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ fontSize: '0.6rem', color: msg.origem === 'cliente' ? 'var(--gold-300)' : 'var(--text-dim)', marginBottom: '0.2rem', fontWeight: 500 }}>
                    {msg.origem === 'cliente' ? 'Cliente' : 'Sofia'}
                  </div>
                  {msg.conteudo}
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '0.25rem', textAlign: msg.origem === 'cliente' ? 'right' : 'left' }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Proposta */}
      {tab === 'proposta' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {propostas.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhuma proposta gerada.</p>
          ) : (
            propostas.map((p) => (
              <div key={p.id}>
                {p.resumo && (
                  <div className="dash-card" style={{ marginBottom: '1rem' }}>
                    <div className="dash-card-label">Resumo</div>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--text-primary)' }}>{p.resumo}</p>
                  </div>
                )}

                <div className="dashboard-grid" style={{ marginBottom: '1rem' }}>
                  <div className="dash-card">
                    <div className="dash-card-label">Custo total</div>
                    <div className="dash-card-value" style={{ fontSize: '1.4rem' }}>{formatBRL(p.custo_total_centavos)}</div>
                  </div>
                  <div className="dash-card">
                    <div className="dash-card-label">Horas</div>
                    <div className="dash-card-value" style={{ fontSize: '1.4rem' }}>{p.total_horas}h</div>
                  </div>
                </div>

                {modulos.length > 0 && (
                  <div className="dash-card" style={{ marginBottom: '1rem' }}>
                    <div className="dash-card-label">Módulos</div>
                    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.6rem' }}>
                      {modulos.map((m) => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--gold-100)', fontWeight: 500 }}>{m.nome}</span>
                            {m.descricao && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{m.descricao}</p>}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                            {m.horas_estimadas}h · {m.fase?.toUpperCase()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {p.riscos && (
                  <div className="dash-card" style={{ borderColor: 'rgba(220, 150, 50, 0.3)' }}>
                    <div className="dash-card-label" style={{ color: '#d4a04a' }}>Riscos</div>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{p.riscos}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
