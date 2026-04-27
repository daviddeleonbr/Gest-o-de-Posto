-- ============================================================
-- MIGRATION 060: TIPO_VALOR EM MAPEAMENTOS DE GRUPOS
-- Permite mapear o MESMO grupo de produto a duas linhas
-- diferentes da DRE — uma para vendas, outra para custos.
-- Ex.: COMBUSTIVEIS → "Receita Combustíveis" (venda)
--      COMBUSTIVEIS → "CMV Combustíveis"     (custo)
-- ============================================================

alter table public.mascaras_mapeamentos_grupos
  add column if not exists tipo_valor text not null default 'venda';

alter table public.mascaras_mapeamentos_grupos
  drop constraint if exists mascaras_mapeamentos_grupos_tipo_valor_check;

alter table public.mascaras_mapeamentos_grupos
  add constraint mascaras_mapeamentos_grupos_tipo_valor_check
  check (tipo_valor in ('venda', 'custo'));

-- Substitui a UNIQUE antiga (mascara_id, grupo_grid) pela nova
-- que permite o mesmo grupo em duas linhas, uma por tipo_valor.
alter table public.mascaras_mapeamentos_grupos
  drop constraint if exists mascaras_mapeamentos_grupos_mascara_id_grupo_grid_key;

alter table public.mascaras_mapeamentos_grupos
  drop constraint if exists mascaras_mapeamentos_grupos_unique;

alter table public.mascaras_mapeamentos_grupos
  add constraint mascaras_mapeamentos_grupos_unique
  unique (mascara_id, grupo_grid, tipo_valor);
