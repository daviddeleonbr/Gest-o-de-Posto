-- ─── Transpombal — Gestão de Frota e Carregamentos ─────────────────────────

CREATE TABLE IF NOT EXISTS transpombal_motoristas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  telefone   text,
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transpombal_veiculos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa           text NOT NULL UNIQUE,
  tipo            text NOT NULL DEFAULT 'carreta',  -- 'cavalinho' | 'carreta'
  compartimentos  float[] NOT NULL DEFAULT '{}',    -- capacidades em m³
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transpombal_carregamentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_carregamento date NOT NULL,
  origem           text NOT NULL DEFAULT 'CAXIAS',
  motorista_id     uuid REFERENCES transpombal_motoristas(id),
  motorista_nome   text,                           -- texto livre se não cadastrado
  placas           text[] NOT NULL DEFAULT '{}',   -- placas do conjunto
  status           text NOT NULL DEFAULT 'planejado',
    -- planejado | carregando | a_caminho | entregue | cancelado
  observacoes      text,
  criado_por       uuid REFERENCES auth.users(id),
  criado_em        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transpombal_itens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id  uuid NOT NULL REFERENCES transpombal_carregamentos(id) ON DELETE CASCADE,
  ordem            int NOT NULL DEFAULT 0,
  capacidade_m3    float NOT NULL,
  produto          text NOT NULL,  -- G.C | G.A | D.C | D.S10 | E.T | G.R
  posto_nome       text NOT NULL,
  posto_id         uuid REFERENCES postos(id),
  numero_pedido    text,
  status           text NOT NULL DEFAULT 'pendente',  -- pendente | entregue | cancelado
  criado_em        timestamptz NOT NULL DEFAULT now()
);

-- Capacidades padrão por posto (tank reference)
CREATE TABLE IF NOT EXISTS transpombal_posto_capacidades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_nome text NOT NULL,
  produto    text NOT NULL,
  capacidade float NOT NULL,  -- m³ reference capacity
  UNIQUE(posto_nome, produto)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transpombal_carregamentos_data ON transpombal_carregamentos(data_carregamento DESC);
CREATE INDEX IF NOT EXISTS idx_transpombal_itens_carregamento ON transpombal_itens(carregamento_id);

-- RLS
ALTER TABLE transpombal_motoristas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transpombal_veiculos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE transpombal_carregamentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transpombal_itens                ENABLE ROW LEVEL SECURITY;
ALTER TABLE transpombal_posto_capacidades    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON transpombal_motoristas         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON transpombal_veiculos           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON transpombal_carregamentos      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON transpombal_itens              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON transpombal_posto_capacidades  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: veículos cadastrados a partir dos dados fornecidos
INSERT INTO transpombal_veiculos (placa, tipo, compartimentos) VALUES
  ('SGL4D50', 'cavalinho', '{}'),
  ('RQN3F56', 'carreta',   '{7,5,5,5}'),
  ('RQN3G77', 'carreta',   '{8,5,5,5}'),
  ('TON3B34', 'cavalinho', '{}'),
  ('RQR4D91', 'carreta',   '{7,5,5,5}'),
  ('RQR4G34', 'carreta',   '{8,5,5,5}'),
  ('RQT9F23', 'cavalinho', '{}'),
  ('RBF3G48', 'carreta',   '{7,5,5,5}'),
  ('RBF3G43', 'carreta',   '{8,5,5,5}'),
  ('SGK8B61', 'cavalinho', '{}'),
  ('RBB2G84', 'carreta',   '{7,5,5,5}'),
  ('RBB2G86', 'carreta',   '{8,5,5,5}'),
  ('TOO1F54', 'cavalinho', '{}'),
  ('SGG9D63', 'carreta',   '{10,5,7,10}'),
  ('SGG9D61', 'carreta',   '{5,8}'),
  ('SGC7J33', 'cavalinho', '{5,3,5,5,5}'),
  ('SGE4G33', 'cavalinho', '{}'),
  ('DBL4I52', 'carreta',   '{13,10}'),
  ('DBL4I53', 'carreta',   '{13,10}'),
  ('SGB8I04', 'cavalinho', '{}'),
  ('SGH2B21', 'carreta',   '{10,10,7,5,5}'),
  ('SGL4D49', 'cavalinho', '{}'),
  ('SFV6E74', 'carreta',   '{12,10}'),
  ('SFV6E65', 'carreta',   '{13,10}'),
  ('SGM0H92', 'cavalinho', '{}'),
  ('DBL4I22', 'carreta',   '{13,10}'),
  ('DBL4I23', 'carreta',   '{13,10}'),
  ('SFZ6B06', 'cavalinho', '{}'),
  ('SGE6I13', 'carreta',   '{10,5,7,10}'),
  ('SGE6H08', 'carreta',   '{5,8}')
ON CONFLICT (placa) DO NOTHING;

-- Seed: motoristas
INSERT INTO transpombal_motoristas (nome) VALUES
  ('REYES SIMOES'),
  ('VAGNER ROSADO'),
  ('DIEGO GALO'),
  ('MORGADO'),
  ('ALAN'),
  ('TARCISIO GARCIA'),
  ('MARCOS RUBIM'),
  ('SORRISO'),
  ('BREGA'),
  ('EDIS AUGUSTO BRITO'),
  ('JOVANE LUIZ')
ON CONFLICT DO NOTHING;
