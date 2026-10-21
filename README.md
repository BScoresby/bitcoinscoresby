# BitcoinScoresby — Whitepaper homepage

A no-build, static HTML/CSS landing page for Cloudflare Pages.

- `index.html`: the full **Bitcoin: A Peer-to-Peer Electronic Cash System** in semantic HTML, with accessible, inline monochrome SVG figures and native MathML mathematics.
- `styles.css`: typography, spacing, mobile layout and scrollable equations/figures.
- `assets/whale.svg`: whale emoji artwork.

## View locally

From this directory:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/. No dependencies or JavaScript are required.

## Deploy

Commit the whole directory to a GitHub repository and create a Cloudflare **Pages** Git-integration project. Framework preset **None**; build command blank; build output directory `/`.

Once deployed to the project’s `.pages.dev` URL, open **Custom domains** in Pages to connect `bitcoinscoresby.com` and `www.bitcoinscoresby.com`; replace the previous Hosterbox A record via Cloudflare's guided connection process.

## Reproduction and accuracy

The accompanying PDF supplied by the site owner was used as the primary source. The transcription retains the original paper’s 12 numbered sections, abstract, references, code sample and published numerical examples. Diagrams have been recreated in inline SVG for display, so line positions are not identical to the original typesetting. Math equations are native MathML, not raster images.

The original paper's statements are presented as historical text, including its 2008 computing assumptions and terminology.

## Attribution

Bitcoin whitepaper: Satoshi Nakamoto, 2008. Original PDF: https://bitcoin.org/bitcoin.pdf.

The whale graphic is derived from Twitter's Twemoji artwork, licensed CC BY 4.0. https://github.com/twitter/twemoji — https://creativecommons.org/licenses/by/4.0/.
