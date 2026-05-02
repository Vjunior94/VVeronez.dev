'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getDDDInfo, formatPhone } from '@/lib/ddd';
import { MessageSquare, Clock, CheckCircle, Archive, Flame, Snowflake, Sun } from 'lucide-react';

interface Lead {
  id: string;
  whatsapp_numero: string;
  nome_cliente: string | null;
  status: string;
  temperatura: string | null;
  resumo_executivo: string | null;
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

type FilterKey = 'todos' | 'em_andamento' | 'finalizado' | 'quente' | 'negado';

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
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('leads')
        .select('id, whatsapp_numero, nome_cliente, status, temperatura, resumo_executivo, total_mensagens, created_at, finalizado_em')
        .is('arquivado_em', null)
        .order('created_at', { ascending: false });
      setAllLeads(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const leads = allLeads.filter(l => {
    if (filter === 'todos') return true;
    if (filter === 'quente') return l.temperatura === 'quente';
    return l.status === filter;
  });

  const stats = {
    total: allLeads.length,
    emAndamento: allLeads.filter(l => l.status === 'em_andamento').length,
    finalizados: allLeads.filter(l => l.status === 'finalizado').length,
    quentes: allLeads.filter(l => l.temperatura === 'quente').length,
    negados: allLeads.filter(l => l.status === 'negado').length,
  };

  const filters: { key: FilterKey; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'todos', label: 'Todos', count: stats.total, icon: <MessageSquare size={14} /> },
    { key: 'em_andamento', label: 'Ativos', count: stats.emAndamento, icon: <Clock size={14} /> },
    { key: 'finalizado', label: 'Finalizados', count: stats.finalizados, icon: <CheckCircle size={14} /> },
    { key: 'quente', label: 'Quentes', count: stats.quentes, icon: <Flame size={14} /> },
    { key: 'negado', label: 'Negados', count: stats.negados, icon: <Archive size={14} /> },
  ];

  return (
    <>
      <h1 className="admin-page-title">Sofia — Leads</h1>

      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', ...Object.fromEntries([[temp.color.split(':')[0], temp.color.split(':')[1].replace(';','')]]) }}>
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
