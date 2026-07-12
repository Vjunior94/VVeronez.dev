'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  listarCustos, salvarCusto, removerCusto, validarCusto, salvarEmpresa, listarModelos,
  type CustoInput, type EmpresaDados,
} from '@/lib/empresa-data';
import { custoFixoTotalMensal, custoMensalEmBRL, custoObrigacoesMensal, type CustoFixo } from '@/lib/custos';
import type { ModeloObrigacao } from '@/lib/obrigacoes';
import { formatBRL } from '@/lib/format';
import { inputStyle, botaoStyle, labelStyle, botaoPrimarioStyle } from '@/components/empresa/estilos';

function vazio(): CustoInput {
  return { nome: '', categoria: '', valor_reais: '', moeda: 'BRL', ciclo: 'mensal', dia_cobranca: null, url: '' };
}

export default function AbaCustos({ empresa, onSalvo }: { empresa: EmpresaDados; onSalvo: () => void }) {
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [modelos, setModelos] = useState<ModeloObrigacao[]>([]);
  const [form, setForm] = useState<CustoInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [cotacao, setCotacao] = useState((empresa.cotacao_usd_centavos / 100).toFixed(2).replace('.', ','));
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  // listarModelos LANÇA em erro de query (ver lib/empresa-data.ts) — sem o try/catch
  // aqui vira unhandled rejection e a tela mostra "nenhuma assinatura cadastrada"
  // quando a verdade é que a query falhou. Mesmo padrão de AbaObrigacoes.tsx.
  const recarregar = useCallback(async () => {
    setLoading(true); setErro('');
    try {
      const [novosCustos, novosModelos] = await Promise.all([listarCustos(), listarModelos()]);
      setCustos(novosCustos);
      setModelos(novosModelos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar os custos.');
      setCustos([]);
      setModelos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const cot = empresa.cotacao_usd_centavos;
  const totalAssinaturas = custoFixoTotalMensal(custos, cot);
  const totalObrigacoes = custoObrigacoesMensal(modelos);
  const total = totalAssinaturas + totalObrigacoes;
  const semErro = !erro;
  const ativos = custos.filter((c) => c.ativo);

  const salvarCotacao = async () => {
    const centavos = Math.round(Number(cotacao.replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) { setErro('Cotação inválida.'); return; }
    const { error } = await salvarEmpresa(empresa.id, { cotacao_usd_centavos: centavos });
    if (error) setErro(error); else onSalvo();
  };

  const submeter = async () => {
    if (!form) return;
    const msg = validarCusto(form);
    if (msg) { setErro(msg); return; }
    const { error } = await salvarCusto(form, editId ?? undefined);
    if (error) { setErro(error); return; }
    setForm(null); setEditId(null); setErro('');
    recarregar();
  };

  const excluir = async (id: string) => {
    if (!window.confirm('Remover esta assinatura?')) return;
    const { error } = await removerCusto(id);
    if (error) setErro(error); else recarregar();
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 960 }}>
      <section className="dash-card">
        <div className="dash-card-label">Custo de manter a empresa viva</div>
        <p style={{ fontFamily: 'var(--font-cinzel)', fontSize: '2.2rem', marginTop: '0.5rem' }}>
          {formatBRL(total)}<span style={{ fontSize: '1rem', opacity: 0.6 }}> / mês</span>
        </p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>
          {formatBRL(totalObrigacoes)} em obrigações fixas + {formatBRL(totalAssinaturas)} em assinaturas.
          Obrigações de valor variável (ex.: DAS) ficam de fora — chutar um número aqui seria pior que omitir.
        </p>
      </section>

      <section className="dash-card" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={labelStyle}>Cotação do dólar (R$)</span>
          <input value={cotacao} onChange={(e) => setCotacao(e.target.value)} style={{ ...inputStyle, width: 120 }} />
        </label>
        <button type="button" style={botaoStyle} onClick={salvarCotacao}>Atualizar cotação</button>
        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Você mantém à mão — sem API externa.</span>
      </section>

      {erro && <div className="login-error">{erro}</div>}
      {loading && <p style={{ opacity: 0.6 }}>Carregando…</p>}

      <section className="dash-card">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="dash-card-label" style={{ flex: 1 }}>Assinaturas e ferramentas</div>
          <button type="button" className="admin-nav-link active" style={botaoPrimarioStyle}
            onClick={() => { setForm(vazio()); setEditId(null); setErro(''); }}>
            <Plus size={14} /> Novo custo
          </button>
        </div>
        {ativos.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 140 }}>{c.nome}</span>
            <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{c.moeda} · {c.ciclo}</span>
            <span>{formatBRL(custoMensalEmBRL(c, cot))}<span style={{ opacity: 0.5, fontSize: '0.8rem' }}> /mês</span></span>
            <button type="button" style={botaoStyle} onClick={() => {
              setEditId(c.id); setErro('');
              setForm({
                nome: c.nome, categoria: c.categoria ?? '',
                valor_reais: (c.valor_centavos / 100).toFixed(2).replace('.', ','),
                moeda: c.moeda, ciclo: c.ciclo, dia_cobranca: c.dia_cobranca, url: c.url ?? '',
              });
            }}>Editar</button>
            <button type="button" style={botaoStyle} onClick={() => excluir(c.id)} aria-label="Remover"><Trash2 size={14} /></button>
          </div>
        ))}
        {!loading && semErro && ativos.length === 0 && (
          <p style={{ opacity: 0.6, marginTop: '0.6rem' }}>Nenhuma assinatura cadastrada (Vercel, Railway, Supabase, domínio…).</p>
        )}
      </section>

      {form && (
        <section className="dash-card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div className="dash-card-label">{editId ? 'Editar custo' : 'Novo custo'}</div>
          <input placeholder="Nome (ex.: Vercel)" style={inputStyle} value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input placeholder="Categoria (ex.: infra)" style={inputStyle} value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          <input placeholder="Valor (ex.: 20,00)" style={inputStyle} value={form.valor_reais}
            onChange={(e) => setForm({ ...form, valor_reais: e.target.value })} />
          <select style={inputStyle} value={form.moeda}
            onChange={(e) => setForm({ ...form, moeda: e.target.value as 'BRL' | 'USD' })}>
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
          </select>
          <select style={inputStyle} value={form.ciclo}
            onChange={(e) => setForm({ ...form, ciclo: e.target.value as 'mensal' | 'anual' })}>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
          <input type="number" min={1} max={31} placeholder="Dia da cobrança (opcional)" style={inputStyle}
            value={form.dia_cobranca ?? ''}
            onChange={(e) => setForm({ ...form, dia_cobranca: e.target.value ? Number(e.target.value) : null })} />
          <input placeholder="URL (opcional)" style={inputStyle} value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="admin-nav-link active" style={botaoPrimarioStyle} onClick={submeter}>Salvar</button>
            <button type="button" style={botaoStyle} onClick={() => { setForm(null); setEditId(null); setErro(''); }}>Cancelar</button>
          </div>
        </section>
      )}
    </div>
  );
}
