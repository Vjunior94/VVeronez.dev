// Verifica que as tabelas empresa_* são ADMIN-ONLY.
// Detecção ativa: o usuário comum TENTA ler e TENTA escrever. Se conseguir, é vazamento.
// Uso: node scripts/verify-empresa-rls.mjs <adminEmail> <adminSenha> <comumEmail> <comumSenha>
import { createClient } from '@supabase/supabase-js';

const [, , aEmail, aSenha, cEmail, cSenha] = process.argv;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABELAS = ['empresa_dados', 'empresa_obrigacoes', 'empresa_obrigacao_ocorrencias', 'empresa_custos_fixos'];

async function sessao(email, senha) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

const admin = await sessao(aEmail, aSenha);
const comum = await sessao(cEmail, cSenha);
const anonimo = createClient(url, anon, { auth: { persistSession: false } });

const falhas = [];

// 1. O admin PRECISA enxergar empresa_dados — se nem ele vê, a policy está errada
//    e o "zero linhas" do comum seria um falso OK.
const { data: adminVe, error: adminErro } = await admin.from('empresa_dados').select('id');
if (adminErro) falhas.push(`admin NAO consegue ler empresa_dados (${adminErro.message}) — policy quebrada`);
else if ((adminVe ?? []).length === 0) falhas.push('admin le 0 linhas de empresa_dados — o seed da migration nao rodou; nao posso provar isolamento');
else console.log(`admin enxerga ${adminVe.length} linha(s) de empresa_dados`);

// 2. Leitura: comum e anônimo têm que enxergar ZERO em todas as tabelas.
for (const t of TABELAS) {
  const { data: cVe } = await comum.from(t).select('id');
  if ((cVe ?? []).length > 0) falhas.push(`usuario comum enxerga ${cVe.length} linha(s) de ${t} (VAZAMENTO)`);
  const { data: aVe } = await anonimo.from(t).select('id');
  if ((aVe ?? []).length > 0) falhas.push(`ANONIMO enxerga ${aVe.length} linha(s) de ${t} (VAZAMENTO GRAVE)`);
}

// 3. Escrita: o comum tem que ser REJEITADO em TODAS as tabelas. "Nao aparecer" nao basta.
//    Payloads: cada tabela com colunas not null minimizadas.
//    empresa_obrigacao_ocorrencias é especial: FK pode barrar DEPOIS da RLS, então detecta erro de FK (23503).
const probes = [
  {
    tabela: 'empresa_dados',
    payload: { razao_social: '__probe__' },
    payloadAnon: { razao_social: '__probe_anon__' }
  },
  {
    tabela: 'empresa_obrigacoes',
    payload: { nome: '__probe__' },
    payloadAnon: { nome: '__probe_anon__' }
  },
  {
    tabela: 'empresa_obrigacao_ocorrencias',
    payload: { obrigacao_id: '11111111-1111-1111-1111-111111111111', competencia: '2099-01-01', vencimento: '2099-01-01' },
    payloadAnon: { obrigacao_id: '22222222-2222-2222-2222-222222222222', competencia: '2099-01-01', vencimento: '2099-01-01' }
  },
  {
    tabela: 'empresa_custos_fixos',
    payload: { nome: '__probe__', valor_centavos: 1 },
    payloadAnon: { nome: '__probe_anon__', valor_centavos: 1 }
  }
];

for (const p of probes) {
  const { error: errComum, status: statusComum } = await comum.from(p.tabela).insert(p.payload);
  if (!errComum) {
    falhas.push(`usuario comum CONSEGUIU inserir em ${p.tabela} (VAZAMENTO)`);
  } else if (p.tabela === 'empresa_obrigacao_ocorrencias' && errComum.code === '23503') {
    // FK barrou: significa RLS deixou passar — é um vazamento.
    falhas.push(`usuario comum PASSOU A RLS de ${p.tabela} mas foi barrado pela FK (VAZAMENTO)`);
  }

  const { error: errAnon } = await anonimo.from(p.tabela).insert(p.payloadAnon);
  if (!errAnon) {
    falhas.push(`ANONIMO CONSEGUIU inserir em ${p.tabela} (VAZAMENTO GRAVE)`);
  } else if (p.tabela === 'empresa_obrigacao_ocorrencias' && errAnon.code === '23503') {
    // FK barrou: significa RLS deixou passar — é um vazamento.
    falhas.push(`ANONIMO PASSOU A RLS de ${p.tabela} mas foi barrado pela FK (VAZAMENTO GRAVE)`);
  }
}

// Limpeza dos probes (se algum passou, precisa sumir).
if (service) {
  const svc = createClient(url, service, { auth: { persistSession: false } });
  for (const t of TABELAS) {
    if (t === 'empresa_obrigacao_ocorrencias') {
      // Deletar por competencia '2099-01-01' (UUID não importa para RLS desabilitado).
      await svc.from(t).delete().eq('competencia', '2099-01-01');
    } else if (t === 'empresa_dados') {
      // Deletar por razao_social.
      await svc.from(t).delete().in('razao_social', ['__probe__', '__probe_anon__']);
    } else {
      // empresa_obrigacoes, empresa_custos_fixos: deletar por nome.
      await svc.from(t).delete().in('nome', ['__probe__', '__probe_anon__']);
    }
  }
} else {
  console.warn('AVISO: SUPABASE_SERVICE_ROLE_KEY ausente — nao limpei eventuais linhas __probe__.');
}

if (falhas.length) { console.error('FALHOU:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('OK: tabelas empresa_* sao admin-only (leitura e escrita verificadas por rejeicao ativa).');
