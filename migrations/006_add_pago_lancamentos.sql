-- 006_add_pago_lancamentos.sql
-- Adiciona coluna `pago` em `lancamentos` para controlar contas pagas / a pagar

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT false;

-- Opcional: garantir que valores existentes sejam booleanos (não necessário com DEFAULT)
-- UPDATE lancamentos SET pago = false WHERE pago IS NULL;
