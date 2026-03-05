-- 001_init_bigint.sql
-- Initialize schema using BIGINT primary keys (short numeric ids)
-- WARNING: this replaces UUID-based schema; run on a DB you want to recreate.

BEGIN;

-- Usuarios
CREATE SEQUENCE IF NOT EXISTS seq_usuarios_id START WITH 1;
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT PRIMARY KEY DEFAULT nextval('seq_usuarios_id'),
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER SEQUENCE seq_usuarios_id OWNED BY usuarios.id;

-- Contas
CREATE SEQUENCE IF NOT EXISTS seq_contas_id START WITH 1;
CREATE TABLE IF NOT EXISTS contas (
  id BIGINT PRIMARY KEY DEFAULT nextval('seq_contas_id'),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER SEQUENCE seq_contas_id OWNED BY contas.id;

-- Categorias
CREATE SEQUENCE IF NOT EXISTS seq_categorias_id START WITH 1;
CREATE TABLE IF NOT EXISTS categorias (
  id BIGINT PRIMARY KEY DEFAULT nextval('seq_categorias_id'),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, nome, tipo)
);
ALTER SEQUENCE seq_categorias_id OWNED BY categorias.id;

-- Lancamentos
CREATE SEQUENCE IF NOT EXISTS seq_lancamentos_id START WITH 1;
CREATE TABLE IF NOT EXISTS lancamentos (
  id BIGINT PRIMARY KEY DEFAULT nextval('seq_lancamentos_id'),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  conta_id BIGINT NOT NULL REFERENCES contas(id) ON DELETE RESTRICT,
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  descricao TEXT,
  data_ocorrencia DATE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER SEQUENCE seq_lancamentos_id OWNED BY lancamentos.id;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contas_usuario_id ON contas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_categorias_usuario_id ON categorias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_data ON lancamentos(usuario_id, data_ocorrencia);

COMMIT;

-- Notes:
-- After running this, update application code to use numeric ids (BIGINT) instead of UUID strings.
