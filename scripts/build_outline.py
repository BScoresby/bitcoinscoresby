#!/usr/bin/env python3
"""Build a responsive, static, linkable numbered-outline page from Markdown.

Install: python3 -m pip install markdown
Run: python3 build_outline.py source.md archive/index.html --title 'My Archive'
"""
import argparse
import html
import re
from pathlib import Path

import markdown

# Entry numbers are identifiers, not decimals. This recognizes 17.1, 17.11,
# 16.721, etc., only at the beginning of a paragraph.
ENTRY_RE = re.compile(r'^(?P<number>\d+\.\d+(?:\.\d+)*)(?:[ \t]*(?:&emsp;|&#8195;|\u2003)[ \t]*|[ \t]{2,})(?P<text>.*)$')
CHAPTER_RE = re.compile(r'^#{1,2}\s+(?P<number>\d+)\s+(?P<title>.+?)\s*#*\s*$')
FENCE_RE = re.compile(r'^\s*(`{3,}|~{3,})')


def transform(source):
    """Wrap standalone outline paragraphs in HTML containers, preserving Markdown inline content."""
    lines = source.splitlines()
    output = []
    seen = set()
    chapters = []
    chapter_ids = set()
    in_fence = False
    fence_char = None
    fence_length = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        fence = FENCE_RE.match(line)
        if fence:
            token = fence.group(1)
            if not in_fence:
                in_fence, fence_char, fence_length = True, token[0], len(token)
            elif token[0] == fence_char and len(token) >= fence_length:
                in_fence = False
            output.append(line)
            i += 1
            continue
        if in_fence:
            output.append(line)
            i += 1
            continue
        heading = CHAPTER_RE.match(line)
        if heading:
            num = heading.group('number')
            if num in chapter_ids:
                raise ValueError(f'Duplicate chapter number {num} at source line {i+1}')
            chapter_ids.add(num)
            chapters.append((num, heading.group('title')))
            # Explicit, stable identifiers; independent of heading typography.
            heading_html = markdown.markdown(heading.group('title'), extensions=['extra'])
            heading_html = re.sub(r'^<p>(.*)</p>$', r'\1', heading_html, flags=re.S)
            output.append(f'<h2 id="chapter-{html.escape(num, quote=True)}">{num} {heading_html}</h2>')
            i += 1
            continue
        match = ENTRY_RE.match(line) if not line.startswith(('    ', '\t', '>', '-', '*', '+', '|')) else None
        # Only transform standalone paragraphs with a separating blank line before
        # them (or at the start), preventing disruption of code/list blocks.
        if match and (i == 0 or not lines[i-1].strip()):
            number = match.group('number')
            identifier = number
            if identifier in seen:
                raise ValueError(f'Duplicate outline number {number} at source line {i+1}')
            seen.add(identifier)
            body = [match.group('text')]
            j = i + 1
            while j < len(lines) and lines[j].strip():
                # A following heading/entry begins a separate block.
                if CHAPTER_RE.match(lines[j]) or ENTRY_RE.match(lines[j]):
                    break
                body.append(lines[j])
                j += 1
            # Insert block with inline Markdown processed later by Python-Markdown.
            # Raw HTML blocks normally bypass Markdown parsing; generate the inner
            # HTML in a separate pass for correct links/emphasis.
            fragment = markdown.markdown('\n'.join(body), extensions=['extra', 'sane_lists'])
            output.extend([
                f'<div class="outline-entry" id="{html.escape(identifier, quote=True)}">',
                f'  <a class="outline-number" href="#{html.escape(identifier, quote=True)}" aria-label="Permalink to entry {html.escape(number, quote=True)}">{html.escape(number)}</a>',
                f'  <div class="outline-text">{fragment}</div>',
                '</div>', '',
            ])
            i = j
            continue
        output.append(line)
        i += 1
    return '\n'.join(output), chapters, len(seen)

def build(source, title, css_path):
    lines = source.splitlines(keepends=True)

    first_chapter = next(
        (i for i, line in enumerate(lines) if CHAPTER_RE.match(line)),
        None
    )

    if first_chapter is not None:
        intro_source = ''.join(lines[:first_chapter]).strip()
        outline_source = ''.join(lines[first_chapter:])
    else:
        intro_source = ''
        outline_source = source

    intro_html = (
        '<aside class="publication-note" aria-label="Publication history">'
        + markdown.markdown(intro_source, extensions=['extra'])
        + '</aside>'
        if intro_source else ''
    )

    prepared, chapters, entries = transform(outline_source)
    md = markdown.Markdown(extensions=['extra', 'toc', 'sane_lists'], extension_configs={'toc': {'permalink': False}})
    article = md.convert(prepared)
    # Only numbered chapters appear in the TOC.
    chapter_links = []
    for number, heading in chapters:
        chapter_links.append(f'<li><a href="#chapter-{html.escape(number, quote=True)}"><span>{html.escape(number)}</span> {html.escape(heading)}</a></li>')
    toc = '<ol>\n' + '\n'.join(chapter_links) + '\n</ol>' if chapters else '<p>No numbered chapter headings were detected.</p>'
    page = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <link rel="icon" type="image/svg+xml" href="/assets/whale.svg">
  <title>{html.escape(title)} | BitcoinScoresby</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="{html.escape(css_path, quote=True)}">
</head>
<body class="tether-page">
  <main class="page" id="top">
    <header class="site-header">
      <a class="site-logo" href="/" aria-label="BitcoinScoresby home">
        <img src="/assets/whale.svg" alt="">
        <span class="site-name">BS</span>
      </a>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="/whitepaper" aria-label="Whitepaper">
          <img src="/assets/paper.svg" alt="">
        </a>
        <a href="/archive" aria-label="Archive">
          <img src="/assets/folder.svg" alt="">
        </a>
        <a href="https://stacker.news" aria-label="Stacker News">
          <img src="/assets/lightning.svg" alt="">
        </a>
      </nav>
    </header>
    <h1 class="document-title">{html.escape(title)}</h1>
    {intro_html}
    <nav class="contents" aria-label="Chapters">
      <h2>CONTENTS_</h2>
      {toc}
    </nav>
    <article class="document">{article}</article>
    <footer><a href="#top">&uarr; Back to contents</a></footer>
  </main>
</body>
</html>
'''
    return page, len(chapters), entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Markdown source (.md)')
    parser.add_argument('output', type=Path, help='Output index.html')
    parser.add_argument('--title', default='Research Archive')
    parser.add_argument('--css', default='style.css', help='Stylesheet link relative to output page')
    args = parser.parse_args()
    source = args.source.read_text(encoding='utf-8')
    page, chapters, entries = build(source, args.title, args.css)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(page, encoding='utf-8')
    print(f'Wrote {args.output} ({chapters} chapters, {entries} numbered entries, {len(page):,} HTML characters)')


if __name__ == '__main__':
    main()
