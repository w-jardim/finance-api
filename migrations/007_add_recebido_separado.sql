-- 007_add_recebido_separado.sql
-- Adiciona colunas `recebido` e `separado` na tabela `lancamentos`

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS recebido boolean NOT NULL DEFAULT false;

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS separado boolean NOT NULL DEFAULT false;
