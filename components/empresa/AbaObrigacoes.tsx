'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Check, Trash2, ExternalLink } from 'lucide-react';
import {
  listarModelos, salvarObrigacao, removerObrigacao, validarObrigacao,
  garantirOcorrencias, listarOcorrencias, marcarPaga, type ObrigacaoInput,
} from '@/lib/empresa-data';
import { statusExibido, venceEmDias, competenciaDe, type ModeloObrigacao, type Ocorrencia } from '@/lib/obrigacoes';
import { formatBRL } from '@/lib/format';
import { inputStyle, botaoStyle, labelStyle, botaoPrimarioStyle } from '@/components/empresa/estilos';

function hojeISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const CORES: Record<string, string> = {
  paga: '#4ad48a', pendente: '#d4a04a', atrasada: '#e85d75', dispensada: '#7a7a8c',
};

// Modelos típicos de ME/EPP no Simples. São SUGESTÕES: um clique preenche o formulário,
// e o Valmir edita ou apaga. Nada é criado sem ele mandar.
const SUGESTOES: Partial<ObrigacaoInput>[] = [
  { nome: 'DAS — Simples Nacional', categoria: 'fiscal', orgao: 'Receita Federal', periodicidade: 'mensal', dia_vencimento: 20 },
  { nome: 'Honorários do contador', categoria: 'contabil', periodicidade: 'mensal', dia_vencimento: 5 },
  { nome: 'Pró-labore + INSS', categoria: 'trabalhista', periodicidade: 'mensal', dia_vencimento: 20 },
  { nome: 'DEFIS', categoria: 'fiscal', orgao: 'Receita Federal', periodicidade: 'anual', mes_vencimento: 3, dia_vencimento: 31 },
  { nome: 'Renovação do certificado digital', categoria: 'societaria', periodicidade: 'anual', mes_vencimento: 1, dia_vencimento: 1 },
];

function vazio(): ObrigacaoInput {
  return {
    nome: '', categoria: 'fiscal', orgao: '', periodicidade: 'mensal',
    dia_vencimento: 20, mes_vencimento: null, vencimento_unico: '',
    valor_padrao_reais: '', link_portal: '', observacoes: '',
  };
}

export default function AbaObrigacoes() {
  const [competencia, setCompetencia] = useState(() => competenciaDe(hojeISO()).slice(0, 7)); // YYYY-MM
  const [modelos, setModelos] = useState<ModeloObrigacao[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ObrigacaoInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async (comp: string) => {
    setLoading(true); setErro('');
    const primeiroDia = `${comp}-01`;
    // Materializa antes de listar — idempotente pelo índice único no banco.
    // garantirOcorrencias() captura os próprios erros e devolve { error }.
    const { error: erroGarantir } = await garantirOcorrencias(primeiroDia);
    if (erroGarantir) setErro(erroGarantir);

    // listarModelos/listarOcorrencias LANÇAM em erro de query (ver lib/empresa-data.ts) —
    // sem o try/catch aqui vira unhandled rejection e a tela mostra "nenhuma obrigação"
    // quando a verdade é que a query falhou. Nunca deixar essa mentira na tela.
    try {
      const [novosModelos, novasOcorrencias] = await Promise.all([
        listarModelos(),
        listarOcorrencias(primeiroDia),
      ]);
      setModelos(novosModelos);
      setOcorrencias(novasOcorrencias);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar as obrigações.');
      setModelos([]);
      setOcorrencias([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { recarregar(competencia); }, [competencia, recarregar]);

  const hoje = hojeISO();
  const nome = (id: string) => modelos.find((m) => m.id === id)?.nome ?? '—';
  const linkDe = (id: string) => modelos.find((m) => m.id === id)?.link_portal ?? null;

  const comStatus = ocorrencias.map((o) => ({ o, status: statusExibido(o, hoje), dias: venceEmDias(o, hoje) }));
  const vencendo = comStatus.filter((x) => x.status === 'pendente' && x.dias <= 7).length;
  const atrasadas = comStatus.filter((x) => x.status === 'atrasada').length;
  const pagas = comStatus.filter((x) => x.status === 'paga').length;

  const pagar = async (o: Ocorrencia) => {
    const sugestao = o.valor_centavos != null ? (o.valor_centavos / 100).toFixed(2).replace('.', ',') : '';
    const valor = window.prompt(`Valor pago em ${nome(o.obrigacao_id)} (R$):`, sugestao);
    if (valor === null) return; // cancelou
    const { error } = await marcarPaga(o.id, valor, hoje);
    if (error) setErro(error); else recarregar(competencia);
  };

  const submeter = async () => {
    if (!form) return;
    const msg = validarObrigacao(form);
    if (msg) { setErro(msg); return; }
    const { error } = await salvarObrigacao(form, editId ?? undefined);
    if (error) { setErro(error); return; }
    setForm(null); setEditId(null);
    recarregar(competencia);
  };

  const excluir = async (id: string) => {
    if (!window.confirm('Desativar esta obrigação? As ocorrências passadas continuam no histórico.')) return;
    const { error } = await removerObrigacao(id);
    if (error) setErro(error); else recarregar(competencia);
  };

  const semErro = !erro;

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 960 }}>
      <div className="dash-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={labelStyle}>Competência</span>
          <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} style={inputStyle} />
        </label>
        <span style={{ color: CORES.pendente, fontSize: '0.85rem' }}>{vencendo} vencendo em 7 dias</span>
        <span style={{ color: CORES.atrasada, fontSize: '0.85rem' }}>{atrasadas} atrasada(s)</span>
        <span style={{ color: CORES.paga, fontSize: '0.85rem' }}>{pagas} paga(s)</span>
        <button type="button" className="admin-nav-link active" style={{ ...botaoPrimarioStyle, marginLeft: 'auto' }}
          onClick={() => { setForm(vazio()); setEditId(null); setErro(''); }}>
          <Plus size={14} /> Nova obrigação
        </button>
      </div>

      {erro && <div className="login-error">{erro}</div>}
      {loading && <p style={{ opacity: 0.6 }}>Carregando…</p>}

      {!loading && semErro && ocorrencias.length === 0 && (
        <div className="dash-card">
          <p>Nenhuma obrigação vence neste mês.</p>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>Sugestões para ME/EPP no Simples:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {SUGESTOES.map((s) => (
              <button key={s.nome} type="button" style={botaoStyle}
                onClick={() => { setForm({ ...vazio(), ...s }); setEditId(null); setErro(''); }}>
                <Plus size={12} /> {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && comStatus.map(({ o, status, dias }) => (
        <div key={o.id} className="dash-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 180 }}>{nome(o.obrigacao_id)}</span>
          <span style={{ opacity: 0.8 }}>
            vence {o.vencimento.slice(8, 10)}/{o.vencimento.slice(5, 7)}
            {status === 'pendente' && dias >= 0 && ` (em ${dias}d)`}
            {status === 'atrasada' && ` (há ${Math.abs(dias)}d)`}
          </span>
          <span>{o.valor_centavos != null ? formatBRL(o.valor_centavos) : '—'}</span>
          <span style={{ color: CORES[status], fontWeight: 600 }}>{status}</span>
          {linkDe(o.obrigacao_id) && (
            <a href={linkDe(o.obrigacao_id)!} target="_blank" rel="noreferrer" aria-label="Abrir portal" style={{ color: 'var(--text-dim)', display: 'flex' }}>
              <ExternalLink size={14} />
            </a>
          )}
          {status !== 'paga' && status !== 'dispensada' && (
            <button type="button" style={botaoStyle} onClick={() => pagar(o)}><Check size={14} /> Marcar paga</button>
          )}
        </div>
      ))}

      <section className="dash-card">
        <div className="dash-card-label">Obrigações cadastradas</div>
        {modelos.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.6rem' }}>
            <span style={{ flex: 1 }}>{m.nome}</span>
            <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{m.periodicidade}</span>
            <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>
              {m.valor_padrao_centavos != null ? formatBRL(m.valor_padrao_centavos) : 'valor variável'}
            </span>
            <button type="button" style={botaoStyle} onClick={() => {
              setEditId(m.id); setErro('');
              setForm({
                nome: m.nome, categoria: m.categoria, orgao: m.orgao ?? '', periodicidade: m.periodicidade,
                dia_vencimento: m.dia_vencimento, mes_vencimento: m.mes_vencimento,
                vencimento_unico: m.vencimento_unico ?? '',
                valor_padrao_reais: m.valor_padrao_centavos != null
                  ? (m.valor_padrao_centavos / 100).toFixed(2).replace('.', ',') : '',
                link_portal: m.link_portal ?? '', observacoes: m.observacoes ?? '',
              });
            }}>Editar</button>
            <button type="button" style={botaoStyle} onClick={() => excluir(m.id)} aria-label="Desativar"><Trash2 size={14} /></button>
          </div>
        ))}
        {semErro && modelos.length === 0 && <p style={{ opacity: 0.6, marginTop: '0.6rem' }}>Nenhuma obrigação cadastrada ainda.</p>}
      </section>

      {form && (
        <section className="dash-card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div className="dash-card-label">{editId ? 'Editar obrigação' : 'Nova obrigação'}</div>
          <input placeholder="Nome" value={form.nome} style={inputStyle}
            onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input placeholder="Órgão" value={form.orgao} style={inputStyle}
            onChange={(e) => setForm({ ...form, orgao: e.target.value })} />
          <select value={form.categoria} style={inputStyle} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            <option value="fiscal">Fiscal</option>
            <option value="contabil">Contábil</option>
            <option value="trabalhista">Trabalhista</option>
            <option value="societaria">Societária</option>
          </select>
          <select value={form.periodicidade} style={inputStyle}
            onChange={(e) => setForm({ ...form, periodicidade: e.target.value as ObrigacaoInput['periodicidade'] })}>
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
            <option value="unica">Única</option>
          </select>

          {form.periodicidade === 'unica' ? (
            <input type="date" value={form.vencimento_unico} style={inputStyle}
              onChange={(e) => setForm({ ...form, vencimento_unico: e.target.value })} />
          ) : (
            <input type="number" min={1} max={31} placeholder="Dia do vencimento" style={inputStyle}
              value={form.dia_vencimento ?? ''}
              onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value ? Number(e.target.value) : null })} />
          )}

          {(form.periodicidade === 'anual' || form.periodicidade === 'trimestral') && (
            <input type="number" min={1} max={12} style={inputStyle}
              placeholder={form.periodicidade === 'anual' ? 'Mês do vencimento (1-12)' : 'Mês de referência (1-12)'}
              value={form.mes_vencimento ?? ''}
              onChange={(e) => setForm({ ...form, mes_vencimento: e.target.value ? Number(e.target.value) : null })} />
          )}

          <input placeholder="Valor padrão em R$ (vazio = variável, ex.: DAS)" style={inputStyle}
            value={form.valor_padrao_reais}
            onChange={(e) => setForm({ ...form, valor_padrao_reais: e.target.value })} />
          <input placeholder="Link do portal" style={inputStyle} value={form.link_portal}
            onChange={(e) => setForm({ ...form, link_portal: e.target.value })} />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="admin-nav-link active" style={botaoPrimarioStyle} onClick={submeter}>Salvar</button>
            <button type="button" style={botaoStyle} onClick={() => { setForm(null); setEditId(null); setErro(''); }}>Cancelar</button>
          </div>
        </section>
      )}
    </div>
  );
}
