CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  correlation_id UUID NOT NULL UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  processor VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_processor ON payments (processor);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at);