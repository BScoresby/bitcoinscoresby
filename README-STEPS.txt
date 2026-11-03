Agent Markdown files for bitcoinscoresby.com

These are additive files. Copy their contents to the root of your existing repo.
DO NOT replace your existing _routes.json or contact Functions.

1. Install dependencies in a virtual environment outside of the site:
     python3 -m venv /tmp/bs-agent-md-venv
     /tmp/bs-agent-md-venv/bin/pip install -r requirements-agent-markdown.txt
2. Generate:
     /tmp/bs-agent-md-venv/bin/python scripts/build_agent_markdown.py
   This creates index.md next to public article index.html files and adds their
   exact URLs to your existing _routes.json, preserving /api/contact/*.
3. Test with:
     npx wrangler pages dev .
   In another terminal:
     curl -i http://localhost:8788/tether/ -H 'Accept: text/markdown'
     curl -i http://localhost:8788/tether/ -H 'Accept: text/html'
4. In Cloudflare Pages Build settings, set build command to:
     python3 -m pip install --quiet --target /tmp/bs-agent-md-deps -r requirements-agent-markdown.txt && PYTHONPATH=/tmp/bs-agent-md-deps python3 scripts/build_agent_markdown.py
   Keep your current static-site output directory (repository root, typically .).
5. Deploy via a preview branch before merging to main.

Optional: Add source.md beside an index.html to override automatic conversion
with original Markdown. For tether, tether.md works as a source override too.

The function runs only on exact document URLs included in _routes.json.
The /contact/ page is excluded and /api/contact/* stays functional.
