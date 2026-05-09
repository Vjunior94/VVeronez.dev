import { Flame, Sun, Snowflake } from 'lucide-react';
import { createElement } from 'react';

export function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function diasInativo(dt: string): number {
  return Math.floor((Date.now() - new Date(dt).getTime()) / (1000 * 60 * 60 * 24));
}

export const tempConfig: Record<string, { label: string; color: string; iconComponent: typeof Flame }> = {
  quente: { label: 'Quente', color: '#e85d75', iconComponent: Flame },
  morno: { label: 'Morno', color: '#d4a04a', iconComponent: Sun },
  frio: { label: 'Frio', color: '#5ba8d4', iconComponent: Snowflake },
};

export function tempIcon(temp: string | null, size = 12) {
  const cfg = tempConfig[temp || ''];
  if (!cfg) return null;
  return createElement(cfg.iconComponent, { size, style: { color: cfg.color } });
}

export const statusLabels: Record<string, string> = {
  aguardando_primeira_mensagem: 'Aguardando',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  pausado: 'Pausado',
  arquivado: 'Arquivado',
  negado: 'Negado',
};
