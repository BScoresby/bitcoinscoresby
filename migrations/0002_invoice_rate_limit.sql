CREATE TABLE IF NOT EXISTS contact_v2_invoice_rate_limits (
  client_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  requests INTEGER NOT NULL
);
