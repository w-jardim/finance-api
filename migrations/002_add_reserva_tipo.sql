BEGIN;

-- Allow 'reserva' tipo in lancamentos
ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_tipo_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_tipo_check CHECK (tipo IN ('entrada', 'saida', 'reserva'));

COMMIT;
