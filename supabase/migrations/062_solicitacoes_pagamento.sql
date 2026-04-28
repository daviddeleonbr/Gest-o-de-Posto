-- Solicitações de pagamento inter-setorial
-- Permite que Fiscal, Marketing e Transpombal enviem solicitações para Contas a Pagar

CREATE TABLE IF NOT EXISTS solicitacoes_pagamento (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id      UUID        REFERENCES empresas(id) ON DELETE CASCADE,
  setor           TEXT        NOT NULL CHECK (setor IN ('fiscal', 'marketing', 'transpombal', 'outro')),
  titulo          TEXT        NOT NULL,
  descricao       TEXT,
  fornecedor      TEXT,
  valor           NUMERIC(12,2),
  data_vencimento DATE,
  observacoes     TEXT,
  arquivo_url     TEXT,
  arquivo_nome    TEXT,
  status          TEXT        NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'em_analise', 'aprovado', 'pago', 'rejeitado')),
  motivo_rejeicao TEXT,
  criado_por_id   UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_por_nome TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sol_pag_empresa   ON solicitacoes_pagamento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sol_pag_setor      ON solicitacoes_pagamento(setor);
CREATE INDEX IF NOT EXISTS idx_sol_pag_status     ON solicitacoes_pagamento(status);
CREATE INDEX IF NOT EXISTS idx_sol_pag_criado_em  ON solicitacoes_pagamento(criado_em DESC);

-- RLS
ALTER TABLE solicitacoes_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sol_pag_select" ON solicitacoes_pagamento
  FOR SELECT USING (true);

CREATE POLICY "sol_pag_insert" ON solicitacoes_pagamento
  FOR INSERT WITH CHECK (true);

CREATE POLICY "sol_pag_update" ON solicitacoes_pagamento
  FOR UPDATE USING (true);

CREATE POLICY "sol_pag_delete" ON solicitacoes_pagamento
  FOR DELETE USING (true);
