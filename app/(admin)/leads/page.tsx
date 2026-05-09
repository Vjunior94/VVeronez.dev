'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCachedFetch } from '@/lib/use-cached-fetch';
import { getDDDInfo, formatPhone } from '@/lib/ddd';
import { formatBRL, timeAgo, tempConfig, tempIcon, statusLabels, diasInativo } from '@/lib/format';
import { MessageSquare, Clock, CheckCircle, Archive, Flame, Snowflake, Sun, Search, Plus, List, Columns3, Thermometer, DollarSign } from 'lucide-react';

interface Lead {
  id: string;
  whatsapp_numero: string;
  nome_cliente: string | null;
  status: string;
  temperatura: string | null;
  resumo_executivo: string | null;
  justificativa_temperatura: string | null;
  total_mensagens: number;
  created_at: string;
  updated_at: string | null;
  finalizado_em: string | null;
  propostas: { id: string; custo_total_centavos: number; proposta_aceites: { id: string } | null }[];
}

type FilterKey = 'todos' | 'em_andamento' | 'finalizado' | 'quente' | 'morno' | 'frio' | 'negado';
type ViewMode = 'lista' | 'kanban';

const COLUNAS_KANBAN = [
  { key: 'novo', label: 'Novo', color: '#888' },
  { key: 'qualificando', label: 'Qualificando', color: '#e0a890' },
  { key: 'qualificado', label: 'Qualificado', color: '#d4a04a' },
  { key: 'proposta_enviada', label: 'Proposta Enviada', color: '#7c8cf5' },
  { key: 'aceito', label: 'Aceito', color: '#5fd0b8' },
  { key: 'frio', label: 'Frio', color: '#666' },
];

function classificar(lead: Lead): string {
  if (lead.propostas.some(p => p.proposta_aceites)) return 'aceito';
  if (lead.status === 'frio' || lead.temperatura === 'frio') return 'frio';
  if (lead.propostas.length > 0 && lead.status === 'finalizado') return 'proposta_enviada';
  if (lead.status === 'finalizado') return 'qualificado';
  if (lead.status === 'em_andamento') return 'qualificando';
  if (lead.status === 'negado') return 'negado';
  return 'novo';
}

export default function LeadsPage() {
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('lista');

  const [allLeads, loading] = useCachedFetch<Lead[]>('leads-unified', async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('leads')
      .select('id, whatsapp_numero, nome_cliente, status, temperatura, resumo_executivo, justificativa_temperatura, total_mensagens, created_at, updated_at, finalizado_em, propostas(id, custo_total_centavos, proposta_aceites(id))')
      .is('arquivado_em', null)
      .order('created_at', { ascending: false });
    return (data ?? []) as unknown as Lead[];
  });

  const all = allLeads ?? [];
  const leads = all.filter(l => {
    if (filter === 'quente') { if (l.temperatura !== 'quente') return false; }
    else if (filter === 'morno') { if (l.temperatura !== 'morno') return false; }
    else if (filter === 'frio') { if (l.temperatura !== 'frio') return false; }
    else if (filter !== 'todos') { if (l.status !== filter) return false; }
    if (search) {
      const q = search.toLowerCase();
      const match = (l.nome_cliente || '').toLowerCase().includes(q)
        || l.whatsapp_numero.includes(q)
        || (l.resumo_executivo || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const stats = {
    total: all.length,
    emAndamento: all.filter(l => l.status === 'em_andamento').length,
    finalizados: all.filter(l => l.status === 'finalizado').length,
    quentes: all.filter(l => l.temperatura === 'quente').length,
    mornos: all.filter(l => l.temperatura === 'morno').length,
    frios: all.filter(l => l.temperatura === 'frio').length,
    negados: all.filter(l => l.status === 'negado').length,
  };

  const filters: { key: FilterKey; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'todos', label: 'Todos', count: stats.total, icon: <MessageSquare size={14} /> },
    { key: 'em_andamento', label: 'Ativos', count: stats.emAndamento, icon: <Clock size={14} /> },
    { key: 'finalizado', label: 'Finalizados', count: stats.finalizados, icon: <CheckCircle size={14} /> },
    { key: 'quente', label: 'Quentes', count: stats.quentes, icon: <Flame size={14} /> },
    { key: 'morno', label: 'Mornos', count: stats.mornos, icon: <Sun size={14} /> },
    { key: 'frio', label: 'Frios', count: stats.frios, icon: <Snowflake size={14} /> },
    { key: 'negado', label: 'Negados', count: stats.negados, icon: <Archive size={14} /> },
  ];

  // Kanban data
  const grouped = COLUNAS_KANBAN.map(col => ({
    ...col,
    leads: leads.filter(l => classificar(l) === col.key),
  }));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Leads</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('lista')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.4rem 0.7rem', fontSize: '0.68rem', cursor: 'pointer',
                background: viewMode === 'lista' ? 'rgba(184, 130, 107, 0.15)' : 'none',
                border: 'none', color: viewMode === 'lista' ? 'var(--gold-300)' : 'var(--text-dim)',
                fontFamily: 'var(--font-jetbrains)',
              }}
            >
              <List size={14} /> Lista
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.4rem 0.7rem', fontSize: '0.68rem', cursor: 'pointer',
                background: viewMode === 'kanban' ? 'rgba(184, 130, 107, 0.15)' : 'none',
                border: 'none', color: viewMode === 'kanban' ? 'var(--gold-300)' : 'var(--text-dim)',
                borderLeft: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-jetbrains)',
              }}
            >
              <Columns3 size={14} /> Pipeline
            </button>
          </div>
          <a href="/leads/novo" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 1rem', background: 'none',
            border: '1px solid var(--border-subtle)', color: 'var(--gold-300)',
            fontSize: '0.72rem', textDecoration: 'none',
            fontFamily: "var(--font-jetbrains)", letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <Plus size={14} /> Novo Lead
          </a>
        </div>
      </div>

      {/* Filtros */}
      <div className="dashboard-grid" style={{ marginBottom: '1rem' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="dash-card"
            style={{
              cursor: 'pointer',
              textAlign: 'left',
              borderColor: filter === f.key ? 'var(--gold-500)' : undefined,
              background: filter === f.key ? 'rgba(184, 130, 107, 0.08)' : undefined,
            }}
          >
            <div className="dash-card-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {f.icon} {f.label}
            </div>
            <div className="dash-card-value">{loading ? '--' : f.count}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.2rem', position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou resumo..."
          style={{
            width: '100%', padding: '0.6rem 0.8rem 0.6rem 2.4rem',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
            color: 'var(--gold-100)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando...</p>
      ) : viewMode === 'lista' ? (
        /* === VISTA LISTA === */
        leads.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhum lead encontrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {leads.map((lead) => {
              const temp = tempConfig[lead.temperatura || ''];
              const dddInfo = getDDDInfo(lead.whatsapp_numero);
              return (
                <a
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="dash-card"
                  style={{ textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem' }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--gold-500), var(--gold-700))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "var(--font-cinzel)", fontSize: '0.85rem', fontWeight: 600, color: 'var(--bg-deep)', flexShrink: 0,
                  }}>
                    {(lead.nome_cliente || '?')[0].toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 500, color: 'var(--gold-100)', fontSize: '0.9rem' }}>
                        {lead.nome_cliente || 'Sem nome'}
                      </span>
                      {temp && (
                        <span
                          title={lead.justificativa_temperatura || undefined}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: temp.color, cursor: lead.justificativa_temperatura ? 'help' : undefined }}
                        >
                          {tempIcon(lead.temperatura)} {temp.label}
                        </span>
                      )}
                      <span className={`status-badge status-${lead.status === 'em_andamento' ? 'active' : lead.status === 'finalizado' ? 'qualified' : 'archived'}`}>
                        {statusLabels[lead.status] || lead.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      <span>{formatPhone(lead.whatsapp_numero)}</span>
                      <span>{dddInfo.cidade}/{dddInfo.estado}</span>
                      <span>{lead.total_mensagens} msgs</span>
                      <span>{timeAgo(lead.created_at)}</span>
                    </div>
                  </div>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 6 L15 12 L9 18" />
                  </svg>
                </a>
              );
            })}
          </div>
        )
      ) : (
        /* === VISTA KANBAN (Pipeline) === */
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUNAS_KANBAN.length}, minmax(180px, 1fr))`,
          gap: '0.6rem',
          overflowX: 'auto',
          paddingBottom: '1rem',
        }}>
          {grouped.map(col => (
            <div key={col.key} style={{
              background: 'var(--surface-1, rgba(255,255,255,0.02))',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              borderRadius: '8px',
              padding: '0.8rem',
              minHeight: '300px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.8rem', paddingBottom: '0.6rem',
                borderBottom: `2px solid ${col.color}`,
              }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: col.color,
                  fontFamily: 'var(--font-jetbrains)',
                }}>
                  {col.label}
                </span>
                <span style={{
                  fontSize: '0.65rem', color: 'var(--text-dim)',
                  background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.4rem',
                  borderRadius: '4px', fontFamily: 'var(--font-jetbrains)',
                }}>
                  {col.leads.length}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {col.leads.map(lead => {
                  const dias = diasInativo(lead.updated_at || lead.created_at);
                  const valor = lead.propostas.reduce((a, p) => a + p.custo_total_centavos, 0);
                  return (
                    <a key={lead.id} href={`/leads/${lead.id}`} style={{
                      display: 'block', textDecoration: 'none',
                      background: 'var(--surface-2, rgba(255,255,255,0.03))',
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                      borderRadius: '6px', padding: '0.7rem',
                      transition: 'border-color 0.2s',
                    }}>
                      <div style={{
                        fontSize: '0.82rem', fontWeight: 500,
                        color: 'var(--gold-100, #f0e6dc)',
                        marginBottom: '0.4rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {lead.nome_cliente || 'Sem nome'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {lead.temperatura && (
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            fontSize: '0.62rem', color: tempConfig[lead.temperatura]?.color || '#888',
                            fontFamily: 'var(--font-jetbrains)',
                          }}>
                            <Thermometer size={10} /> {lead.temperatura}
                          </span>
                        )}
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '0.2rem',
                          fontSize: '0.62rem', color: dias > 7 ? '#e85d3a' : 'var(--text-dim)',
                          fontFamily: 'var(--font-jetbrains)',
                        }}>
                          <Clock size={10} /> {dias}d
                        </span>
                        {valor > 0 && (
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            fontSize: '0.62rem', color: '#5fd0b8',
                            fontFamily: 'var(--font-jetbrains)',
                          }}>
                            <DollarSign size={10} /> {formatBRL(valor)}
                          </span>
                        )}
                      </div>
                    </a>
                  );
                })}
                {col.leads.length === 0 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
