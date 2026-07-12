// Cria (ou acha) um auth user por e-mail e liga usuarios.auth_user_id.
// Uso: node scripts/provisionar-usuario.mjs <email> <whatsapp_numero> [senha_temp]
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const [, , email, numero, senhaArg] = process.argv;
if (!email || !numero) { console.error('uso: node scripts/provisionar-usuario.mjs <email> <numero> [senha]'); process.exit(2); }

// NUNCA usar senha default fixa: o endpoint de auth do Supabase é público e a anon
// key vai no bundle do browser — uma senha conhecida = bypass de autenticação com
// um único palpite. Sem senha explícita, gera uma forte e aleatória.
const senha = senhaArg || randomBytes(18).toString('base64url');

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. cria o auth user (ou reusa se já existir)
let userId;
const { data: created, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
if (error && !/already/i.test(error.message)) { console.error('erro criando auth user:', error.message); process.exit(1); }
if (created?.user) userId = created.user.id;
if (!userId) {
  const { data: list } = await admin.auth.admin.listUsers();
  userId = list.users.find((u) => u.email === email)?.id;
}
if (!userId) { console.error('não consegui obter o id do auth user'); process.exit(1); }

// 2. liga usuarios.auth_user_id (checa que UMA linha foi de fato atualizada)
const { data: linhas, error: upErr } = await admin.from('usuarios').update({ auth_user_id: userId }).eq('whatsapp_numero', numero.replace(/\D/g, '')).select('id');
if (upErr) { console.error('erro ligando usuarios.auth_user_id:', upErr.message); process.exit(1); }
if (!linhas || linhas.length === 0) { console.error(`nenhuma linha em usuarios com numero ${numero} — rode a migration/seed antes`); process.exit(1); }
console.log(`OK: ${email} (auth ${userId}) ligado ao usuarios numero ${numero} (${linhas.length} linha). Senha temp (nao capture em log compartilhado): ${senha}`);
