-- Tabela de vínculos de postos por usuário (suporte a múltiplos postos para operador_caixa)
CREATE TABLE IF NOT EXISTS usuario_postos_caixa (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  posto_id   UUID NOT NULL REFERENCES postos(id)   ON DELETE CASCADE,
  criado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (usuario_id, posto_id)
);

CREATE INDEX IF NOT EXISTS idx_upc_usuario ON usuario_postos_caixa(usuario_id);
CREATE INDEX IF NOT EXISTS idx_upc_posto   ON usuario_postos_caixa(posto_id);

ALTER TABLE usuario_postos_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upc_all" ON usuario_postos_caixa FOR ALL USING (true) WITH CHECK (true);

-- Migra posto_fechamento_id existente para a nova tabela
INSERT INTO usuario_postos_caixa (usuario_id, posto_id)
SELECT id, posto_fechamento_id
FROM   usuarios
WHERE  role = 'operador_caixa'
  AND  posto_fechamento_id IS NOT NULL
ON CONFLICT DO NOTHING;
