'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, Plus, Send, CheckCircle, XCircle } from 'lucide-react';

interface Proposal {
  id: string;
  client_name: string;
  briefing: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export default function AgenorPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ client_name: '', briefing: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProposals();
  }, []);

  async function loadProposals() {
    const supabase = createClient();
    const { data } = await supabase
      .from('agenor_proposals')
      .select('*')
      .order('created_at', { ascending: false });
    setProposals(data ?? []);
    setLoading(false);
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
    setLoading(true);
    loadProposals();
  }

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
      ) : proposals.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhuma proposta gerada ainda.</p>
      ) : (
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
              {proposals.map((p) => {
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
      )}
    </>
  );
}
