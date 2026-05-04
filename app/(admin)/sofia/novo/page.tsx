'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';

const SOFIA_BACKEND = 'https://sofia-secretaria-production.up.railway.app';

export default function NovoLeadPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nome: '', telefone: '', descricao: '' });
  const [projetos, setProjetos] = useState<string[]>([]);
  const [novoProjeto, setNovoProjeto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.telefone || !form.descricao) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${SOFIA_BACKEND}/api/lead-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          telefone: form.telefone.replace(/\D/g, ''),
          descricao: form.descricao,
          projetos: projetos.length > 0 ? projetos.map(p => ({ nome: p })) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao criar lead');
      }

      const data = await res.json();
      router.push(`/sofia/${data.leadId}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar lead');
      setLoading(false);
    }
  };

  const addProjeto = () => {
    if (novoProjeto.trim()) {
      setProjetos([...projetos, novoProjeto.trim()]);
      setNovoProjeto('');
    }
  };

  const inputStyle = {
    width: '100%', padding: '0.9rem 1rem',
    background: 'rgba(10, 8, 20, 0.6)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', fontFamily: "var(--font-manrope), 'Manrope', sans-serif",
    fontSize: '0.95rem', outline: 'none',
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold-300)', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Novo Lead Manual</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '600px', display: 'grid', gap: '1.5rem' }}>
        <div className="login-field">
          <label>Nome do cliente</label>
          <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo ou empresa" required style={inputStyle} />
        </div>

        <div className="login-field">
          <label>Telefone (WhatsApp)</label>
          <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="5543999999999" required style={inputStyle} />
        </div>

        <div className="login-field">
          <label>Descrição do projeto</label>
          <textarea
            value={form.descricao}
            onChange={e => setForm({ ...form, descricao: e.target.value })}
            placeholder="Descreva o que o cliente precisa, contexto, objetivos..."
            required rows={5}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <div className="login-field">
            <label>Projetos (opcional)</label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {projetos.map((p, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.3rem 0.6rem', background: 'rgba(184,130,107,0.1)',
                border: '1px solid rgba(184,130,107,0.2)', fontSize: '0.82rem', color: 'var(--gold-100)',
              }}>
                {p}
                <button type="button" onClick={() => setProjetos(projetos.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={novoProjeto}
              onChange={e => setNovoProjeto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProjeto(); } }}
              placeholder="Nome do projeto"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="button" onClick={addProjeto} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0 1rem', background: 'none', border: '1px solid var(--border-subtle)',
              color: 'var(--gold-300)', cursor: 'pointer', fontSize: '0.75rem',
            }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.8rem 1rem', background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', color: '#e8a0a0', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <button type="submit" className="login-submit" disabled={loading} style={{ width: 'auto', padding: '0.8rem 2rem' }}>
          {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite', display: 'inline' }} /> Criando lead e gerando ficha...</> : 'Criar lead'}
        </button>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          A Sofia vai processar a descrição, preencher a ficha automaticamente e gerar a proposta se classificar como quente.
        </p>
      </form>
    </>
  );
}
