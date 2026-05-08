import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { exportFichaPDF } from '@/lib/export-ficha-pdf';

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

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const [fichaRes, frasesRes] = await Promise.all([
    supabase.from('ficha_campos').select('*').eq('lead_id', lead.id),
    supabase.from('frases_ouro').select('*').eq('lead_id', lead.id),
  ]);

  const { doc, fileName } = exportFichaPDF(lead, fichaRes.data || [], frasesRes.data || []);
  const arrayBuffer = doc.output('arraybuffer');
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return NextResponse.json({ base64, fileName });
}
