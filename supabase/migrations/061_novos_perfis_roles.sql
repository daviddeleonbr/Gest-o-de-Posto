-- Migração dos roles antigos para os novos perfis
-- admin      → adm_financeiro
-- fiscal     → adm_fiscal
-- marketing  → adm_marketing
-- transpombal→ adm_transpombal
-- fechador   → operador_caixa
-- conciliador→ operador_conciliador
-- operador   → adm_financeiro (perfil operacional mais próximo)

UPDATE usuarios SET role = 'adm_financeiro'       WHERE role = 'admin';
UPDATE usuarios SET role = 'adm_fiscal'            WHERE role = 'fiscal';
UPDATE usuarios SET role = 'adm_marketing'         WHERE role = 'marketing';
UPDATE usuarios SET role = 'adm_transpombal'       WHERE role = 'transpombal';
UPDATE usuarios SET role = 'operador_caixa'        WHERE role = 'fechador';
UPDATE usuarios SET role = 'operador_conciliador'  WHERE role = 'conciliador';
UPDATE usuarios SET role = 'adm_financeiro'        WHERE role = 'operador';
