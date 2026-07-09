import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Guard para rotas /api que usam a service_role key.
 *
 * O proxy.ts NÃO cobre /api (o matcher exclui essas rotas), então qualquer
 * rota que fale com o banco com service_role precisa validar a sessão aqui —
 * senão fica aberta para a internet inteira.
 *
 * Uso:
 *   const auth = await requireAdmin();
 *   if (!auth.ok) return auth.response;
 *   // ... segue com auth.user
 */
export async function requireAdmin(): Promise<
  | { ok: true; user: { id: string; email?: string } }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  // Fail-closed: sem confirmação positiva de is_admin, nega.
  if (error || !data?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email } };
}
