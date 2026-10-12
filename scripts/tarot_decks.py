"""Build layered tarot decks: per-card art plus shared frames, banners and effects.

Usage: python scripts/tarot_decks.py SOURCE_DIRECTORY
Reads SOURCE/tarot (PXOracle art), SOURCE/tarot/parts (frame, banner and billboard sources) and
SOURCE/rider-waite-smith (scripts/fetch-rider-waite.py). Cards are composed at runtime, so a deck,
or any single card, can swap its frame, top/bottom banners and effect without re-exporting art.
"""
from pathlib import Path
from PIL import Image
import hashlib, json, re, sys

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'apps/web/public/art'
CANVAS = [512, 768]
MAJOR_NAMES = ['The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Teacher',
               'The Lovers', 'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice',
               'The Hanged Man', 'Death', 'Temperance', 'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun',
               'Judgement', 'The World']
# Source file stems in SOURCE/tarot/major arcana, in card order.
MAJOR_FILES = ['the-fool', 'the-magician', 'the-high-pristese', 'the-empress', 'the-emperor', 'the-teacher',
               'the-lovers', 'the-chariot', 'the-strength', 'the-hermit', 'the-wheel-of-fortune', 'the-justice',
               'the-hanged-man', 'the-death', 'the-temperance', 'the-devil', 'the-tower', 'the-star', 'the-moon',
               'the-sun', 'the-judgement', 'the-world']
RANKS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen',
         'King']
SUITS = {'wands': 'wand', 'cups': 'cup', 'swords': 'sword', 'pentacles': 'pentacle'}
# Descriptive file names without a rank word, identified from the artwork.
EXCEPTIONS = {'Crowned Sword Above a Mountain Valley': 1, 'Young Traveler with a Sprouting Wand': 11}
ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI',
         'XVII', 'XVIII', 'XIX', 'XX', 'XXI']

PARTS = {
    'schemaVersion': 1,
    'canvas': CANVAS,
    # Rectangles are [x, y, width, height] on the 512×768 card canvas.
    'frames': {
        'teal-bronze': {'name': 'Teal and bronze', 'url': '/art/card-parts/frames/teal-bronze.webp',
                        'opening': [50, 33, 412, 693],
                        'slots': {'top': [50, 33, 412, 57], 'bottom': [50, 669, 412, 57]}},
        'none': {'name': 'Borderless', 'opening': [28, 18, 456, 739],
                 'slots': {'top': [28, 18, 456, 57], 'bottom': [28, 700, 456, 57]}},
    },
    'banners': {
        'parchment': {'name': 'Parchment', 'url': '/art/card-parts/banners/parchment.webp',
                      'textBox': [16, 7, 380, 50], 'color': '#382919'},
        'clear': {'name': 'Clear', 'url': '/art/card-parts/banners/clear.webp',
                  'textBox': [16, 7, 380, 50], 'color': '#f4e4c1', 'shadow': '#0b0f0e'},
    },
    'effects': {
        'gilded': {'name': 'Gilded', 'outline': '#b38a3b', 'dust': '#ffce78',
                   'billboard': '/art/card-parts/billboards/gilded.webp'},
        'amethyst': {'name': 'Amethyst', 'outline': '#8f5fd8', 'dust': '#c9a6ff',
                     'billboard': '/art/card-parts/billboards/amethyst.webp'},
    },
}


def write(path, image, **options):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.importing.tmp')
    image.save(temporary, format='WEBP', method=6, **options)
    temporary.replace(path)


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def build_parts(source):
    parts = source / 'tarot/parts'
    for kind, key, file in [('frames', 'teal-bronze', 'frame-teal-bronze.png'),
                            ('banners', 'parchment', 'banner-parchment.png'),
                            ('banners', 'clear', 'banner-clear.png'),
                            ('effects', 'gilded', 'billboard-gilded.png'),
                            ('effects', 'amethyst', 'billboard-amethyst.png')]:
        entry = PARTS[kind][key]
        url = entry['billboard'] if kind == 'effects' else entry['url']
        image = Image.open(parts / file).convert('RGBA')
        write(OUT / url.removeprefix('/art/'), image, lossless=True)
        entry['source'] = f'tarot/parts/{file}'
        entry['sha256'] = sha(parts / file)
        if kind == 'banners':
            entry['size'] = list(image.size)
    (OUT / 'card-parts/parts.json').write_text(json.dumps(PARTS, separators=(',', ':')))


def export_art(deck, cid, path, height):
    image = Image.open(path).convert('RGB')
    image = image.resize((round(image.width * height / image.height), height), Image.Resampling.LANCZOS)
    target = OUT / f'decks/{deck}/{cid}.webp'
    write(target, image, quality=90)
    return f'/art/decks/{deck}/{cid}.webp', sha(path), target.stat().st_size


def card_ids():
    for n in range(22):
        yield f'major.{n:02}', MAJOR_NAMES[n], ROMAN[n]
    for suit in SUITS:
        for n, rank in enumerate(RANKS, 1):
            yield f'{suit}.{n:02}', f'{rank} of {suit.title()}', ROMAN[n] if n <= 10 else ''


def pxoracle_sources(source):
    found = {}
    for n, stem in enumerate(MAJOR_FILES):
        found[f'major.{n:02}'] = source / 'tarot/major arcana' / f'{stem}.png'
    for suit, singular in SUITS.items():
        for p in (source / f'tarot/minor arcana - {singular}').glob('*.png'):
            words = re.findall(r'[a-z]+', p.stem.lower())
            ranks = [i + 1 for i, r in enumerate(RANKS) if r.lower() in words]
            n = EXCEPTIONS.get(p.stem) or (ranks[0] if len(ranks) == 1 else None)
            assert n, p
            cid = f'{suit}.{n:02}'
            assert cid not in found, (cid, p)
            found[cid] = p
    assert len(found) == 78 and all(p.exists() for p in found.values()), sorted(found)
    return found


def build_deck(deck_id, meta, defaults, sources, height, names=None):
    cards, total = {}, 0
    for cid, name, numeral in card_ids():
        url, digest, size = export_art(deck_id, cid, sources[cid], height)
        total += size
        cards[cid] = {'name': (names or {}).get(cid, name), 'numeral': numeral, 'art': url,
                      'source': sources[cid].name, 'sha256': digest}
    deck = {'schemaVersion': 1, 'id': deck_id, **meta, 'defaults': defaults, 'cards': cards}
    (OUT / f'decks/{deck_id}/deck.json').write_text(json.dumps(deck, separators=(',', ':'), ensure_ascii=False))
    print(deck_id, len(cards), 'cards,', total, 'bytes')
    return deck


def build(source):
    source = Path(source)
    build_parts(source)
    ours = build_deck(
        'pxoracle',
        {'name': 'PXOracle', 'description': 'The house deck, in retro pixel tapestry.',
         'license': 'User supplied for PXOracle, 2026-10-11. No redistribution license inferred.'},
        {'frame': 'teal-bronze', 'fit': 'cover', 'matte': '#0b1514',
         'banners': {'top': None, 'bottom': {'style': 'parchment', 'text': 'name'}}, 'effect': 'gilded'},
        pxoracle_sources(source), 768)
    rws_dir = source / 'rider-waite-smith'
    provenance = json.loads((rws_dir / 'provenance.json').read_text())
    rws_names = dict(zip([f'major.{n:02}' for n in range(22)], MAJOR_NAMES))
    rws_names['major.05'] = 'The Hierophant'
    build_deck(
        'rider-waite-smith',
        {'name': 'Rider–Waite–Smith', 'description': 'The 1909 deck illustrated by Pamela Colman Smith.',
         'license': 'Public domain (Wikimedia Commons scans); see provenance.',
         'provenance': {cid: c['page'] for cid, c in provenance['cards'].items()}},
        # The scans carry their own printed border and titles, so no frame or banner is layered on top.
        {'frame': 'none', 'fit': 'contain', 'matte': '#efe6d3',
         'banners': {'top': None, 'bottom': None}, 'effect': 'amethyst'},
        {cid: rws_dir / f'{cid}.jpg' for cid, _, _ in card_ids()}, 768, rws_names)
    (OUT / 'decks/index.json').write_text(json.dumps({'schemaVersion': 1, 'parts': '/art/card-parts/parts.json', 'decks': [
        {'id': 'pxoracle', 'name': 'PXOracle', 'url': '/art/decks/pxoracle/deck.json'},
        {'id': 'rider-waite-smith', 'name': 'Rider–Waite–Smith', 'url': '/art/decks/rider-waite-smith/deck.json'},
    ]}, separators=(',', ':'), ensure_ascii=False))
    return {cid: {'name': c['name'], 'url': c['art']} for cid, c in ours['cards'].items()}


if __name__ == '__main__':
    cards = build(sys.argv[1])
    for path in [ROOT / 'assets/manifests/art.json', OUT / 'manifest.json']:
        manifest = json.loads(path.read_text())
        manifest['deckId'] = 'pxoracle.layered.v2'
        manifest['cards'] = cards
        # Baked framed faces (pre-layering) are no longer runtime assets.
        manifest['assets'] = {k: v for k, v in manifest['assets'].items() if not k.startswith('cards/')}
        path.write_text(json.dumps(manifest, indent=2) + '\n' if path.parent.name == 'manifests'
                        else json.dumps(manifest, separators=(',', ':')))
