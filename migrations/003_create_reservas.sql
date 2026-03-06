BEGIN;

-- Reservas
CREATE SEQUENCE IF NOT EXISTS seq_reservas_id START WITH 1;
CREATE TABLE IF NOT EXISTS reservas (
  id BIGINT PRIMARY KEY DEFAULT nextval('seq_reservas_id'),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  conta_id BIGINT NOT NULL REFERENCES contas(id) ON DELETE RESTRICT,
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  descricao TEXT,
  data_alvo DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'utilizada', 'cancelada')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER SEQUENCE seq_reservas_id OWNED BY reservas.id;

-- Index para buscar reservas por usuário e data
CREATE INDEX IF NOT EXISTS idx_reservas_usuario_data ON reservas(usuario_id, data_alvo);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(usuario_id, status);

COMMIT;
