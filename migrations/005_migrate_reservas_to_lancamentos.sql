BEGIN;

-- Migrate existing reservas into lancamentos as tipo='reserva'.
-- This copies rows but does NOT drop the reservas table.
-- It avoids creating obvious duplicates by checking for an existing lancamento
-- with same usuario_id, valor_centavos, data_ocorrencia and tipo='reserva'.

INSERT INTO lancamentos (usuario_id, conta_id, categoria_id, tipo, valor_centavos, descricao, data_ocorrencia, criado_em)
SELECT r.usuario_id, r.conta_id, r.categoria_id, 'reserva', r.valor_centavos, r.descricao, r.data_alvo, r.criado_em
FROM reservas r
WHERE NOT EXISTS (
  SELECT 1 FROM lancamentos l
  WHERE l.usuario_id = r.usuario_id
    AND l.valor_centavos = r.valor_centavos
    AND l.data_ocorrencia = r.data_alvo
    AND l.tipo = 'reserva'
);

COMMIT;
