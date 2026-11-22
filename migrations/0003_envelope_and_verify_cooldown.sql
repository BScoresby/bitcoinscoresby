-- Staging-first, additive migration for the new encrypted-envelope protocol.
-- Existing v2 NIP-17 rows cannot be decrypted by the new X25519 inbox.
-- After confirming there are no real users of the old Preview, clear those
-- old rows with the separately documented cleanup commands.
ALTER TABLE contact_v2_attempts ADD COLUMN envelope_hash TEXT CHECK (
  envelope_hash IS NULL OR length(envelope_hash) = 64
);
ALTER TABLE contact_v2_attempts ADD COLUMN next_verify_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS contact_v2_rate_limits_age_idx ON contact_v2_invoice_rate_limits(window_start);
-- Enforce the invoice's ciphertext commitment independently of application code.
CREATE TRIGGER IF NOT EXISTS contact_v2_require_envelope_hash
BEFORE INSERT ON contact_v2_messages
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM contact_v2_attempts
    WHERE id = NEW.attempt_id AND envelope_hash = NEW.event_id
  ) THEN RAISE(ABORT, 'encrypted envelope commitment required') END;
END;
