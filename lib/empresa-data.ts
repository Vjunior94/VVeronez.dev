import { createClient } from '@/lib/supabase/client';
import type { CustoFixo } from '@/lib/custos';

// SEM campo de senha em Portal — decisão de segurança da spec: o endpoint de auth do
// Supabase é público, e um vazamento de admin viraria acesso ao e-CAC da empresa.
export interface Portal { nome: string; url: string; login: string }
export interface Documento { nome: string; url: string }
export interface Endereco {
  logradouro?: string; numero?: string; complemento?: string;
  bairro?: string; cidade?: string; uf?: string; cep?: string;
}
export interface Contador {
  nome?: string; escritorio?: string; telefone?: string; email?: string; dia_fechamento?: number;
}
export interface Certificado { tipo?: 'A1' | 'A3'; emissor?: string; validade?: string }

export interface EmpresaDados {
  id: string;
  razao_social: string | null; nome_fantasia: string | null; cnpj: string | null;
  inscricao_estadual: string | null; inscricao_municipal: string | null;
  cnae_principal: string | null; cnaes_secundarios: string[];
  regime_tributario: string; data_abertura: string | null; capital_social_centavos: number | null;
  endereco: Endereco; contador: Contador; certificado: Certificado;
  portais: Portal[]; documentos: Documento[];
  cotacao_usd_centavos: number;
}

export type CustoInput = {
  nome: string; categoria: string; valor_reais: string;
  moeda: 'BRL' | 'USD'; ciclo: 'mensal' | 'anual';
  dia_cobranca: number | null; url: string;
};

const EMPRESA_COLS = 'id, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal, cnae_principal, cnaes_secundarios, regime_tributario, data_abertura, capital_social_centavos, endereco, contador, certificado, portais, documentos, cotacao_usd_centavos';
const CUSTO_COLS = 'id, nome, categoria, valor_centavos, moeda, ciclo, dia_cobranca, url, ativo';

/** "1.234,56" | "20.50" | "20" → centavos inteiros. null se não for número. */
export function reaisParaCentavos(v: string): number | null {
  const bruto = v.trim();
  if (!bruto) return null;
  // Só trata "." como separador de milhar quando há vírgula decimal ("1.234,56").
  // Sem vírgula, "." é o próprio separador decimal ("20.50") — remover ele quebraria esse formato.
  const limpo = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  // Math.round e não truncamento: 20.15 * 100 dá 2014.9999... em ponto flutuante.
  return Math.round(n * 100);
}

export function validarCusto(input: CustoInput): string | null {
  if (!input.nome.trim()) return 'Nome é obrigatório.';
  if (reaisParaCentavos(input.valor_reais) == null) return 'Valor inválido.';
  if (input.dia_cobranca != null
    && (!Number.isInteger(input.dia_cobranca) || input.dia_cobranca < 1 || input.dia_cobranca > 31)) {
    return 'Dia da cobrança deve ficar entre 1 e 31.';
  }
  return null;
}

/** Certificado vencido trava emissão de nota fiscal — avisar com 30 dias de folga. */
export function alertaCertificado(
  cert: Certificado, hojeISO: string,
): { dias: number; nivel: 'ok' | 'atencao' | 'vencido' } | null {
  if (!cert.validade) return null;
  const [va, vm, vd] = cert.validade.slice(0, 10).split('-').map(Number);
  const [ha, hm, hd] = hojeISO.slice(0, 10).split('-').map(Number);
  const dias = Math.round((Date.UTC(va, vm - 1, vd) - Date.UTC(ha, hm - 1, hd)) / 86_400_000);
  if (dias < 0) return { dias, nivel: 'vencido' };
  return { dias, nivel: dias <= 30 ? 'atencao' : 'ok' };
}

export async function carregarEmpresa(): Promise<EmpresaDados | null> {
  const supabase = createClient();
  // A migration semeia exatamente uma linha. maybeSingle: se a RLS barrar, volta null
  // em vez de estourar — a UI mostra "sem acesso" em vez de tela branca.
  const { data } = await supabase.from('empresa_dados').select(EMPRESA_COLS).limit(1).maybeSingle();
  return (data as EmpresaDados | null) ?? null;
}

export async function salvarEmpresa(id: string, dados: Partial<EmpresaDados>): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('empresa_dados')
    .update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function listarCustos(): Promise<CustoFixo[]> {
  const supabase = createClient();
  const { data } = await supabase.from('empresa_custos_fixos').select(CUSTO_COLS).order('nome');
  return (data ?? []) as CustoFixo[];
}

export async function salvarCusto(input: CustoInput, id?: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const payload = {
    nome: input.nome.trim(),
    categoria: input.categoria || null,
    valor_centavos: reaisParaCentavos(input.valor_reais)!,  // validarCusto() roda antes
    moeda: input.moeda,
    ciclo: input.ciclo,
    dia_cobranca: input.dia_cobranca,
    url: input.url || null,
  };
  const { error } = id
    ? await supabase.from('empresa_custos_fixos').update(payload).eq('id', id)
    : await supabase.from('empresa_custos_fixos').insert(payload);
  return { error: error?.message ?? null };
}

export async function removerCusto(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from('empresa_custos_fixos').update({ ativo: false }).eq('id', id);
  return { error: error?.message ?? null };
}
