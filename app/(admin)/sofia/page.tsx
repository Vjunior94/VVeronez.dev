'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCachedFetch } from '@/lib/use-cached-fetch';
import { getDDDInfo, formatPhone } from '@/lib/ddd';
import { MessageSquare, Clock, CheckCircle, Archive, Flame, Snowflake, Sun, Search, Plus } from 'lucide-react';

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
  finalizado_em: string | null;
}

const tempConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  quente: { label: 'Quente', color: 'color: #e85d75;', icon: <Flame size={12} /> },
  morno: { label: 'Morno', color: 'color: #d4a04a;', icon: <Sun size={12} /> },
  frio: { label: 'Frio', color: 'color: #5ba8d4;', icon: <Snowflake size={12} /> },
};

const statusLabels: Record<string, string> = {
  aguardando_primeira_mensagem: 'Aguardando',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  pausado: 'Pausado',
  arquivado: 'Arquivado',
  negado: 'Negado',
};

type FilterKey = 'todos' | 'em_andamento' | 'finalizado' | 'quente' | 'morno' | 'frio' | 'negado';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function SofiaPage() {
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [search, setSearch] = useState('');

  const [allLeads, loading] = useCachedFetch<Lead[]>('sofia-leads', async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('leads')
      .select('id, whatsapp_numero, nome_cliente, status, temperatura, resumo_executivo, justificativa_temperatura, total_mensagens, created_at, finalizado_em')
      .is('arquivado_em', null)
      .order('created_at', { ascending: false });
    return data ?? [];
  });

  const all = allLeads ?? [];
  const leads = all.filter(l => {
    // Filter
    if (filter === 'quente') { if (l.temperatura !== 'quente') return false; }
    else if (filter === 'morno') { if (l.temperatura !== 'morno') return false; }
    else if (filter === 'frio') { if (l.temperatura !== 'frio') return false; }
    else if (filter !== 'todos') { if (l.status !== filter) return false; }
    // Search
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Sofia — Leads</h1>
        <a href="/sofia/novo" style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 1rem', background: 'none',
          border: '1px solid var(--border-subtle)', color: 'var(--gold-300)',
          fontSize: '0.72rem', textDecoration: 'none',
          fontFamily: "var(--font-jetbrains)", letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <Plus size={14} /> Novo Lead
        </a>
      </div>

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
            <div className="dash-card-value">{loading ? '—' : f.count}</div>
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
      ) : leads.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhum lead encontrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {leads.map((lead) => {
            const temp = tempConfig[lead.temperatura || ''];
            const dddInfo = getDDDInfo(lead.whatsapp_numero);
            return (
              <a
                key={lead.id}
                href={`/sofia/${lead.id}`}
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
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', ...Object.fromEntries([[temp.color.split(':')[0], temp.color.split(':')[1].replace(';','')]]), cursor: lead.justificativa_temperatura ? 'help' : undefined }}
                      >
                        {temp.icon} {temp.label}
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
      )}
    </>
  );
}
