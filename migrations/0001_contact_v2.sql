-- BitcoinScoresby contact v2, additive migration.
-- Does not modify the existing contact_attempts table or production endpoints.
-- Only apply to an isolated staging D1 database until the v2 workflow is tested.

CREATE TABLE IF NOT EXISTS contact_v2_attempts (
    id                 TEXT PRIMARY KEY NOT NULL,
    state              TEXT NOT NULL DEFAULT 'invoiced'
                       CHECK (state IN ('invoiced', 'paid', 'accepted')),
    invoice            TEXT NOT NULL UNIQUE,
    payment_hash       TEXT NOT NULL UNIQUE
                       CHECK (length(payment_hash) = 64),
    verify_url         TEXT NOT NULL,
    amount_msat        INTEGER NOT NULL DEFAULT 21000
                       CHECK (amount_msat = 21000),
    created_at         INTEGER NOT NULL,
    invoice_expires_at INTEGER NOT NULL,
    paid_at            INTEGER,
    CHECK (
      (state = 'invoiced' AND paid_at IS NULL) OR
      (state IN ('paid', 'accepted') AND paid_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS contact_v2_attempts_state_idx
    ON contact_v2_attempts(state, created_at);

CREATE TABLE IF NOT EXISTS contact_v2_messages (
    seq          INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id   TEXT NOT NULL UNIQUE,
    event_id     TEXT NOT NULL UNIQUE CHECK (length(event_id) = 64),
    event_json   TEXT NOT NULL CHECK (length(event_json) BETWEEN 1 AND 15000),
    accepted_at  INTEGER NOT NULL,
    FOREIGN KEY (attempt_id) REFERENCES contact_v2_attempts(id) ON DELETE RESTRICT
);

-- Defense in depth: even a future application bug cannot insert a message
-- unless the referenced payment attempt has already been marked paid.
CREATE TRIGGER IF NOT EXISTS contact_v2_require_paid
BEFORE INSERT ON contact_v2_messages
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM contact_v2_attempts
        WHERE id = NEW.attempt_id
          AND state = 'paid'
          AND paid_at IS NOT NULL
    ) THEN RAISE(ABORT, 'verified paid attempt required') END;
END;

-- Inserting the one immutable message consumes the payment in the same
-- SQLite statement/transaction. The UNIQUE(attempt_id) constraint ensures
-- one message per payment even if requests race.
CREATE TRIGGER IF NOT EXISTS contact_v2_consume_payment
AFTER INSERT ON contact_v2_messages
BEGIN
    UPDATE contact_v2_attempts
    SET state = 'accepted'
    WHERE id = NEW.attempt_id AND state = 'paid';
END;
