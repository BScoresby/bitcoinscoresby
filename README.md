# BitcoinScoresby terminal site

Pure HTML/CSS static pages with a single 12-line JavaScript file for command navigation. No frameworks or build steps.

## Run locally

```bash
cd bitcoinscoresby-terminal-site
python3 -m http.server 8000
```

Visit http://localhost:8000/. Type `whitepaper`, `about`, `research`, `ecash`, `history`, or `stacker news` and press Enter.

## Architecture

- `/` landing page
- `/whitepaper/` the existing whitepaper with MathML and inline SVG diagrams
- `/about/`, `/research/`, `/ecash/`, `/history/` placeholder pages
- `/forum/` temporary placeholder until the real forum URL is provided
- `stacker news` command goes to https://stacker.news
- Emoji navigation: 🐳 home, 📃 whitepaper, 🐋 forum placeholder, ⚡ Stacker News

Deploy the contents to the root of your Cloudflare Pages GitHub repository; Pages will serve folder index pages at clean paths. The existing Cloudflare Pages deployment is not changed by this ZIP.

Space Mono loads via Google Fonts CSS; the site falls back to a system monospace font when offline. No other external runtime assets are necessary.
