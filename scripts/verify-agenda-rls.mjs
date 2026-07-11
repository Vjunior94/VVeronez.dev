// Verifica o isolamento por-usuário logando como dois usuários.
// Detecção POR IDENTIDADE (não por contagem): qualquer linha que o Henrique
// enxergue que não seja dele é vazamento.
// Uso: node scripts/verify-agenda-rls.mjs <adminEmail> <adminSenha> <henriqueEmail> <henriqueSenha>
import { createClient } from '@supabase/supabase-js';

const [, , aEmail, aSenha, hEmail, hSenha] = process.argv;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sessao(email, senha) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

const admin = await sessao(aEmail, aSenha);
const hen = await sessao(hEmail, hSenha);

// Identidade própria do Henrique (independente da contagem).
const { data: { user: henUser } } = await hen.auth.getUser();
const { data: henMinha } = await hen.from('usuarios').select('id').eq('auth_user_id', henUser.id).maybeSingle();
const henUsuarioId = henMinha?.id ?? null;

const { data: adminVe } = await admin.from('agenda_compromissos').select('id, usuario_id');
const { data: henVe } = await hen.from('agenda_compromissos').select('id, usuario_id');
const { data: henUsuarios } = await hen.from('usuarios').select('id, nome');

console.log(`admin enxerga ${adminVe?.length ?? 0} compromissos (de ${new Set((adminVe ?? []).map((r) => r.usuario_id)).size} usuarios)`);
console.log(`henrique (usuario_id=${henUsuarioId}) enxerga ${henVe?.length ?? 0} compromissos e ${henUsuarios?.length ?? 0} linha(s) de usuarios`);

const falhas = [];
if (!henUsuarioId) falhas.push('nao consegui resolver o usuario_id do Henrique (auth_user_id nao vinculado?) — provisione antes');
for (const r of (henVe ?? [])) if (r.usuario_id !== henUsuarioId) falhas.push(`Henrique enxerga compromisso de outro dono ${r.usuario_id} (VAZAMENTO)`);
for (const r of (henUsuarios ?? [])) if (r.id !== henUsuarioId) falhas.push(`Henrique enxerga usuarios.id ${r.id} que nao e o dele (VAZAMENTO)`);

// Probe de escrita cruzada: escolhe um usuario_id != henUsuarioId.
let outro = (adminVe ?? []).map((r) => r.usuario_id).find((id) => id !== henUsuarioId);
if (!outro) {
  const { data: todos } = await admin.from('usuarios').select('id');
  outro = (todos ?? []).map((r) => r.id).find((id) => id !== henUsuarioId);
}
if (!outro) {
  falhas.push('probe de escrita cruzada NAO pode rodar (nenhum outro usuario visivel ao admin) — nao posso confirmar isolamento de escrita; verifique o ambiente/seed');
} else {
  const { error } = await hen.from('agenda_compromissos').insert({ usuario_id: outro, titulo: '__probe__', inicio_em: new Date().toISOString() });
  if (!error) falhas.push(`Henrique CONSEGUIU criar compromisso como outro dono ${outro} (VAZAMENTO)`);
  // Limpeza do probe (via service_role, se disponível), independentemente do resultado.
  if (service) {
    const svc = createClient(url, service, { auth: { persistSession: false } });
    await svc.from('agenda_compromissos').delete().eq('titulo', '__probe__');
  } else {
    console.warn('AVISO: SUPABASE_SERVICE_ROLE_KEY ausente — nao limpei eventuais linhas __probe__.');
  }
}

if (falhas.length) { console.error('FALHOU:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('OK: isolamento por-usuario verificado (por identidade).');
