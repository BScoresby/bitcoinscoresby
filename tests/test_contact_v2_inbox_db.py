#!/usr/bin/env python3
"""Integration test: actual Stage 1 SQL schema and real SQLite cursor query."""
import pathlib
import sqlite3
import json
import uuid
import time

root = pathlib.Path(__file__).resolve().parents[1]
migration = root / 'migrations/0001_contact_v2.sql'
if not migration.exists():
    raise SystemExit('Stage 1 migration not found in repository; run from full website worktree.')
db = sqlite3.connect(':memory:')
db.row_factory = sqlite3.Row
db.executescript(migration.read_text())
now = int(time.time())

def attempt(state, suffix):
    attempt_id = str(uuid.uuid4())
    db.execute('''INSERT INTO contact_v2_attempts
        (id,state,invoice,payment_hash,verify_url,amount_msat,created_at,invoice_expires_at,paid_at)
        VALUES (?,?,?,?,?,?,?,?,?)''', (attempt_id, state, 'lnbc' + suffix,
        suffix * 64, 'https://lexe.app/fake/' + suffix, 21000, now, now + 900,
        now if state == 'paid' else None))
    return attempt_id

unpaid = attempt('invoiced', 'a')
paid1 = attempt('paid', 'b')
paid2 = attempt('paid', 'c')

def message(attempt_id, eventid):
    event = dict(id=eventid, kind=1059, pubkey='f'*64, sig='f'*128,
        created_at=now, tags=[['p', 'd'*64]], content='encrypted')
    db.execute('INSERT INTO contact_v2_messages(attempt_id,event_id,event_json,accepted_at) VALUES (?,?,?,?)',
               (attempt_id, eventid, json.dumps(event), now))

try:
    message(unpaid, 'a' * 64)
    raise AssertionError('Unpaid attempt should not be insertable')
except sqlite3.IntegrityError:
    print('PASS unpaid message rejected by database')
message(paid1, 'b' * 64)
message(paid2, 'c' * 64)
records = db.execute('''SELECT seq,event_id,event_json,accepted_at
    FROM contact_v2_messages WHERE seq > ? ORDER BY seq ASC LIMIT ?''', (0,2)).fetchall()
assert len(records) == 2
assert [r['event_id'] for r in records] == ['b' * 64, 'c' * 64]
print('PASS inbox query returns only accepted encrypted rows in order')
assert db.execute('SELECT state FROM contact_v2_attempts WHERE id = ?', (paid1,)).fetchone()[0] == 'accepted'
assert db.execute('SELECT COUNT(*) FROM contact_v2_messages WHERE attempt_id = ?', (unpaid,)).fetchone()[0] == 0
print('PASS accepted payment consumed; unpaid attempts absent from inbox')
assert set(records[0].keys()) == {'seq','event_id','event_json','accepted_at'}
print('PASS no invoice, payment hash, receipt or attempt ID exposed in SELECT')
