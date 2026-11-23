# The Electric Cowboy v0.4.2 — visual polish

This is the **zap-catching game** at `/electric-cowboy/`. The separate horseback **Lightning Cowboy** is unchanged.

## Changes from v0.4.1
- Replaces the old back link with the shared BitcoinScoresby `site-header`: whale/BS logo plus whitepaper, archive, and Stacker News navigation icons. The shared markup and assets are the same as the homepage; styles come from `/styles.css`.
- When Enter first starts the game, **GET ZAPPED!** appears in yellow during the Nostr weather loading stage and briefly after gameplay begins. Later restarts do not repeat the prompt.
- Bottom controls are larger, bolder, and wrap naturally on small screens. Removed the redundant "CATCH THE LIGHTNING" line.
- Removed the prototype/version/payment-disclaimer footer from the game page. Technical Nostr details remain here in the README.
- No changes to game difficulty, lightning, scoring, WebSocket relays, or hit detection.

## Preview
Run from the **website repository root** (so `/styles.css` and `/assets/*.svg` resolve):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/electric-cowboy/` and hard-refresh.

## Nostr details
The relay listener remains unmodified. It observes public NIP-57 `kind:9735` events; settlement is not independently verified. Game scores do not transfer sats.

Configured relays: `wss://nos.lol`, `wss://relay.primal.net`, and `wss://nostr.oxtr.dev`. Production CSP must permit any relay being used.
