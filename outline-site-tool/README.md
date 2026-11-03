# Static numbered-outline page builder

Generate a single, continuous HTML page from a Markdown research outline, with a chapter index and a permalink for every entry.

## Install (Ubuntu)

```bash
cd ~/bitcoinscoresby
python3 -m venv .venv
source .venv/bin/activate
python -m pip install 'Markdown>=3.5,<4'
```

Add `.venv/` to your `.gitignore` if it is not already excluded.

## Set up in your repository

Copy `build_outline.py` to your repository's `scripts/` directory, and `style.css` to the webpage folder (for example, `archive/`). Place your actual document at `archive/source.md`.

```bash
mkdir -p scripts archive
cp build_outline.py scripts/
cp style.css archive/
python scripts/build_outline.py archive/source.md archive/index.html --title 'Your Document Title'
```

For a quick test, copy `sample.md` to `archive/source.md` instead of your original document.

Preview:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/archive/`.

## Markdown conventions

- Chapter headings: `# 17 CELSIUS NETWORK` (also supports `## 17 CELSIUS NETWORK`).
- Numbered entry: `17.11 &emsp; A paragraph with [a link](https://example.com).`
- Separate outline entries with blank lines.
- Stable entry anchor: `#entry-17.11`; chapter anchor: `#chapter-17`.
- Duplicate entry numbers and duplicate chapter numbers abort the build.
- Other paragraphs and normal Markdown headings remain in document order.
- HTML inside the original Markdown is trusted; don't use this on untrusted files without sanitizing.
- Bare links (e.g. `https://example.com`) aren't necessarily clickable. Wrap them as `<https://example.com>` or `[label](https://example.com)` for predictable linking.
- Entries spanning paragraphs, nested lists, or unusual tables should be reviewed in the generated result: the converter targets simple numbered paragraphs and preserves other Markdown as-is.

## Publishing

Commit the original Markdown, generated `index.html`, and `style.css`. Python is only needed when rebuilding; Cloudflare Pages serves the generated HTML directly. To keep the source document private, store it outside the public repository and commit only the generated page and CSS.
