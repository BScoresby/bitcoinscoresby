"""Offline smoke tests for the BitcoinScoresby contact-v2 SQLite/D1 schema."""
from pathlib import Path
import sqlite3

schema = Path(__file__).resolve().parents[1] / 'migrations' / '0001_contact_v2.sql'
connection = sqlite3.connect(':memory:')
connection.execute('PRAGMA foreign_keys = ON')
connection.executescript(schema.read_text())

attempt = ('attempt-test-1', 'lnbc-placeholder', 'a'*64,
           'https://lexe.app/public/v1/lnurl_verify/test', 21000, 1, 1000)
connection.execute('''INSERT INTO contact_v2_attempts
    (id, invoice, payment_hash, verify_url, amount_msat, created_at, invoice_expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)''', attempt)

def insert_message(event_id):
    connection.execute('''INSERT INTO contact_v2_messages
       (attempt_id, event_id, event_json, accepted_at)
       VALUES (?, ?, ?, ?)''', (attempt[0], event_id, '{"kind":1059}', 10))

def rejects(fn, description):
    try:
        fn()
    except sqlite3.IntegrityError:
        print('PASS', description)
    else:
        raise AssertionError(description)

rejects(lambda: insert_message('b'*64), 'unpaid message rejected')
rejects(lambda: connection.execute("UPDATE contact_v2_attempts SET state='paid' WHERE id=?", (attempt[0],)), 'paid state without paid_at rejected')
connection.execute("UPDATE contact_v2_attempts SET state='paid', paid_at=8 WHERE id=?", (attempt[0],))
insert_message('b'*64)
assert connection.execute('SELECT state FROM contact_v2_attempts').fetchone()[0] == 'accepted'
print('PASS accepted message consumes payment')
rejects(lambda: insert_message('c'*64), 'second message for same payment rejected')
rejects(lambda: connection.execute("UPDATE contact_v2_attempts SET state='bogus' WHERE id=?", (attempt[0],)), 'invalid state rejected')
assert connection.execute('SELECT COUNT(*) FROM contact_v2_messages').fetchone()[0] == 1
print('PASS exactly one ciphertext record stored')
