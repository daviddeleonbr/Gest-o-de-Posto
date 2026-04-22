-- Adiciona role 'transpombal' ao CHECK constraint da tabela usuarios
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_role_check
  CHECK (role IN ('master', 'admin', 'operador', 'conciliador', 'fechador', 'marketing', 'gerente', 'transpombal'));
