// Cria (ou acha) um auth user por e-mail e liga usuarios.auth_user_id.
// Uso: node scripts/provisionar-usuario.mjs <email> <whatsapp_numero> [senha_temp]
import { createClient } from '@supabase/supabase-js';

const [, , email, numero, senha = 'Trocar@123'] = process.argv;
if (!email || !numero) { console.error('uso: node scripts/provisionar-usuario.mjs <email> <numero> [senha]'); process.exit(2); }

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

// 2. liga usuarios.auth_user_id
const { error: upErr } = await admin.from('usuarios').update({ auth_user_id: userId }).eq('whatsapp_numero', numero.replace(/\D/g, ''));
if (upErr) { console.error('erro ligando usuarios.auth_user_id:', upErr.message); process.exit(1); }
console.log(`OK: ${email} (auth ${userId}) ligado ao usuarios numero ${numero}. Senha temp: ${senha}`);
