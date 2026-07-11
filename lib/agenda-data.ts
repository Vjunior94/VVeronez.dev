import { createClient } from '@/lib/supabase/client';
import { spParaInstante } from '@/lib/tempo';

export interface UsuarioAgenda { id: string; nome: string; whatsapp_numero: string }
export interface Compromisso {
  id: string; usuario_id: string; titulo: string; descricao: string | null;
  inicio_em: string; recorrencia: 'nenhuma' | 'diaria' | 'semanal';
  dias_semana: number[] | null; antecedencia_min: number; ativo: boolean;
}
export interface ContextoAgenda { isAdmin: boolean; usuarios: UsuarioAgenda[]; meuUsuarioId: string | null }
export type FormInput = {
  usuario_id: string; titulo: string; data: string; hora: string;
  recorrencia: Compromisso['recorrencia']; dias_semana: number[];
  antecedencia_min: number; descricao: string;
};

const COLS = 'id, usuario_id, titulo, descricao, inicio_em, recorrencia, dias_semana, antecedencia_min, ativo';

export async function carregarContexto(): Promise<ContextoAgenda> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, usuarios: [], meuUsuarioId: null };

  const { data: perfil } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
  const isAdmin = !!perfil?.is_admin;

  // RLS: admin vê todos os usuarios; comum vê só a própria linha.
  const { data: us } = await supabase
    .from('usuarios').select('id, nome, whatsapp_numero').eq('ativo', true).order('nome');
  const usuarios = (us ?? []) as UsuarioAgenda[];

  // meuUsuarioId: a linha ligada ao auth do usuário (via a coluna auth_user_id).
  const { data: minha } = await supabase
    .from('usuarios').select('id').eq('auth_user_id', user.id).maybeSingle();
  return { isAdmin, usuarios, meuUsuarioId: minha?.id ?? null };
}

export async function listarCompromissos(usuarioId: string | 'todos'): Promise<Compromisso[]> {
  const supabase = createClient();
  let q = supabase.from('agenda_compromissos').select(COLS).eq('ativo', true);
  if (usuarioId !== 'todos') q = q.eq('usuario_id', usuarioId);
  const { data } = await q.order('inicio_em', { ascending: true });
  return (data ?? []) as Compromisso[];
}

function payload(input: FormInput) {
  return {
    usuario_id: input.usuario_id,
    titulo: input.titulo,
    descricao: input.descricao || null,
    inicio_em: spParaInstante(input.data, input.hora),
    recorrencia: input.recorrencia,
    dias_semana: input.recorrencia === 'semanal' ? input.dias_semana : null,
    antecedencia_min: input.antecedencia_min,
  };
}

export async function criarCompromisso(input: FormInput): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('agenda_compromissos').insert(payload(input));
  return { error: error?.message ?? null };
}

export async function atualizarCompromisso(id: string, input: FormInput): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('agenda_compromissos')
    .update({ ...payload(input), atualizado_em: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function removerCompromisso(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('agenda_compromissos').update({ ativo: false }).eq('id', id);
  return { error: error?.message ?? null };
}
