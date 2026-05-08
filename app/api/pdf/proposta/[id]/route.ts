import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { exportPropostaPDF } from '@/lib/export-proposta-pdf';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  const { data: proposta } = await supabase
    .from('propostas')
    .select('*, leads(id, whatsapp_numero, nome_cliente, created_at)')
    .eq('id', id)
    .single();

  if (!proposta) return NextResponse.json({ error: 'Proposta not found' }, { status: 404 });

  const lead = proposta.leads as { id: string; whatsapp_numero: string; nome_cliente: string | null; created_at: string };

  const [modulosRes, servicosRes] = await Promise.all([
    supabase.from('modulos').select('*').eq('proposta_id', id).order('ordem'),
    supabase.from('servicos').select('*').eq('proposta_id', id),
  ]);

  const { doc, fileName } = exportPropostaPDF(lead, proposta, modulosRes.data || [], servicosRes.data || []);
  const arrayBuffer = doc.output('arraybuffer');
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return NextResponse.json({ base64, fileName });
}
