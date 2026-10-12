"""Download the public-domain 1909 Rider–Waite–Smith scans from Wikimedia Commons with provenance.

Usage: python scripts/fetch-rider-waite.py SOURCE_DIRECTORY
Writes SOURCE_DIRECTORY/rider-waite-smith/<cardId>.jpg and provenance.json. Existing files are kept.
"""
from pathlib import Path
import hashlib, json, sys, time, urllib.parse, urllib.request

AGENT = 'PXOracle-asset-import/1.0 (https://pxoracle.com)'
MAJORS = ['Fool', 'Magician', 'High Priestess', 'Empress', 'Emperor', 'Hierophant', 'Lovers', 'Chariot',
          'Strength', 'Hermit', 'Wheel of Fortune', 'Justice', 'Hanged Man', 'Death', 'Temperance', 'Devil',
          'Tower', 'Star', 'Moon', 'Sun', 'Judgement', 'World']
SUITS = {'wands': 'Wands', 'cups': 'Cups', 'swords': 'Swords', 'pentacles': 'Pents'}


def titles():
    for n, name in enumerate(MAJORS):
        yield f'major.{n:02}', f'File:RWS Tarot {n:02} {name}.jpg'
    for suit, prefix in SUITS.items():
        for n in range(1, 15):
            yield f'{suit}.{n:02}', f'File:{prefix}{n:02}.jpg'


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def main():
    out = Path(sys.argv[1]) / 'rider-waite-smith'
    out.mkdir(parents=True, exist_ok=True)
    wanted = dict(titles())
    by_title = {t: cid for cid, t in wanted.items()}
    records = {}
    items = list(wanted.values())
    for i in range(0, len(items), 40):
        query = urllib.parse.urlencode({
            'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'titles': '|'.join(items[i:i + 40]),
            'iiprop': 'url|size|sha1|extmetadata', 'iiextmetadatafilter': 'LicenseShortName|Artist|DateTimeOriginal'})
        pages = json.loads(get('https://commons.wikimedia.org/w/api.php?' + query))['query']
        normalized = {n['to']: n['from'] for n in pages.get('normalized', [])}
        for page in pages['pages'].values():
            title = normalized.get(page['title'], page['title'])
            if 'imageinfo' not in page:
                raise SystemExit(f'Missing on Commons: {title}')
            info = page['imageinfo'][0]
            license_name = info['extmetadata']['LicenseShortName']['value']
            if license_name.lower() != 'public domain':
                raise SystemExit(f'{title} is {license_name}, not public domain')
            records[by_title[title]] = {
                'title': page['title'], 'page': info['descriptionurl'], 'url': info['url'].split('?')[0],
                'license': license_name, 'date': info['extmetadata'].get('DateTimeOriginal', {}).get('value'),
                'size': [info['width'], info['height']], 'sha1': info['sha1']}
    assert len(records) == 78, len(records)
    for cid, record in sorted(records.items()):
        target = out / f'{cid}.jpg'
        if not target.exists() or hashlib.sha1(target.read_bytes()).hexdigest() != record['sha1']:
            data = get(record['url'])
            if hashlib.sha1(data).hexdigest() != record['sha1']:
                raise SystemExit(f'Checksum mismatch for {cid}')
            target.write_bytes(data)
            time.sleep(0.5)
    (out / 'provenance.json').write_text(json.dumps({
        'deck': 'Rider–Waite–Smith tarot (1909), illustrated by Pamela Colman Smith',
        'source': 'Wikimedia Commons', 'license': 'Public domain', 'cards': dict(sorted(records.items()))},
        indent=2, ensure_ascii=False) + '\n')
    print('Fetched', len(records), 'cards into', out)


if __name__ == '__main__':
    main()
