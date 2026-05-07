-- ═══ Feature 1: Follow-up Automático ═══
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tentativa INT NOT NULL DEFAULT 1,
  tipo TEXT NOT NULL DEFAULT '24h',
  mensagem TEXT,
  enviado_em TIMESTAMPTZ,
  respondido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups(lead_id);

-- Configs iniciais de follow-up (ignorar se já existem)
INSERT INTO configuracoes (chave, valor) VALUES
  ('followup_ativo', '"true"'),
  ('followup_intervalos_horas', '[24, 72, 168]'),
  ('followup_max_tentativas', '3')
ON CONFLICT (chave) DO NOTHING;

-- ═══ Feature 2: Aceite Digital (com status e motivo) ═══
-- Se a tabela já existe (criada antes), adicionar colunas novas e remover UNIQUE
ALTER TABLE proposta_aceites ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aceito';
ALTER TABLE proposta_aceites ADD COLUMN IF NOT EXISTS motivo TEXT;

-- Remover constraint UNIQUE para permitir múltiplas considerações
ALTER TABLE proposta_aceites DROP CONSTRAINT IF EXISTS proposta_aceites_proposta_id_key;
