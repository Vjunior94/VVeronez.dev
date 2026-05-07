import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .order('chave');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const configs: Record<string, any> = {};
  for (const row of data ?? []) {
    try {
      configs[row.chave] = JSON.parse(row.valor);
    } catch {
      configs[row.chave] = row.valor;
    }
  }

  return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const body = await req.json() as Record<string, any>;

  const upserts = Object.entries(body).map(([chave, valor]) => ({
    chave,
    valor: JSON.stringify(valor),
  }));

  const { error } = await supabase
    .from('configuracoes')
    .upsert(upserts, { onConflict: 'chave' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
