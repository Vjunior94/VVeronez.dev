import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Rotas públicas — acessíveis sem login. Qualquer coisa fora desta lista
 * exige sessão de admin. Rotas novas nascem protegidas por padrão.
 *
 * Observação de segurança: o proxy é a camada de UX (redireciona quem não
 * está logado para /login). A autorização real vive na RLS do Supabase e
 * nos guards das rotas /api (lib/api-auth.ts) — nunca confie só no proxy.
 */
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/manifest.webmanifest',
  '/sw.js',
]);
const PUBLIC_PREFIXES = ['/proposta', '/imunolab'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Arquivos estáticos (com extensão no último segmento) nunca são página
  // protegida — ex: /icons/x.png, /robots.txt. Rotas de página não têm ponto.
  const ultimoSegmento = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (ultimoSegmento.includes('.')) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: getUser() precisa rodar sempre para renovar o token da sessão,
  // mesmo em rota pública. Não coloque lógica entre createServerClient e aqui.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (isPublic(pathname)) {
    return supabaseResponse;
  }

  // Rota protegida sem sessão → login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Rota protegida com sessão → precisa ser admin. Fail-closed: qualquer
  // falha na verificação (tabela ausente, erro de rede, is_admin=false)
  // resulta em bloqueio, não em acesso liberado.
  const { data: userData, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (error || !userData?.is_admin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('erro', 'sem_permissao');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
