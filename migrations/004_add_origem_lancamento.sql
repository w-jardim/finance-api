BEGIN;

-- Add origem_lancamento_id to lancamentos so reservas can be linked to an entrada
ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS origem_lancamento_id BIGINT REFERENCES lancamentos(id) ON DELETE SET NULL;

-- Index to quickly lookup by origem
CREATE INDEX IF NOT EXISTS idx_lancamentos_origem ON lancamentos(origem_lancamento_id);

COMMIT;
