-- Execute este SQL no Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS proposta_acessos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id uuid REFERENCES propostas(id) ON DELETE CASCADE,
  cidade text,
  estado text,
  pais text,
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Index para queries por proposta
CREATE INDEX IF NOT EXISTS idx_proposta_acessos_proposta_id ON proposta_acessos(proposta_id);
CREATE INDEX IF NOT EXISTS idx_proposta_acessos_created_at ON proposta_acessos(created_at DESC);

-- RLS: permitir insert com service_role e select com anon (para o dashboard)
ALTER TABLE proposta_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON proposta_acessos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon select" ON proposta_acessos
  FOR SELECT USING (true);
