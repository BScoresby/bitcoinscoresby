#!/usr/bin/env python3
"""Generate a minimal, year-grouped Bitcoin podcast timeline from a Markdown table.

Usage:
  python scripts/build_table_page.py \
    memeology/bitcoin-podcast-directory/source.md \
    memeology/bitcoin-podcast-directory/index.html \
    --title 'Bitcoin Podcasts #40HPW'

The source Markdown remains the authoritative data. Source rows retain their
original order, and links in date/name/host cells are preserved.
"""

import argparse
from html import escape
from itertools import groupby
from pathlib import Path
import re

import markdown
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
HEADER_TEMPLATE = ROOT / "memeology/bitcoin-podcasts/index.html"
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")


def make_timeline(content, table):
    """Replace the single 3-column table with an accessible year-grouped list."""
    rows = table.select("tbody tr")
    entries = []

    for index, row in enumerate(rows, start=1):
        cells = row.find_all("td", recursive=False)
        if len(cells) != 3:
            raise SystemExit(f"Table data row {index} does not have three cells")
        date_cell, title_cell, hosts_cell = cells
        date_text = date_cell.get_text(" ", strip=True)
        match = YEAR_RE.search(date_text)
        if not match:
            raise SystemExit(
                f"Table data row {index} has no four-digit year in its date: {date_text!r}"
            )
        entries.append(
            {
                "year": match.group(),
                "date_html": date_cell.decode_contents(),
                "title_html": title_cell.decode_contents(),
                "hosts_html": hosts_cell.decode_contents(),
                "has_hosts": bool(hosts_cell.get_text(" ", strip=True)),
            }
        )

    # groupby deliberately preserves the order in source.md. Do not sort entries:
    # that could unexpectedly change the user's historical chronology.
    sections = []
    for section_number, (year, group) in enumerate(
        groupby(entries, key=lambda entry: entry["year"]), start=1
    ):
        year_id = f"podcast-year-{year}-{section_number}"
        parts = [
            f'<section class="timeline-year" aria-labelledby="{year_id}">',
            f'<h2 id="{year_id}">{escape(year)}</h2>',
            '<ol class="timeline-list">',
        ]
        for entry in group:
            hosts = entry["hosts_html"]
            separator = (
                '<span class="timeline-separator" aria-hidden="true"> - </span>'
                if entry["has_hosts"]
                else ""
            )
            parts.extend(
                [
                    '<li class="timeline-entry">',
                    f'<p class="timeline-name">{entry["title_html"]}</p>',
                    '<p class="timeline-meta">',
                    '<span class="timeline-date">'
                    '<span class="visually-hidden">First episode: </span>'
                    f'{entry["date_html"]}</span>',
                    separator,
                    f'<span class="timeline-hosts">{hosts}</span>' if hosts else "",
                    '</p>',
                    '</li>',
                ]
            )
        parts.extend(['</ol>', '</section>'])
        sections.append("\n".join(parts))

    markup = '<div class="podcast-timeline">\n' + "\n".join(sections) + '\n</div>'
    new_timeline = BeautifulSoup(markup, "html.parser").select_one(".podcast-timeline")
    table.replace_with(new_timeline)
    return len(entries), len(sections)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Markdown source path relative to repository root")
    parser.add_argument("output", help="HTML output path relative to repository root")
    parser.add_argument("--title", required=True, help="Browser tab title")
    args = parser.parse_args()

    source = ROOT / args.source
    output = ROOT / args.output
    if not source.is_file():
        raise SystemExit(f"Markdown file not found: {source}")
    if not HEADER_TEMPLATE.is_file():
        raise SystemExit(f"Header template not found: {HEADER_TEMPLATE}")

    template = BeautifulSoup(HEADER_TEMPLATE.read_text(encoding="utf-8"), "html.parser")
    header = template.select_one("header.site-header")
    if header is None:
        raise SystemExit("Could not find site navigation in header template")

    html = markdown.markdown(
        source.read_text(encoding="utf-8"),
        extensions=["tables", "fenced_code"],
        output_format="html5",
    )
    content = BeautifulSoup(html, "html.parser")
    tables = content.select("table")
    if len(tables) != 1:
        raise SystemExit(f"Expected exactly one Markdown table, found {len(tables)}")

    headers = tables[0].select("thead th")
    if len(headers) != 3:
        raise SystemExit(f"Expected three table columns, found {len(headers)}")

    row_count, year_count = make_timeline(content, tables[0])

    output.parent.mkdir(parents=True, exist_ok=True)
    html_page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>{escape(args.title)} — BitcoinScoresby</title>
  <link rel="icon" type="image/svg+xml" href="/assets/whale.svg">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="style.css">
  <link rel="alternate" type="text/markdown" href="index.md">
</head>
<body class="podcast-directory-page">
<main class="page">
{header}
<article class="podcast-page">
{content}
</article>
<p class="podcast-back-link"><a href="/memeology/">← Memeology</a></p>
</main>
</body>
</html>
"""
    output.write_text(html_page, encoding="utf-8")
    print(
        f"Generated {output.relative_to(ROOT)}: "
        f"{row_count} podcasts across {year_count} year groups"
    )


if __name__ == "__main__":
    main()
