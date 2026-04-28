-- ─────────────────────────────────────────────────────────────────────────────
-- 064: Corrige RLS para os novos nomes de role
-- Problema: migration 061 renomeou os roles na tabela usuarios mas as policies
-- RLS ainda verificam os nomes antigos ('admin', 'operador', 'fechador', etc.)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper functions ──────────────────────────────────────────────────────────

-- Retorna true para qualquer role administrativo (ADM ou master)
CREATE OR REPLACE FUNCTION public.is_any_admin()
RETURNS BOOLEAN AS $$
  SELECT (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN (
    'master',
    'adm_financeiro', 'adm_fiscal', 'adm_marketing', 'adm_transpombal', 'adm_contas_pagar',
    'admin'  -- legado
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Retorna true para qualquer role operacional (operadores + gerente)
CREATE OR REPLACE FUNCTION public.is_any_operador()
RETURNS BOOLEAN AS $$
  SELECT (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN (
    'operador_caixa', 'operador_conciliador', 'gerente',
    'operador', 'fechador', 'conciliador'  -- legado
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Retorna true especificamente para operador_caixa (fechador de caixa)
CREATE OR REPLACE FUNCTION public.is_operador_caixa()
RETURNS BOOLEAN AS $$
  SELECT (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('operador_caixa', 'fechador')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Retorna true para operador_conciliador
CREATE OR REPLACE FUNCTION public.is_operador_conciliador()
RETURNS BOOLEAN AS $$
  SELECT (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('operador_conciliador', 'conciliador')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Retorna array de posto_ids do operador_caixa logado (tabela usuario_postos_caixa)
CREATE OR REPLACE FUNCTION public.get_user_postos_caixa_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT posto_id
      FROM   public.usuario_postos_caixa
      WHERE  usuario_id = auth.uid()
    ),
    '{}'::UUID[]
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ── POSTOS ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "operador_read_postos" ON public.postos;
CREATE POLICY "operador_read_postos" ON public.postos
  FOR SELECT TO authenticated
  USING (is_any_operador() AND empresa_id = get_user_empresa_id());

-- ── PORTAIS ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_portais"   ON public.portais;
DROP POLICY IF EXISTS "operador_read_portais"  ON public.portais;

CREATE POLICY "admin_manage_portais" ON public.portais
  FOR ALL TO authenticated
  USING    (is_any_admin() AND empresa_id = get_user_empresa_id())
  WITH CHECK (is_any_admin() AND empresa_id = get_user_empresa_id());

CREATE POLICY "operador_read_portais" ON public.portais
  FOR SELECT TO authenticated
  USING (is_any_operador() AND empresa_id = get_user_empresa_id());

-- ── ACESSOS UNIFICADOS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_acessos_unificados"   ON public.acessos_unificados;
DROP POLICY IF EXISTS "operador_read_acessos_unificados"  ON public.acessos_unificados;
DROP POLICY IF EXISTS "conciliador_write_acessos"         ON public.acessos_unificados;

CREATE POLICY "admin_manage_acessos_unificados" ON public.acessos_unificados
  FOR ALL TO authenticated
  USING    (is_any_admin() AND empresa_id = get_user_empresa_id())
  WITH CHECK (is_any_admin() AND empresa_id = get_user_empresa_id());

CREATE POLICY "operador_read_acessos_unificados" ON public.acessos_unificados
  FOR SELECT TO authenticated
  USING (is_any_operador() AND empresa_id = get_user_empresa_id());

CREATE POLICY "conciliador_write_acessos" ON public.acessos_unificados
  FOR ALL TO authenticated
  USING    (is_operador_conciliador() AND empresa_id = get_user_empresa_id())
  WITH CHECK (is_operador_conciliador() AND empresa_id = get_user_empresa_id());

-- ── ACESSOS POSTOS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_acessos_postos"   ON public.acessos_postos;
DROP POLICY IF EXISTS "operador_read_acessos_postos"  ON public.acessos_postos;

CREATE POLICY "admin_manage_acessos_postos" ON public.acessos_postos
  FOR ALL TO authenticated
  USING    (is_any_admin() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()))
  WITH CHECK (is_any_admin() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()));

CREATE POLICY "operador_read_acessos_postos" ON public.acessos_postos
  FOR SELECT TO authenticated
  USING (is_any_operador() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()));

-- ── ACESSOS ANYDESK ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_anydesk"   ON public.acessos_anydesk;
DROP POLICY IF EXISTS "operador_read_anydesk"  ON public.acessos_anydesk;

CREATE POLICY "admin_manage_anydesk" ON public.acessos_anydesk
  FOR ALL TO authenticated
  USING    (is_any_admin() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()))
  WITH CHECK (is_any_admin() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()));

CREATE POLICY "operador_read_anydesk" ON public.acessos_anydesk
  FOR SELECT TO authenticated
  USING (is_any_operador() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()));

-- ── MAQUININHAS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "operador_read_maquininhas" ON public.maquininhas;
CREATE POLICY "operador_read_maquininhas" ON public.maquininhas
  FOR SELECT TO authenticated
  USING (is_any_operador() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()));

-- ── TAXAS ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "operador_read_taxas" ON public.taxas;
CREATE POLICY "operador_read_taxas" ON public.taxas
  FOR SELECT TO authenticated
  USING (is_any_operador() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()));

-- ── ADQUIRENTES ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "operador_read_adquirentes" ON public.adquirentes;
CREATE POLICY "operador_read_adquirentes" ON public.adquirentes
  FOR SELECT TO authenticated
  USING (is_any_operador() AND empresa_id = get_user_empresa_id());

-- ── FECHAMENTOS DE CAIXA ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fechamentos_fechador_select"    ON public.fechamentos_caixa;
DROP POLICY IF EXISTS "fechamentos_fechador_insert"    ON public.fechamentos_caixa;
DROP POLICY IF EXISTS "fechamentos_admin_all"          ON public.fechamentos_caixa;
DROP POLICY IF EXISTS "fechamentos_operador_all"       ON public.fechamentos_caixa;
DROP POLICY IF EXISTS "fechamentos_conciliador_select" ON public.fechamentos_caixa;

-- ADMs: tudo dentro da empresa
CREATE POLICY "fechamentos_adm_all" ON public.fechamentos_caixa
  FOR ALL TO authenticated
  USING    (is_any_admin() AND empresa_id = get_user_empresa_id())
  WITH CHECK (is_any_admin() AND empresa_id = get_user_empresa_id());

-- operador_caixa: seleciona e cria para seus postos (via junction table)
CREATE POLICY "fechamentos_operador_caixa_select" ON public.fechamentos_caixa
  FOR SELECT TO authenticated
  USING (
    is_operador_caixa()
    AND posto_id = ANY(get_user_postos_caixa_ids())
  );

CREATE POLICY "fechamentos_operador_caixa_insert" ON public.fechamentos_caixa
  FOR INSERT TO authenticated
  WITH CHECK (
    is_operador_caixa()
    AND posto_id = ANY(get_user_postos_caixa_ids())
  );

-- operador_conciliador: somente leitura — fechamentos enviados/analisados/aprovados
CREATE POLICY "fechamentos_conciliador_select" ON public.fechamentos_caixa
  FOR SELECT TO authenticated
  USING (
    is_operador_conciliador()
    AND empresa_id = get_user_empresa_id()
    AND status IN ('enviado', 'em_analise', 'aprovado')
  );

-- ── FECHAMENTO ARQUIVOS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fech_arq_fechador_select" ON public.fechamento_arquivos;
DROP POLICY IF EXISTS "fech_arq_fechador_insert" ON public.fechamento_arquivos;
DROP POLICY IF EXISTS "fech_arq_empresa_select"  ON public.fechamento_arquivos;
DROP POLICY IF EXISTS "fech_arq_empresa_insert"  ON public.fechamento_arquivos;
DROP POLICY IF EXISTS "fech_arq_empresa_delete"  ON public.fechamento_arquivos;

-- ADMs: tudo via fechamentos da empresa
CREATE POLICY "fech_arq_adm_all" ON public.fechamento_arquivos
  FOR ALL TO authenticated
  USING (
    is_any_admin()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa WHERE empresa_id = get_user_empresa_id()
    )
  )
  WITH CHECK (
    is_any_admin()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa WHERE empresa_id = get_user_empresa_id()
    )
  );

-- operador_caixa: seleciona e insere arquivos dos seus postos
CREATE POLICY "fech_arq_operador_caixa_select" ON public.fechamento_arquivos
  FOR SELECT TO authenticated
  USING (
    is_operador_caixa()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa
      WHERE posto_id = ANY(get_user_postos_caixa_ids())
    )
  );

CREATE POLICY "fech_arq_operador_caixa_insert" ON public.fechamento_arquivos
  FOR INSERT TO authenticated
  WITH CHECK (
    is_operador_caixa()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa
      WHERE posto_id = ANY(get_user_postos_caixa_ids())
    )
  );

-- operador_conciliador: leitura dos fechamentos enviados/analisados da empresa
CREATE POLICY "fech_arq_conciliador_select" ON public.fechamento_arquivos
  FOR SELECT TO authenticated
  USING (
    is_operador_conciliador()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa
      WHERE empresa_id = get_user_empresa_id()
        AND status IN ('enviado', 'em_analise', 'aprovado')
    )
  );

-- ── ADMIN POLICIES — usar is_any_admin() nas tabelas principais ───────────────

-- Postos (admin manage)
DROP POLICY IF EXISTS "admin_manage_postos" ON public.postos;
CREATE POLICY "admin_manage_postos" ON public.postos
  FOR ALL TO authenticated
  USING    (is_any_admin() AND empresa_id = get_user_empresa_id())
  WITH CHECK (is_any_admin() AND empresa_id = get_user_empresa_id());

-- Maquininhas (admin manage)
DROP POLICY IF EXISTS "admin_manage_maquininhas" ON public.maquininhas;
CREATE POLICY "admin_manage_maquininhas" ON public.maquininhas
  FOR ALL TO authenticated
  USING    (is_any_admin() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()))
  WITH CHECK (is_any_admin() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()));

-- Taxas (admin manage)
DROP POLICY IF EXISTS "admin_manage_taxas" ON public.taxas;
CREATE POLICY "admin_manage_taxas" ON public.taxas
  FOR ALL TO authenticated
  USING    (is_any_admin() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()))
  WITH CHECK (is_any_admin() AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id()));

-- Adquirentes (admin manage)
DROP POLICY IF EXISTS "admin_manage_adquirentes" ON public.adquirentes;
CREATE POLICY "admin_manage_adquirentes" ON public.adquirentes
  FOR ALL TO authenticated
  USING    (is_any_admin() AND empresa_id = get_user_empresa_id())
  WITH CHECK (is_any_admin() AND empresa_id = get_user_empresa_id());

-- ── USUÁRIOS ──────────────────────────────────────────────────────────────────
-- Permite que ADMs gerenciem os usuários operacionais da empresa
DROP POLICY IF EXISTS "admin_manage_operadores"  ON public.usuarios;
DROP POLICY IF EXISTS "admin_manage_usuarios"    ON public.usuarios;

CREATE POLICY "admin_manage_usuarios" ON public.usuarios
  FOR ALL TO authenticated
  USING (
    is_any_admin()
    AND empresa_id = get_user_empresa_id()
    AND role IN (
      'operador_caixa', 'operador_conciliador', 'gerente',
      'operador', 'fechador', 'conciliador'  -- legado
    )
  )
  WITH CHECK (
    is_any_admin()
    AND empresa_id = get_user_empresa_id()
    AND role IN (
      'operador_caixa', 'operador_conciliador', 'gerente',
      'operador', 'fechador', 'conciliador'  -- legado
    )
  );

-- Todos os usuários autenticados da empresa podem ver os colegas
DROP POLICY IF EXISTS "user_see_company_users" ON public.usuarios;
CREATE POLICY "user_see_company_users" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    (is_any_admin() OR is_any_operador())
    AND empresa_id = get_user_empresa_id()
  );

-- ── TAREFAS ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_select_tarefas"     ON public.tarefas;
DROP POLICY IF EXISTS "admin_insert_tarefas"     ON public.tarefas;
DROP POLICY IF EXISTS "admin_update_tarefas"     ON public.tarefas;
DROP POLICY IF EXISTS "admin_delete_tarefas"     ON public.tarefas;
DROP POLICY IF EXISTS "operador_select_tarefas"  ON public.tarefas;
DROP POLICY IF EXISTS "operador_insert_tarefas"  ON public.tarefas;
DROP POLICY IF EXISTS "operador_update_tarefas"  ON public.tarefas;
DROP POLICY IF EXISTS "conciliador_select_tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "conciliador_update_tarefas" ON public.tarefas;

-- ADMs: vê/cria/atualiza/remove todas as tarefas da empresa
CREATE POLICY "adm_select_tarefas" ON public.tarefas
  FOR SELECT TO authenticated
  USING (is_any_admin() AND empresa_id = get_user_empresa_id());

CREATE POLICY "adm_insert_tarefas" ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (is_any_admin() AND empresa_id = get_user_empresa_id());

CREATE POLICY "adm_update_tarefas" ON public.tarefas
  FOR UPDATE TO authenticated
  USING    (is_any_admin() AND empresa_id = get_user_empresa_id())
  WITH CHECK (is_any_admin() AND empresa_id = get_user_empresa_id());

CREATE POLICY "adm_delete_tarefas" ON public.tarefas
  FOR DELETE TO authenticated
  USING (is_any_admin() AND empresa_id = get_user_empresa_id());

-- operador_caixa: vê/cria/atualiza somente as próprias tarefas
CREATE POLICY "operador_caixa_select_tarefas" ON public.tarefas
  FOR SELECT TO authenticated
  USING (is_operador_caixa() AND usuario_id = auth.uid());

CREATE POLICY "operador_caixa_insert_tarefas" ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (is_operador_caixa() AND usuario_id = auth.uid() AND empresa_id = get_user_empresa_id());

CREATE POLICY "operador_caixa_update_tarefas" ON public.tarefas
  FOR UPDATE TO authenticated
  USING (is_operador_caixa() AND usuario_id = auth.uid());

-- operador_conciliador: vê/cria/atualiza somente as próprias tarefas
CREATE POLICY "operador_conciliador_select_tarefas" ON public.tarefas
  FOR SELECT TO authenticated
  USING (is_operador_conciliador() AND usuario_id = auth.uid());

CREATE POLICY "operador_conciliador_insert_tarefas" ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (is_operador_conciliador() AND usuario_id = auth.uid() AND empresa_id = get_user_empresa_id());

CREATE POLICY "operador_conciliador_update_tarefas" ON public.tarefas
  FOR UPDATE TO authenticated
  USING (is_operador_conciliador() AND usuario_id = auth.uid())
  WITH CHECK (is_operador_conciliador() AND usuario_id = auth.uid());

-- gerente: somente visualiza tarefas da empresa
CREATE POLICY "gerente_select_tarefas" ON public.tarefas
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) = 'gerente'
    AND empresa_id = get_user_empresa_id()
  );

-- ── TAREFAS RECORRENTES ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_tarefas_recorrentes"           ON public.tarefas_recorrentes;
DROP POLICY IF EXISTS "conciliador_select_tarefas_recorrentes"  ON public.tarefas_recorrentes;

CREATE POLICY "adm_all_tarefas_recorrentes" ON public.tarefas_recorrentes
  FOR ALL TO authenticated
  USING    (is_any_admin() AND empresa_id = get_user_empresa_id())
  WITH CHECK (is_any_admin() AND empresa_id = get_user_empresa_id());

-- operador_conciliador: vê somente as suas recorrentes
CREATE POLICY "operador_conciliador_select_tarefas_recorrentes" ON public.tarefas_recorrentes
  FOR SELECT TO authenticated
  USING (is_operador_conciliador() AND usuario_id = auth.uid());

-- ── CONTAS BANCÁRIAS ──────────────────────────────────────────────────────────
-- Somente master e adm_financeiro (não outros ADMs, não operadores)
DROP POLICY IF EXISTS "admin_manage_contas_bancarias"  ON public.contas_bancarias;
DROP POLICY IF EXISTS "operador_read_contas_bancarias" ON public.contas_bancarias;

CREATE POLICY "adm_financeiro_manage_contas_bancarias" ON public.contas_bancarias
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('adm_financeiro', 'admin')
    AND empresa_id = get_user_empresa_id()
  )
  WITH CHECK (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('adm_financeiro', 'admin')
    AND empresa_id = get_user_empresa_id()
  );

-- ── ACESSOS CÂMERAS ───────────────────────────────────────────────────────────
-- Somente ADMs (operadores não têm acesso)
DROP POLICY IF EXISTS "admin_manage_cameras"  ON public.acessos_cameras;
DROP POLICY IF EXISTS "operador_read_cameras" ON public.acessos_cameras;

CREATE POLICY "adm_manage_cameras" ON public.acessos_cameras
  FOR ALL TO authenticated
  USING (
    is_any_admin()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  )
  WITH CHECK (
    is_any_admin()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  );

-- ── SENHAS TEF ────────────────────────────────────────────────────────────────
-- Somente ADMs (operadores não têm acesso)
DROP POLICY IF EXISTS "admin_all_senhas_tef"      ON public.senhas_tef;
DROP POLICY IF EXISTS "operador_select_senhas_tef" ON public.senhas_tef;

CREATE POLICY "adm_all_senhas_tef" ON public.senhas_tef
  FOR ALL TO authenticated
  USING (
    is_any_admin()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  )
  WITH CHECK (
    is_any_admin()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  );

-- ── SERVIDORES ────────────────────────────────────────────────────────────────
-- Somente ADMs (operadores não têm acesso)
DROP POLICY IF EXISTS "admin_manage_servidores"  ON public.servidores_postos;
DROP POLICY IF EXISTS "operador_read_servidores" ON public.servidores_postos;

CREATE POLICY "adm_manage_servidores" ON public.servidores_postos
  FOR ALL TO authenticated
  USING (
    is_any_admin()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  )
  WITH CHECK (
    is_any_admin()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  );

-- ── POSTO CONTATOS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_contatos"  ON public.posto_contatos;
DROP POLICY IF EXISTS "operador_read_contatos" ON public.posto_contatos;

CREATE POLICY "adm_manage_contatos" ON public.posto_contatos
  FOR ALL TO authenticated
  USING (
    is_any_admin()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  )
  WITH CHECK (
    is_any_admin()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  );

CREATE POLICY "operador_read_contatos" ON public.posto_contatos
  FOR SELECT TO authenticated
  USING (
    is_any_operador()
    AND posto_id IN (SELECT id FROM public.postos WHERE empresa_id = get_user_empresa_id())
  );

-- ── FECHAMENTO COMENTÁRIOS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fech_com_empresa_select" ON public.fechamento_comentarios;
DROP POLICY IF EXISTS "fech_com_empresa_insert" ON public.fechamento_comentarios;

CREATE POLICY "fech_com_adm_select" ON public.fechamento_comentarios
  FOR SELECT TO authenticated
  USING (
    is_any_admin()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa WHERE empresa_id = get_user_empresa_id()
    )
  );

CREATE POLICY "fech_com_adm_insert" ON public.fechamento_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    is_any_admin()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa WHERE empresa_id = get_user_empresa_id()
    )
  );

CREATE POLICY "fech_com_operador_caixa_select" ON public.fechamento_comentarios
  FOR SELECT TO authenticated
  USING (
    is_operador_caixa()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa
      WHERE posto_id = ANY(get_user_postos_caixa_ids())
    )
  );

CREATE POLICY "fech_com_operador_caixa_insert" ON public.fechamento_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    is_operador_caixa()
    AND fechamento_id IN (
      SELECT id FROM public.fechamentos_caixa
      WHERE posto_id = ANY(get_user_postos_caixa_ids())
    )
  );

-- ── USUARIO_POSTOS_FECHAMENTO (junction table legado) ─────────────────────────
DROP POLICY IF EXISTS "upf_admin_empresa" ON public.usuario_postos_fechamento;

CREATE POLICY "upf_adm_empresa" ON public.usuario_postos_fechamento
  FOR ALL TO authenticated
  USING (
    is_any_admin()
    AND usuario_id IN (
      SELECT id FROM public.usuarios WHERE empresa_id = get_user_empresa_id()
    )
  )
  WITH CHECK (
    is_any_admin()
    AND usuario_id IN (
      SELECT id FROM public.usuarios WHERE empresa_id = get_user_empresa_id()
    )
  );

-- ── MARKETING ─────────────────────────────────────────────────────────────────
-- Atualiza mkt_auth_role() para mapear novos nomes de role para os antigos
-- usados nas policies de marketing (compatibilidade com migrations 038/040)
CREATE OR REPLACE FUNCTION mkt_auth_role()
RETURNS TEXT AS $$
  SELECT CASE role
    WHEN 'adm_marketing'        THEN 'marketing'
    WHEN 'adm_financeiro'       THEN 'admin'
    WHEN 'adm_fiscal'           THEN 'admin'
    WHEN 'adm_transpombal'      THEN 'admin'
    WHEN 'adm_contas_pagar'     THEN 'admin'
    WHEN 'operador_caixa'       THEN 'operador'
    WHEN 'operador_conciliador' THEN 'operador'
    ELSE role  -- master, gerente inalterados
  END
  FROM public.usuarios WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
