'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCachedFetch } from '@/lib/use-cached-fetch';
import { FileText, Plus, Send, CheckCircle, XCircle, Trash2 } from 'lucide-react';

interface Proposal {
  id: string;
  client_name: string;
  briefing: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

interface SofiaProposta {
  id: string;
  lead_id: string;
  status: string;
  resumo: string | null;
  custo_total_centavos: number;
  total_horas: number;
  created_at: string;
  leads: { nome_cliente: string | null } | null;
}

async function fetchAgenorData() {
  const supabase = createClient();
  const [agenorRes, sofiaRes] = await Promise.all([
    supabase.from('agenor_proposals').select('*').order('created_at', { ascending: false }),
    supabase.from('propostas').select('id, lead_id, status, resumo, custo_total_centavos, total_horas, created_at, leads(nome_cliente)').order('created_at', { ascending: false }),
  ]);
  return {
    proposals: agenorRes.data ?? [],
    sofiaPropostas: (sofiaRes.data ?? []) as unknown as SofiaProposta[],
  };
}

export default function AgenorPage() {
  const [cached, loading] = useCachedFetch('agenor-data', fetchAgenorData);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [sofiaPropostas, setSofiaPropostas] = useState<SofiaProposta[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ client_name: '', briefing: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Use local state if modified, otherwise cached
  const displayProposals = proposals ?? cached?.proposals ?? [];
  const displaySofia = sofiaPropostas ?? cached?.sofiaPropostas ?? [];

  async function reloadProposals() {
    const data = await fetchAgenorData();
    setProposals(data.proposals);
    setSofiaPropostas(data.sofiaPropostas);
    try { sessionStorage.setItem('cache:agenor-data', JSON.stringify(data)); } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.client_name || !formData.briefing) return;
    setSubmitting(true);

    const supabase = createClient();
    await supabase.from('agenor_proposals').insert({
      client_name: formData.client_name,
      briefing: formData.briefing,
      scope: { tasks: [], deliverables: [] },
      pricing: { total: 0, breakdown: [] },
      timeline: { weeks: 0, milestones: [] },
      status: 'draft',
    });

    setFormData({ client_name: '', briefing: '' });
    setShowForm(false);
    setSubmitting(false);
    reloadProposals();
  }

  const handleDeleteProposta = async (propostaId: string) => {
    if (!confirm('Apagar esta proposta e todos os módulos/serviços associados?')) return;
    setDeletingId(propostaId);
    const supabase = createClient();
    await supabase.from('propostas').delete().eq('id', propostaId);
    setSofiaPropostas(prev => (prev ?? []).filter(p => p.id !== propostaId));
    try {
      const data = { proposals: displayProposals, sofiaPropostas: displaySofia.filter(p => p.id !== propostaId) };
      sessionStorage.setItem('cache:agenor-data', JSON.stringify(data));
    } catch {}
    setDeletingId(null);
  };

  const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    draft: { label: 'Rascunho', icon: <FileText size={12} />, className: '' },
    sent: { label: 'Enviada', icon: <Send size={12} />, className: 'status-active' },
    accepted: { label: 'Aceita', icon: <CheckCircle size={12} />, className: 'status-qualified' },
    rejected: { label: 'Recusada', icon: <XCircle size={12} />, className: 'status-archived' },
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Agenor — Propostas</h1>
        <button
          className="cases-show-all"
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.72rem' }}
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={14} />
          Nova proposta
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="dash-card"
          style={{ marginBottom: '1.5rem', display: 'grid', gap: '1.2rem' }}
        >
          <div className="login-field">
            <label htmlFor="client_name">Nome do cliente</label>
            <input
              id="client_name"
              type="text"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              placeholder="Empresa ou nome do cliente"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="briefing">Briefing</label>
            <textarea
              id="briefing"
              value={formData.briefing}
              onChange={(e) => setFormData({ ...formData, briefing: e.target.value })}
              placeholder="Descreva o projeto, necessidades e contexto..."
              required
              rows={5}
              style={{
                width: '100%',
                padding: '0.9rem 1rem',
                background: 'rgba(10, 8, 20, 0.6)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontFamily: "var(--font-manrope), 'Manrope', sans-serif",
                fontSize: '0.95rem',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="cases-show-all"
              style={{ padding: '0.5rem 1rem', fontSize: '0.72rem' }}
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="login-submit"
              style={{ width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.78rem' }}
              disabled={submitting}
            >
              {submitting ? 'Criando...' : 'Criar proposta'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando...</p>
      ) : (
        <>
          {/* Propostas geradas pelo Agenor (via Sofia leads) */}
          {displaySofia.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{
                fontSize: '0.72rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.15em',
                color: 'var(--gold-300)', textTransform: 'uppercase', marginBottom: '1rem',
              }}>
                Propostas de leads ({displaySofia.length})
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Status</th>
                      <th>Valor</th>
                      <th>Horas</th>
                      <th>Criada</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displaySofia.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.leads?.nome_cliente || 'Sem nome'}</td>
                        <td>
                          <span className={`status-badge ${p.status === 'pronta' ? 'status-active' : p.status === 'revisada' ? 'status-qualified' : ''}`}>
                            {p.status === 'pronta' ? 'Pronta' : p.status === 'revisada' ? 'Revisada' : p.status === 'gerando' ? 'Gerando...' : p.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: "var(--font-jetbrains)", fontSize: '0.82rem' }}>
                          {(p.custo_total_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{p.total_horas}h</td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <a href={`/sofia/${p.lead_id}`} style={{
                            fontSize: '0.7rem', color: 'var(--gold-300)', textDecoration: 'none',
                            fontFamily: "var(--font-jetbrains)",
                          }}>
                            Ver lead →
                          </a>
                          <button onClick={(e) => { e.preventDefault(); handleDeleteProposta(p.id); }} disabled={deletingId === p.id} style={{
                            background: 'none', border: 'none', color: '#e88',
                            cursor: 'pointer', padding: '0.2rem', opacity: deletingId === p.id ? 0.5 : 1,
                          }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Propostas manuais do Agenor */}
          {displayProposals.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.72rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.15em',
                color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '1rem',
              }}>
                Propostas manuais ({displayProposals.length})
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Status</th>
                      <th>Briefing</th>
                      <th>Criada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayProposals.map((p) => {
                      const sc = statusConfig[p.status] || statusConfig.draft;
                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{p.client_name}</td>
                          <td>
                            <span className={`status-badge ${sc.className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              {sc.icon} {sc.label}
                            </span>
                          </td>
                          <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {p.briefing}
                          </td>
                          <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                            {new Date(p.created_at).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {displayProposals.length === 0 && displaySofia.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhuma proposta gerada ainda.</p>
          )}
        </>
      )}
    </>
  );
}
