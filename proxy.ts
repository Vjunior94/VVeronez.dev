import { updateSession } from '@/lib/supabase/proxy';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Roda em todas as rotas exceto assets estáticos e /api.
  // /api fica de fora de propósito: cada rota /api valida sua própria
  // autorização (lib/api-auth.ts) e o Vercel Edge tem limite de 1MB.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|signatures|icons|api/).*)'],
};
