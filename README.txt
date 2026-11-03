Scalable Markdown for Agents routing update

1. Do this on your existing feature branch, not directly on main.
2. Review _routes.json in this archive, especially any existing rules you've added
   beyond /api/contact/*. The archive contains the known project rules; don't
   overwrite any unrelated custom routing rules without merging them.
3. From your repo root:
   unzip -o ~/Downloads/agent-markdown-scalable.zip -d .
4. Remove only generated poster Markdown files (after reviewing the list):
   find posters -type f -name index.md -print
   find posters -type f -name index.md -delete
5. Run:
   /tmp/bs-agent-md-venv/bin/python scripts/build_agent_markdown.py
6. Check:
   git diff --check
   cat _routes.json
   git status --short
7. Local testing with Wrangler:
   npx wrangler pages dev .
   curl -i -H 'Accept: text/markdown' http://localhost:8788/cyberpunk/neuromancer/
   curl -I -H 'Accept: text/html' http://localhost:8788/cyberpunk/neuromancer/
   curl -I -H 'Accept: text/markdown' http://localhost:8788/posters/jaws/
   curl -I -H 'Accept: text/markdown' http://localhost:8788/contact/
8. Push branch, test the Cloudflare Preview URL, and merge only after checking
   the original /api/contact payment-and-message flow remains functional.

The script no longer modifies _routes.json. To enable a completely new
TOP-LEVEL content section, add its base and trailing-wildcard rules to
_routes.json. To add more pages under /cyberpunk, /memeology, or
/cryptoeconomics, no routing updates are needed.

Note: a wildcard in _routes.json will invoke a Pages Function for requests to
other assets under those directories, even if the Function passes them through.
This avoids per-page rules but may increase Function invocation counts.
