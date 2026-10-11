"""Keep authored pair discussion and each aspect's distinct treatment together."""
import json
import sys
from pathlib import Path

path = Path('content/astrology/natal/authored/pairs.json')
data = json.loads(path.read_text()) if path.exists() else {}
for row in sys.stdin.read().strip().splitlines():
    pair, themes, topics, body, action, question, *aspects = row.split('|')
    assert len(aspects) == 5 and pair not in data, pair
    data[pair] = dict(themes=themes.split(','), topics=topics.split(','), body=body,
                      constructive=action, question=question,
                      aspects={kind: text for kind, text in zip(['conjunction', 'sextile', 'square', 'trine', 'opposition'], aspects) if text != '-'})
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
