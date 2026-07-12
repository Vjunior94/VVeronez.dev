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

// 3. Escrita: o comum tem que ser REJEITADO. "Nao aparecer" nao basta.
const { error: escritaComum } = await comum
  .from('empresa_custos_fixos').insert({ nome: '__probe__', valor_centavos: 1 });
if (!escritaComum) falhas.push('usuario comum CONSEGUIU inserir em empresa_custos_fixos (VAZAMENTO)');

const { error: escritaAnon } = await anonimo
  .from('empresa_custos_fixos').insert({ nome: '__probe_anon__', valor_centavos: 1 });
if (!escritaAnon) falhas.push('ANONIMO CONSEGUIU inserir em empresa_custos_fixos (VAZAMENTO GRAVE)');

// Limpeza dos probes (se algum passou, precisa sumir).
if (service) {
  const svc = createClient(url, service, { auth: { persistSession: false } });
  await svc.from('empresa_custos_fixos').delete().in('nome', ['__probe__', '__probe_anon__']);
} else {
  console.warn('AVISO: SUPABASE_SERVICE_ROLE_KEY ausente — nao limpei eventuais linhas __probe__.');
}

if (falhas.length) { console.error('FALHOU:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('OK: tabelas empresa_* sao admin-only (leitura e escrita verificadas por rejeicao ativa).');
