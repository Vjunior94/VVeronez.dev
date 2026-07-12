'use client';

import { useState } from 'react';
import { Copy, Check, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  salvarEmpresa, alertaCertificado, reaisParaCentavos, motivoValorInvalido,
  type EmpresaDados, type Portal, type Documento,
} from '@/lib/empresa-data';
import { inputStyle, botaoStyle, labelStyle } from '@/components/empresa/estilos';

function hojeISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function Campo({ label, valor, onChange, copiavel = false }: {
  label: string; valor: string; onChange: (v: string) => void; copiavel?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(valor);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ display: 'flex', gap: '0.25rem' }}>
        <input value={valor} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        {copiavel && (
          <button type="button" onClick={copiar} title={`Copiar ${label}`} disabled={!valor} style={botaoStyle}>
            {copiado ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </span>
    </label>
  );
}

export default function AbaIdentidade({ empresa, onSalvo }: {
  empresa: EmpresaDados; onSalvo: () => void;
}) {
  const [e, setE] = useState<EmpresaDados>(empresa);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  // Capital social mora em `e.capital_social_centavos` (centavos), mas o usuário digita em
  // reais — precisa de um state string à parte, igual ao padrão de valor_reais em AbaCustos.
  const [capitalSocial, setCapitalSocial] = useState(
    empresa.capital_social_centavos != null
      ? (empresa.capital_social_centavos / 100).toFixed(2).replace('.', ',')
      : '',
  );

  const set = <K extends keyof EmpresaDados>(k: K, v: EmpresaDados[K]) => setE((prev) => ({ ...prev, [k]: v }));
  const alerta = alertaCertificado(e.certificado, hojeISO());

  const salvar = async () => {
    setSalvando(true); setErro('');

    // reaisParaCentavos rejeita entrada ambígua (ex.: "1.200" sem vírgula) devolvendo null —
    // aborta o save e mostra o motivo em vez de gravar lixo ou silenciosamente virar null.
    const capitalCentavos = capitalSocial.trim() ? reaisParaCentavos(capitalSocial) : null;
    if (capitalSocial.trim() && capitalCentavos == null) {
      setErro(motivoValorInvalido(capitalSocial));
      setSalvando(false);
      return;
    }

    const diaFechamento = e.contador.dia_fechamento;
    if (diaFechamento != null
      && (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 31)) {
      setErro('Dia do fechamento deve ficar entre 1 e 31.');
      setSalvando(false);
      return;
    }

    const { id, ...dados } = e;
    // M1: limpar um <input type="date"> dispara onChange com '', e a coluna do Postgres é
    // `date` — mandar '' pra lá estoura "invalid input syntax for type date: \"\"" cru na
    // tela. Normaliza toda data vazia pra null (que a coluna aceita) antes do PATCH.
    const payload: typeof dados = {
      ...dados,
      data_abertura: dados.data_abertura || null,
      certificado: { ...dados.certificado, validade: dados.certificado.validade || null },
      capital_social_centavos: capitalCentavos,
      // "Adicionar CNAE" cria uma linha vazia pro usuário preencher — se ele deixar em
      // branco, não deve virar item na coluna text[].
      cnaes_secundarios: dados.cnaes_secundarios.map((c) => c.trim()).filter(Boolean),
    };
    const { error } = await salvarEmpresa(id, payload);
    setSalvando(false);
    if (error) setErro(error); else onSalvo();
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 960 }}>
      {alerta && alerta.nivel !== 'ok' && (
        <div className="dash-card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: alerta.nivel === 'vencido' ? '#e85d75' : '#d4a04a' }}>
          <AlertTriangle size={16} style={{ color: alerta.nivel === 'vencido' ? '#e85d75' : '#d4a04a', flexShrink: 0 }} />
          <span>
            {alerta.nivel === 'vencido'
              ? `Certificado digital VENCIDO há ${Math.abs(alerta.dias)} dia(s) — emissão de nota fiscal travada.`
              : `Certificado digital vence em ${alerta.dias} dia(s). Renove antes de travar a emissão de nota.`}
          </span>
        </div>
      )}

      <section className="dash-card">
        <div className="dash-card-label">Cadastro</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.8rem' }}>
          <Campo label="Razão social" valor={e.razao_social ?? ''} onChange={(v) => set('razao_social', v)} copiavel />
          <Campo label="Nome fantasia" valor={e.nome_fantasia ?? ''} onChange={(v) => set('nome_fantasia', v)} />
          <Campo label="CNPJ" valor={e.cnpj ?? ''} onChange={(v) => set('cnpj', v)} copiavel />
          <Campo label="Inscrição estadual" valor={e.inscricao_estadual ?? ''} onChange={(v) => set('inscricao_estadual', v)} copiavel />
          <Campo label="Inscrição municipal" valor={e.inscricao_municipal ?? ''} onChange={(v) => set('inscricao_municipal', v)} copiavel />
          <Campo label="CNAE principal" valor={e.cnae_principal ?? ''} onChange={(v) => set('cnae_principal', v)} copiavel />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={labelStyle}>Data de abertura</span>
            <input type="date" value={e.data_abertura ?? ''} onChange={(ev) => set('data_abertura', ev.target.value)} style={inputStyle} />
          </label>
          <Campo label="Regime tributário" valor={e.regime_tributario} onChange={(v) => set('regime_tributario', v)} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={labelStyle}>Capital social (R$)</span>
            <input placeholder="Ex.: 10.000,00" value={capitalSocial}
              onChange={(ev) => setCapitalSocial(ev.target.value)} style={inputStyle} />
          </label>
        </div>
      </section>

      <section className="dash-card">
        <div className="dash-card-label">CNAEs secundários</div>
        {e.cnaes_secundarios.map((cnae, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input placeholder="CNAE" value={cnae} style={{ ...inputStyle, flex: 1 }}
              onChange={(ev) => set('cnaes_secundarios', e.cnaes_secundarios.map((x, j) => j === i ? ev.target.value : x))} />
            <button type="button" onClick={() => set('cnaes_secundarios', e.cnaes_secundarios.filter((_, j) => j !== i))} aria-label="Remover CNAE" style={botaoStyle}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" style={{ ...botaoStyle, marginTop: '0.75rem' }}
          onClick={() => set('cnaes_secundarios', [...e.cnaes_secundarios, ''])}>
          <Plus size={14} /> Adicionar CNAE
        </button>
      </section>

      <section className="dash-card">
        <div className="dash-card-label">Endereço fiscal</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.8rem' }}>
          {(['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep'] as const).map((k) => (
            <Campo key={k} label={k[0].toUpperCase() + k.slice(1)} valor={e.endereco[k] ?? ''}
              onChange={(v) => set('endereco', { ...e.endereco, [k]: v })} />
          ))}
        </div>
      </section>

      <section className="dash-card">
        <div className="dash-card-label">Contador</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.8rem' }}>
          <Campo label="Nome" valor={e.contador.nome ?? ''} onChange={(v) => set('contador', { ...e.contador, nome: v })} />
          <Campo label="Escritório" valor={e.contador.escritorio ?? ''} onChange={(v) => set('contador', { ...e.contador, escritorio: v })} />
          <Campo label="Telefone" valor={e.contador.telefone ?? ''} onChange={(v) => set('contador', { ...e.contador, telefone: v })} copiavel />
          <Campo label="E-mail" valor={e.contador.email ?? ''} onChange={(v) => set('contador', { ...e.contador, email: v })} copiavel />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={labelStyle}>Dia do fechamento</span>
            <input type="number" min={1} max={31} placeholder="Opcional" style={inputStyle}
              value={e.contador.dia_fechamento ?? ''}
              onChange={(ev) => set('contador', {
                ...e.contador,
                dia_fechamento: ev.target.value ? Number(ev.target.value) : undefined,
              })} />
          </label>
        </div>
      </section>

      <section className="dash-card">
        <div className="dash-card-label">Certificado digital</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.8rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={labelStyle}>Tipo</span>
            <select value={e.certificado.tipo ?? 'A1'} style={inputStyle}
              onChange={(ev) => set('certificado', { ...e.certificado, tipo: ev.target.value as 'A1' | 'A3' })}>
              <option value="A1">A1</option>
              <option value="A3">A3</option>
            </select>
          </label>
          <Campo label="Emissor" valor={e.certificado.emissor ?? ''} onChange={(v) => set('certificado', { ...e.certificado, emissor: v })} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={labelStyle}>Validade</span>
            <input type="date" value={e.certificado.validade ?? ''} style={inputStyle}
              onChange={(ev) => set('certificado', { ...e.certificado, validade: ev.target.value })} />
          </label>
        </div>
      </section>

      <section className="dash-card">
        <div className="dash-card-label">Portais</div>
        <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem' }}>
          Sem senha, de propósito. Guardamos só o link e o login — a senha fica no seu gerenciador.
        </p>
        {e.portais.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input placeholder="Nome" value={p.nome} style={{ ...inputStyle, flex: 1 }}
              onChange={(ev) => set('portais', e.portais.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))} />
            <input placeholder="URL" value={p.url} style={{ ...inputStyle, flex: 2 }}
              onChange={(ev) => set('portais', e.portais.map((x, j) => j === i ? { ...x, url: ev.target.value } : x))} />
            <input placeholder="Login" value={p.login} style={{ ...inputStyle, flex: 1 }}
              onChange={(ev) => set('portais', e.portais.map((x, j) => j === i ? { ...x, login: ev.target.value } : x))} />
            <button type="button" onClick={() => set('portais', e.portais.filter((_, j) => j !== i))} aria-label="Remover portal" style={botaoStyle}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" style={{ ...botaoStyle, marginTop: '0.75rem' }}
          onClick={() => set('portais', [...e.portais, { nome: '', url: '', login: '' } as Portal])}>
          <Plus size={14} /> Adicionar portal
        </button>
      </section>

      <section className="dash-card">
        <div className="dash-card-label">Documentos</div>
        <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem' }}>Link externo (Drive/OneDrive) — nada é enviado para o banco.</p>
        {e.documentos.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input placeholder="Nome" value={d.nome} style={{ ...inputStyle, flex: 1 }}
              onChange={(ev) => set('documentos', e.documentos.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))} />
            <input placeholder="URL" value={d.url} style={{ ...inputStyle, flex: 2 }}
              onChange={(ev) => set('documentos', e.documentos.map((x, j) => j === i ? { ...x, url: ev.target.value } : x))} />
            <button type="button" onClick={() => set('documentos', e.documentos.filter((_, j) => j !== i))} aria-label="Remover documento" style={botaoStyle}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" style={{ ...botaoStyle, marginTop: '0.75rem' }}
          onClick={() => set('documentos', [...e.documentos, { nome: '', url: '' } as Documento])}>
          <Plus size={14} /> Adicionar documento
        </button>
      </section>

      {erro && <div className="login-error">{erro}</div>}
      <button onClick={salvar} disabled={salvando} className="admin-nav-link active" style={{ justifySelf: 'start', padding: '0.6rem 1.5rem', cursor: 'pointer', border: 'none' }}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  );
}
