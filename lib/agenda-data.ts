import { createClient } from '@/lib/supabase/client';
import { spParaInstante } from '@/lib/tempo';

export interface UsuarioAgenda { id: string; nome: string; whatsapp_numero: string }
export interface Compromisso {
  id: string; usuario_id: string; titulo: string; descricao: string | null;
  inicio_em: string | null; hora_base: string | null;
  recorrencia: 'nenhuma' | 'diaria' | 'semanal' | 'mensal';
  dias_semana: number[] | null; dia_mes: number | null;
  antecedencia_min: number; ativo: boolean;
}
export interface ContextoAgenda { isAdmin: boolean; usuarios: UsuarioAgenda[]; meuUsuarioId: string | null }
export type FormInput = {
  usuario_id: string; titulo: string; data: string; hora: string;
  recorrencia: Compromisso['recorrencia']; dias_semana: number[]; dia_mes: number;
  antecedencia_min: number; descricao: string;
};

const COLS = 'id, usuario_id, titulo, descricao, inicio_em, hora_base, recorrencia, dias_semana, dia_mes, antecedencia_min, ativo';

/** Espelha o CHECK do banco. Retorna a mensagem de erro, ou null se estiver ok. */
export function validarForm(input: FormInput): string | null {
  if (!input.titulo.trim()) return 'Título é obrigatório.';
  if (!input.hora) return 'Hora é obrigatória.';
  if (input.recorrencia === 'nenhuma' && !input.data) return 'Compromisso único precisa de data.';
  if (input.recorrencia === 'semanal' && input.dias_semana.length === 0) return 'Escolha pelo menos um dia da semana.';
  // dia_mes é integer no banco: 15.5 (o input number aceita) voltaria como
  // "invalid input syntax for type integer". Exige inteiro, igual à Sofia.
  if (input.recorrencia === 'mensal'
    && (!Number.isInteger(input.dia_mes) || input.dia_mes < 1 || input.dia_mes > 31)) {
    return 'Escolha o dia do mês (1 a 31).';
  }
  return null;
}

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
  // Recorrente não tem inicio_em — a ordem de exibição é por próxima ocorrência, no cliente.
  const { data } = await q.order('criado_em', { ascending: true });
  return (data ?? []) as Compromisso[];
}

function payload(input: FormInput) {
  const recorrente = input.recorrencia !== 'nenhuma';
  return {
    usuario_id: input.usuario_id,
    titulo: input.titulo,
    descricao: input.descricao || null,
    inicio_em: recorrente ? null : spParaInstante(input.data, input.hora),
    hora_base: recorrente ? input.hora : null,
    recorrencia: input.recorrencia,
    dias_semana: input.recorrencia === 'semanal' ? input.dias_semana : null,
    dia_mes: input.recorrencia === 'mensal' ? input.dia_mes : null,
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
