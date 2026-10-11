"""Build external interpretation packs from original, reviewable English source."""
import hashlib
import json
import sys
from pathlib import Path

root = Path('content/astrology/natal')
versions = dict(schema=1, calculation='0.1.0', interpretation='natal.1', semantics='natal-semantics.1', rules='natal-rules.1', content='natal.en.1')
articles = {}
for path in sorted((root / 'authored').glob('*.json')):
    if path.name in ('pairs.json', 'common.json'):
        continue
    for item in json.loads(path.read_text()):
        assert item['id'] not in articles, item['id']
        articles[item['id']] = item
witnesses = json.loads((root / 'aspect-witnesses.json').read_text())['witnesses']
fallbacks = {'aspect.mercury.venus.square', 'aspect.neptune.pluto.opposition'}
for pair, source in json.loads((root / 'authored/pairs.json').read_text()).items():
    for kind, text in source['aspects'].items():
        reference = f'aspect.{pair}.{kind}'
        assert reference in witnesses or reference in fallbacks, reference
        treatment, tension = text.split('~')
        bodies = pair.split('.')
        scope = 'generational' if all(b in ('uranus', 'neptune', 'pluto') for b in bodies) else ('social' if bodies[0] in ('jupiter', 'saturn') else 'personal')
        articles[reference] = dict(id=reference, themes=source['themes'], topics=source['topics'],
            scope=scope, fallback=reference in fallbacks, summary=treatment,
            body=source['body'] + ' ' + treatment, constructive=source['constructive'],
            tension=tension, question=source['question'])
assert all(reference in articles for reference in witnesses)
common = json.loads((root / 'authored/common.json').read_text())
for item in common['articles']:
    assert item['id'] not in articles
    articles[item['id']] = item
meanings = {}
for reference, item in articles.items():
    for field in ['summary', 'body', 'constructive', 'tension', 'question']:
        assert isinstance(item[field], str) and item[field].strip(), (reference, field)
    if reference.startswith(('sign.', 'house.', 'ascendant.', 'aspect.')):
        assert len(item['body'].split()) >= 35, reference
        meanings[reference] = {k: item[k] for k in ['themes', 'topics', 'scope']}
        meanings[reference].update(reference=reference, fallback=item.get('fallback', False))
prose = {key: {field: item[field] for field in ['summary', 'body', 'constructive', 'tension', 'question']} for key, item in articles.items()}
semantics = dict(versions=versions, meanings=meanings, referenceIds=sorted(articles))
rules = dict(versions=versions,
    bodyWeights=dict(sun=100, moon=100, mercury=80, venus=80, mars=80, jupiter=50, saturn=50, uranus=25, neptune=25, pluto=25),
    aspectWeights=dict(conjunction=40, opposition=35, square=30, trine=20, sextile=15),
    themeRules=common['rules'], overviewRef='overview.introduction', weakRef='overview.no-pattern',
    sampledRef='overview.sampled', polarRef='overview.polar', noAspectsRef='overview.no-aspects',
    topicRefs={topic: f'topic.{topic}' for topic in ['self_emotions', 'communication', 'relationships', 'action_work_growth']})
packs = {'semantics': semantics, 'rules': rules, 'en': dict(versions=versions, locale='en', articles=prose, glossary=common['glossary'])}
out = Path('apps/web/public/content/natal'); out.mkdir(parents=True, exist_ok=True)
def output(path, raw):
    if '--check' in sys.argv:
        assert path.read_bytes() == raw, f'stale pack: {path}'
    else:
        path.write_bytes(raw)
manifest = dict(versions=versions, files={})
for name, data in packs.items():
    filename = f'{name}.1.json'
    raw = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    output(out / filename, raw)
    manifest['files'][name] = dict(path=filename, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
output(out / 'manifest.1.json', (json.dumps(manifest, indent=2) + '\n').encode())
output(root / 'manifest.1.json', (json.dumps(manifest, indent=2) + '\n').encode())
print(json.dumps(dict(placements=252, witnessedAspects=len(witnesses), explicitFallbacks=len(fallbacks), references=len(articles), files=manifest['files']), indent=2))
