# Contact v2 — Phase 1 (offline encryption foundation)

This archive ADDS four new files without replacing your current contact form.
Do not push/deploy a half-migrated application. No Pages or D1 configuration
changes are needed to test this phase.

Files:
- `contact-v2/envelope.mjs`: X25519 + HKDF-SHA256 + AES-256-GCM via built-in WebCrypto.
- `scripts/contact_v2_keygen.mjs`: generate recipient keypair locally; refuses overwrite.
- `scripts/contact_v2_decrypt.mjs`: decrypt one envelope locally.
- `tests/test_contact_v2_envelope.mjs`: six offline tests.

On your Ubuntu machine, from your existing repository:

```sh
node --test tests/test_contact_v2_envelope.mjs
node scripts/contact_v2_keygen.mjs
```

The second command prints the PUBLIC key and creates a PRIVATE key file in
`~/.config/bitcoinscoresby/contact-v2-x25519-key.json` with permissions 0600.
Securely back up the private file outside Git/Cloudflare. Without this private
key, the messages encrypted to the public key cannot be read.

Do not change the current Cloudflare recipient key or production application
until the next coordinated migration phase. The new key is NOT a Nostr key and
cannot decrypt old NIP-17 messages.

This code is unreviewed project-specific protocol glue around standard browser
cryptographic primitives; use Preview for end-to-end tests before cutover.
