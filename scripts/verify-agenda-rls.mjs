// Verifica o isolamento por-usuário logando como dois usuários.
// Uso: node scripts/verify-agenda-rls.mjs <adminEmail> <adminSenha> <henriqueEmail> <henriqueSenha>
import { createClient } from '@supabase/supabase-js';

const [, , aEmail, aSenha, hEmail, hSenha] = process.argv;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function sessao(email, senha) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

const admin = await sessao(aEmail, aSenha);
const hen = await sessao(hEmail, hSenha);

const { data: adminVe } = await admin.from('agenda_compromissos').select('id, usuario_id');
const { data: henVe } = await hen.from('agenda_compromissos').select('id, usuario_id');
const { data: henUsuarios } = await hen.from('usuarios').select('id, nome');

const donosHen = new Set((henVe ?? []).map((r) => r.usuario_id));
console.log(`admin enxerga ${adminVe?.length ?? 0} compromissos (de ${new Set((adminVe??[]).map(r=>r.usuario_id)).size} usuarios)`);
console.log(`henrique enxerga ${henVe?.length ?? 0} compromissos (de ${donosHen.size} usuario) e ${henUsuarios?.length ?? 0} linha(s) de usuarios`);

const falhas = [];
if (donosHen.size > 1) falhas.push('Henrique enxerga compromissos de mais de um usuario (VAZAMENTO)');
if ((henUsuarios?.length ?? 0) > 1) falhas.push('Henrique enxerga mais de uma linha em usuarios (VAZAMENTO)');
// tentativa de escrita cruzada: Henrique cria como outro dono
const outro = (adminVe ?? []).map((r) => r.usuario_id).find((id) => !donosHen.has(id));
if (outro) {
  const { error } = await hen.from('agenda_compromissos').insert({ usuario_id: outro, titulo: '__probe__', inicio_em: new Date().toISOString() });
  if (!error) falhas.push('Henrique CONSEGUIU criar compromisso como outro dono (VAZAMENTO)');
}
if (falhas.length) { console.error('FALHOU:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('OK: isolamento por-usuario verificado.');
