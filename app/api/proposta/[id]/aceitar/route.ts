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
  const { nome, email, status, motivo } = await req.json();

  // status: 'aceito' | 'recusado' | 'consideracoes'
  if (!nome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Nome e email são obrigatórios' }, { status: 400 });
  }
  if (!['aceito', 'recusado', 'consideracoes'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }
  if (status === 'recusado' && !motivo?.trim()) {
    return NextResponse.json({ error: 'Motivo é obrigatório para recusa' }, { status: 400 });
  }

  // Verificar se proposta existe e pegar lead_id
  const { data: proposta } = await supabase
    .from('propostas')
    .select('id, lead_id, leads(nome_cliente)')
    .eq('id', id)
    .single();

  if (!proposta) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
  }

  // Verificar se já existe resposta definitiva (aceito/recusado)
  const { data: existente } = await supabase
    .from('proposta_aceites')
    .select('id, status')
    .eq('proposta_id', id)
    .in('status', ['aceito', 'recusado'])
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ error: 'Proposta já possui uma resposta definitiva' }, { status: 409 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;

  // Inserir resposta (permite múltiplas considerações, mas só 1 aceite/recusa via check acima)
  const { error } = await supabase.from('proposta_aceites').insert({
    proposta_id: id,
    nome: nome.trim(),
    email: email.trim(),
    status,
    motivo: motivo?.trim() || null,
    ip,
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: 'Erro ao registrar resposta' }, { status: 500 });
  }

  const clienteNome = (proposta as any).leads?.nome_cliente || nome.trim();
  const leadId = proposta.lead_id;

  try {
    if (status === 'aceito') {
      await supabase.from('notificacoes_valmir').insert({
        lead_id: leadId,
        tipo: 'aceite_proposta',
        titulo: `Proposta ACEITA por ${clienteNome}!`,
        mensagem: `${clienteNome} (${email.trim()}) aceitou a proposta e está pronto para alinhar detalhes e gerar contrato.`,
      });
    } else if (status === 'recusado') {
      // Salvar motivo na ficha do cliente
      if (leadId) {
        await supabase.from('ficha_campos').insert({
          lead_id: leadId,
          campo: 'motivo_recusa_proposta',
          valor_estruturado: motivo.trim(),
          frase_original: `Cliente recusou proposta: ${motivo.trim()}`,
          confianca: 'alta',
        });
      }
      await supabase.from('notificacoes_valmir').insert({
        lead_id: leadId,
        tipo: 'recusa_proposta',
        titulo: `Proposta RECUSADA por ${clienteNome}`,
        mensagem: `${clienteNome} (${email.trim()}) recusou a proposta.\n\nMotivo: ${motivo.trim()}`,
      });
    } else if (status === 'consideracoes') {
      await supabase.from('notificacoes_valmir').insert({
        lead_id: leadId,
        tipo: 'consideracoes_proposta',
        titulo: `Considerações de ${clienteNome}`,
        mensagem: `${clienteNome} (${email.trim()}) adicionou considerações à proposta:\n\n"${motivo?.trim() || '(sem texto)'}"`,
      });
      // Salvar considerações na ficha
      if (leadId && motivo?.trim()) {
        await supabase.from('ficha_campos').insert({
          lead_id: leadId,
          campo: 'consideracoes_proposta',
          valor_estruturado: motivo.trim(),
          frase_original: `Cliente enviou considerações: ${motivo.trim()}`,
          confianca: 'alta',
        });
      }
    }
  } catch {
    // Não bloquear por erro de notificação
  }

  return NextResponse.json({ success: true, status });
}
