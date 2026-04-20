-- Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  telefone    text,
  email       text,
  contato     text,
  categoria   text        NOT NULL DEFAULT 'geral', -- combustivel | conveniencia | lubrificante | geral
  observacoes text,
  ativo       boolean     NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- Relação fornecedor ↔ posto com dias de visita
CREATE TABLE IF NOT EXISTS fornecedor_postos (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id       uuid    NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  posto_id            uuid    NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
  dias_visita         int[]   NOT NULL DEFAULT '{}', -- 0=Dom,1=Seg,2=Ter,3=Qua,4=Qui,5=Sex,6=Sab
  prazo_entrega_dias  int     NOT NULL DEFAULT 1,
  observacoes         text,
  UNIQUE(fornecedor_id, posto_id)
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_postos_posto ON fornecedor_postos(posto_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_postos_fornecedor ON fornecedor_postos(fornecedor_id);

ALTER TABLE fornecedores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedor_postos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedores_select" ON fornecedores      FOR SELECT USING (true);
CREATE POLICY "fornecedores_all"    ON fornecedores      FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "fp_select"           ON fornecedor_postos FOR SELECT USING (true);
CREATE POLICY "fp_all"              ON fornecedor_postos FOR ALL    USING (true) WITH CHECK (true);
