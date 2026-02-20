BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, nome, tipo)
);

CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE RESTRICT,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  descricao TEXT,
  data_ocorrencia DATE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contas_usuario_id ON contas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_categorias_usuario_id ON categorias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_data ON lancamentos(usuario_id, data_ocorrencia);

COMMIT;
