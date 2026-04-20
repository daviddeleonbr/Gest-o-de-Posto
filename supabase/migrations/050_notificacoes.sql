-- Tabela de notificações do sistema
CREATE TABLE IF NOT EXISTS notificacoes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        text        NOT NULL DEFAULT 'info',
  titulo      text        NOT NULL,
  mensagem    text,
  lida        boolean     NOT NULL DEFAULT false,
  tarefa_id   uuid        REFERENCES tarefas(id) ON DELETE SET NULL,
  posto_nome  text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id, lida, criado_em DESC);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Usuário só vê suas próprias notificações
CREATE POLICY "notificacoes_select" ON notificacoes
  FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "notificacoes_update" ON notificacoes
  FOR UPDATE USING (auth.uid() = usuario_id);

-- Service role (admin client) pode inserir notificações para qualquer usuário
CREATE POLICY "notificacoes_insert_service" ON notificacoes
  FOR INSERT WITH CHECK (true);
