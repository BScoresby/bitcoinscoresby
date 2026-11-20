"""Real SQLite checks for the conditional INSERT used by Contact v2 accept.
Uses the already-committed migrations/0001_contact_v2.sql (local only).
"""
from pathlib import Path
import sqlite3
import unittest

SCHEMA = Path(__file__).resolve().parents[1] / "migrations" / "0001_contact_v2.sql"
INSERT = """
INSERT INTO contact_v2_messages (attempt_id, event_id, event_json, accepted_at)
SELECT id, ?, ?, ? FROM contact_v2_attempts
WHERE id = ? AND state = 'paid' AND paid_at IS NOT NULL AND amount_msat = 21000
"""

class AcceptDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:", isolation_level=None)
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.executescript(SCHEMA.read_text())
        self.conn.execute("""
            INSERT INTO contact_v2_attempts
            (id, state, invoice, payment_hash, verify_url, amount_msat,
             created_at, invoice_expires_at, paid_at)
            VALUES ('attempt-1', 'invoiced', 'invoice-1', ?, 'https://lexe.app/v',
                    21000, 1, 1000, NULL)
        """, ('a' * 64,))

    def row(self):
        return self.conn.execute("SELECT state FROM contact_v2_attempts WHERE id='attempt-1'").fetchone()[0]

    def accept(self, event_id):
        return self.conn.execute(INSERT, (event_id, '{"event":true}', 10, 'attempt-1'))

    def test_unpaid_insert_cannot_create_message(self):
        self.accept('b' * 64)
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM contact_v2_messages').fetchone()[0], 0)
        self.assertEqual(self.row(), 'invoiced')

    def test_paid_insert_consumes_payment_in_same_statement(self):
        self.conn.execute("UPDATE contact_v2_attempts SET state='paid',paid_at=10 WHERE id='attempt-1'")
        self.accept('b' * 64)
        self.assertEqual(self.row(), 'accepted')
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM contact_v2_messages').fetchone()[0], 1)

    def test_one_payment_cannot_store_two_messages(self):
        self.conn.execute("UPDATE contact_v2_attempts SET state='paid',paid_at=10 WHERE id='attempt-1'")
        self.accept('b' * 64)
        self.accept('c' * 64)  # conditional INSERT has no qualifying 'paid' row
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM contact_v2_messages').fetchone()[0], 1)

    def test_direct_unpaid_insert_rejected_by_trigger(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("""
               INSERT INTO contact_v2_messages(attempt_id,event_id,event_json,accepted_at)
               VALUES ('attempt-1', ?, '{}', 10)
            """, ('b' * 64,))
        self.assertEqual(self.row(), 'invoiced')

if __name__ == '__main__':
    unittest.main(verbosity=2)
