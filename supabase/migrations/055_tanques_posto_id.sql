-- Adiciona vínculo direto por posto_id em tanques_postos
ALTER TABLE tanques_postos ADD COLUMN IF NOT EXISTS posto_id uuid REFERENCES postos(id) ON DELETE SET NULL;

-- Tenta auto-vincular por nome (best-effort, case-insensitive, ignora prefixo "POSTO ")
UPDATE tanques_postos t
SET posto_id = p.id
FROM postos p
WHERE
  UPPER(TRIM(p.nome)) = UPPER(TRIM(t.posto_nome))
  OR UPPER(TRIM(p.nome)) = 'POSTO ' || UPPER(TRIM(t.posto_nome))
  OR UPPER(TRIM(t.posto_nome)) = 'POSTO ' || UPPER(TRIM(p.nome))
  OR UPPER(TRIM(p.nome)) LIKE '%' || UPPER(TRIM(t.posto_nome))
  OR UPPER(TRIM(p.nome)) LIKE UPPER(TRIM(t.posto_nome)) || '%';
