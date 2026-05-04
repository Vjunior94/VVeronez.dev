import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  const { id } = await params;
  const { senha } = await req.json();

  // Fetch proposta
  const { data: proposta, error } = await supabase
    .from('propostas')
    .select('*, leads(nome_cliente, whatsapp_numero)')
    .eq('id', id)
    .single();

  if (error || !proposta) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
  }

  // Validate password
  if (!proposta.senha_acesso || proposta.senha_acesso !== senha) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  // Track client access
  supabase.from('propostas').update({ ultimo_acesso_cliente: new Date().toISOString() }).eq('id', id).then(() => {});

  // Log access with geolocation (Vercel headers)
  const cidade = req.headers.get('x-vercel-ip-city') || req.headers.get('cf-ipcity') || null;
  const estado = req.headers.get('x-vercel-ip-country-region') || null;
  const pais = req.headers.get('x-vercel-ip-country') || null;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;
  supabase.from('proposta_acessos').insert({
    proposta_id: id, cidade: cidade ? decodeURIComponent(cidade) : null, estado, pais, ip, user_agent: userAgent,
  }).then(() => {});

  // Fetch modules and services
  const [modsRes, servsRes] = await Promise.all([
    supabase.from('proposta_modulos').select('*').eq('proposta_id', id).order('ordem'),
    supabase.from('proposta_servicos').select('*').eq('proposta_id', id),
  ]);

  return NextResponse.json({
    proposta,
    modulos: modsRes.data ?? [],
    servicos: servsRes.data ?? [],
    cliente: proposta.leads?.nome_cliente || 'Cliente',
  });
}
