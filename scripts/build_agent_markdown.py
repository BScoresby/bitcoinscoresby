#!/usr/bin/env python3
"""Generate Markdown equivalents for public content pages.

Run from the repository root. Cloudflare Pages routing lives in a small,
hand-maintained _routes.json; this script never rewrites that file.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup, NavigableString
from markdownify import markdownify

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://bitcoinscoresby.com"
EXCLUDED = {
    ".git", ".venv", "node_modules", "functions", "scripts", "assets",
    "contact", "posters", "tests", ".github", "__pycache__",
}


def process_html(html_path: Path) -> str:
    relative = html_path.relative_to(ROOT)
    url_path = "/" + relative.parent.as_posix().strip("/") + "/"
    page_url = SITE + url_path

    # An optional original Markdown source takes priority over conversion.
    for name in ("source.md", "tether.md"):
        source = html_path.with_name(name)
        if source.is_file():
            return source.read_text(encoding="utf-8").rstrip() + "\n"

    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
    body = soup.select_one("article") or soup.select_one("main") or soup.body
    if body is None:
        raise ValueError(f"No readable content in {relative}")

    page_heading = soup.select_one("main h1") or soup.select_one("h1")
    title = page_heading.get_text(" ", strip=True) if page_heading else ""
    if not title and soup.title:
        title = soup.title.get_text(" ", strip=True)
    needs_title = not body.find("h1")

    for el in list(body.select(
        "nav, header.site-header, footer, form, script, style, noscript, "
        ".terminal, .block-cursor, .cursor-measure"
    )):
        el.decompose()

    for entry in list(body.select(".outline-entry")):
        number = entry.select_one(".outline-number")
        first_p = entry.select_one(".outline-text p")
        if number and first_p:
            first_p.insert(0, NavigableString(number.get_text(" ", strip=True) + " "))
            number.decompose()
            inner = entry.select_one(".outline-text")
            if inner:
                inner.unwrap()
            entry.unwrap()

    for svg in list(body.find_all("svg")):
        title_tag = svg.find("title") or svg.find("desc")
        description = title_tag.get_text(" ", strip=True) if title_tag else "Diagram"
        placeholder = soup.new_tag("p")
        placeholder.string = f"[Figure: {description}. See the HTML page for the graphic.]"
        svg.replace_with(placeholder)

    for link in body.find_all("a", href=True):
        href = link["href"].strip()
        if href and not href.lower().startswith(("javascript:", "data:")):
            link["href"] = urljoin(page_url, href)
    for img in body.find_all("img", src=True):
        img["src"] = urljoin(page_url, img["src"])

    md = markdownify(str(body), heading_style="ATX", bullets="-")
    if needs_title and title:
        md = f"# {title}\n\n" + md
    return re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"


def route_covers_page(page: str, includes: list[str]) -> bool:
    """Check expected exact and trailing-wildcard routes, conservatively."""
    for rule in includes:
        if rule == page or rule == page + "/":
            return True
        if rule.endswith("/*") and (page + "/").startswith(rule[:-1]):
            return True
    return False


def main() -> None:
    route_file = ROOT / "_routes.json"
    routes = json.loads(route_file.read_text(encoding="utf-8"))
    includes = routes["include"]
    excludes = routes.get("exclude", [])
    if len(includes) + len(excludes) > 100:
        raise SystemExit("Error: _routes.json exceeds Cloudflare's 100-rule limit")
    if "/api/contact/*" not in includes:
        raise SystemExit("Error: /api/contact/* must remain in _routes.json include")
    if any(route == "/*" or route.startswith("/posters") for route in includes):
        raise SystemExit("Error: a routing include rule may capture the excluded poster pages")

    count = 0
    unrouted = []
    for html_path in sorted(ROOT.rglob("index.html")):
        rel = html_path.relative_to(ROOT)
        if len(rel.parts) < 2 or any(
            p in EXCLUDED or p.startswith(".") for p in rel.parts[:-1]
        ):
            continue

        page = "/" + rel.parent.as_posix().strip("/")
        if not route_covers_page(page, includes):
            unrouted.append(page)
            continue

        md_path = html_path.with_name("index.md")
        md_path.write_text(process_html(html_path), encoding="utf-8")
        print(f"Generated {md_path.relative_to(ROOT)}")
        count += 1

    if unrouted:
        raise SystemExit(
            "Unrouted content pages (add a section rule to _routes.json):\n" +
            "\n".join(f"  {page}" for page in unrouted)
        )

    print(f"Finished: {count} public Markdown pages; "
          f"{len(includes) + len(excludes)} routing rules (unchanged)")


if __name__ == "__main__":
    main()
