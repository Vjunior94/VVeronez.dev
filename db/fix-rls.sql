-- Fix RLS infinite recursion
-- The admin check queries public.users which triggers its own RLS policy = infinite loop
-- Solution: use auth.role() = 'authenticated' for reads, service_role for writes

-- Drop all existing policies
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOR t IN SELECT unnest(ARRAY['leads','projetos','ficha_campos','frases_ouro','mensagens','propostas','proposta_modulos','proposta_servicos','notificacoes_valmir','eventos_sistema','agenor_proposals','users'])
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Users: simple self-read
CREATE POLICY "users_self_read" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_self_update" ON public.users FOR UPDATE USING (auth.uid() = id);

-- All other tables: authenticated can read, service_role handles writes from backend
CREATE POLICY "auth_read" ON public.leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.projetos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.ficha_campos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.frases_ouro FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.mensagens FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.propostas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.proposta_modulos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.proposta_servicos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.notificacoes_valmir FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.eventos_sistema FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.agenor_proposals FOR SELECT USING (auth.role() = 'authenticated');

-- Write policies for authenticated (for dashboard actions like creating proposals)
CREATE POLICY "auth_write" ON public.leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.agenor_proposals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write" ON public.propostas FOR ALL USING (auth.role() = 'authenticated');
