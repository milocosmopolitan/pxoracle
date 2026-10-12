# Layered tarot decks

Card faces are composed at runtime from separate layers so a deck, or one card in it, can change
its frame, top/bottom banners and effect without re-exporting artwork. This is the basis for selling
decks and card cosmetics later.

## Runtime files (`apps/web/public/art`)

| Path | Owner | Contents |
| --- | --- | --- |
| `decks/index.json` | `scripts/tarot_decks.py` | Deck list and the parts catalog URL |
| `decks/<deck>/deck.json` | `scripts/tarot_decks.py` | Deck defaults and per-card `name`, `numeral`, `art`, optional overrides |
| `decks/<deck>/<cardId>.webp` | `scripts/tarot_decks.py` | Card illustration only, 768 px tall, WebP q90 |
| `card-parts/parts.json` | `scripts/tarot_decks.py` | Frames (opening + banner slot rects), banners (text box, colours), effects |
| `card-parts/frames/*.webp` | `scripts/tarot_decks.py` | Frame with a transparent opening, 512×768 card canvas |
| `card-parts/banners/*.webp` | `scripts/tarot_decks.py` | Banner authored for the **bottom** slot; the top slot mirrors it |
| `card-parts/billboards/*.webp` | `scripts/tarot_decks.py` | Pre-baked selection glow per effect |

`apps/web/src/features/tarot/deck.ts` resolves a card to a `CardLook` (contracts): a card's
`frame`, `fit`, `matte`, `effect` and each `banners.top` / `banners.bottom` slot replace the deck
default independently; `null` removes an inherited banner. `packages/scenes/src/tarot-card-compose.ts`
draws matte → art (fitted between the enabled banners) → banners and text → frame into one 512×768
canvas texture shared through `TextureLeases.acquireWith`.

Effects have two forms. While choosing face-down cards the scene shows the effect's **billboard**:
one additive quad, no bloom pass. A revealed card in focus uses the full effect: bloom outline in
`outline` colour and stardust in `dust` colour.

## Decks

| Deck | Defaults | Art source | Licence |
| --- | --- | --- | --- |
| `pxoracle` | `teal-bronze` frame, bottom `parchment` name banner, no top banner, `gilded` | `_assets/tarot` (user supplied, 2026-10-11) | User supplied for PXOracle; no redistribution licence inferred |
| `rider-waite-smith` | no frame, no banners (scans carry printed border and titles), `contain` on `#efe6d3`, `amethyst` | Wikimedia Commons scans of the 1909 deck by Pamela Colman Smith | Public domain; per-card Commons page in `deck.json` `provenance` |

`scripts/fetch-rider-waite.py SOURCE` downloads the scans, refuses any file Commons does not mark
public domain, verifies SHA-1 and writes `SOURCE/rider-waite-smith/provenance.json`.

## Part sources (`_assets/tarot/parts`)

- `frame-teal-bronze.png`, `banner-parchment.png`: the per-pixel median of the 78 previously baked
  cards (`apps/web/public/art/cards/*.webp`, imported 2026-10-10, removed in this change). Art varies
  between cards while the frame does not, so the median recovers the shared frame and plates exactly.
  The frame keeps everything outside x 50–462, y 33–726 plus the non-parchment corner ornaments; the
  banner is rows 669–725 of that window (rule line + bottom plate) with the frame's notch pixels cleared.
- `banner-clear.png`: the parchment banner with the plate replaced by `#0b0f0e` at alpha 110.
- `billboard-gilded.png`, `billboard-amethyst.png`: generated (180×256, card rect 152×228 centred):
  3 px rounded outline at the card edge, Gaussian glow radius 6 at 0.85, alpha stepped to sixths,
  four corner sparkles. Gilded core `#ffde8c` / rim `#b38a3b`; amethyst core `#e2c4ff` / rim `#8452d6`.

Rebuild everything with `python scripts/tarot_decks.py ../_assets` (also run by a full
`scripts/import-assets.py`). Adding a frame, banner or effect means adding its source PNG and an
entry in `PARTS`; adding a deck means a source folder and a `build_deck` call.
