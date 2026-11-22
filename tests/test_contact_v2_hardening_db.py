"""SQLite checks for the additive 0003 migration and the invoice commitment trigger."""
from pathlib import Path
import sqlite3, unittest, time
ROOT=Path(__file__).resolve().parents[1]

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:',isolation_level=None)
        self.db.execute('PRAGMA foreign_keys = ON')
        for n in ('0001_contact_v2.sql','0002_invoice_rate_limit.sql','0003_envelope_and_verify_cooldown.sql'):
            self.db.executescript((ROOT/'migrations'/n).read_text())
        self.db.execute("""INSERT INTO contact_v2_attempts
             (id, state, invoice, payment_hash, verify_url, amount_msat, created_at, invoice_expires_at, paid_at, envelope_hash)
             VALUES ('a', 'paid', 'lnbc-test', ?, 'https://lexe.app/v', 21000, 100, 1000, 100, ?)""",
             ('a'*64,'b'*64))
    def test_commitment_trigger_prevents_any_other_event_hash(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO contact_v2_messages(attempt_id,event_id,event_json,accepted_at)
                        VALUES ('a', ?, '{}', 200)""",('c'*64,))
        self.assertEqual(self.db.execute("SELECT state FROM contact_v2_attempts").fetchone()[0],'paid')
    def test_exact_commitment_consumes_paid_attempt(self):
        self.db.execute("""INSERT INTO contact_v2_messages(attempt_id,event_id,event_json,accepted_at)
                    VALUES ('a', ?, '{}', 200)""",('b'*64,))
        self.assertEqual(self.db.execute("SELECT state FROM contact_v2_attempts").fetchone()[0],'accepted')
    def test_verify_lease_is_atomic(self):
        # Use a fresh invoiced attempt because the fixture is already marked paid.
        self.db.execute("""INSERT INTO contact_v2_attempts
           (id,state,invoice,payment_hash,verify_url,amount_msat,created_at,invoice_expires_at,envelope_hash)
           VALUES ('pending','invoiced','lnbc-test2',?,'https://lexe.app/v2',21000,100,1000,?)""",
           ('c'*64,'d'*64))
        now=int(time.time())
        sql="UPDATE contact_v2_attempts SET next_verify_at = ? WHERE id = ? AND state='invoiced' AND next_verify_at <= ? RETURNING id"
        self.assertEqual(self.db.execute(sql,(now+30,'pending',now)).fetchone(),('pending',))
        self.assertIsNone(self.db.execute(sql,(now+30,'pending',now)).fetchone())
        self.assertEqual(self.db.execute(sql,(now+61,'pending',now+31)).fetchone(),('pending',))
    def test_cleanup_age_index_exists(self):
        rows=self.db.execute("PRAGMA index_list('contact_v2_invoice_rate_limits')").fetchall()
        self.assertIn('contact_v2_rate_limits_age_idx',[r[1] for r in rows])

if __name__=='__main__': unittest.main(verbosity=2)
