"""Convert the small editorial pipe format on stdin into reviewable JSON articles."""
import json
import sys
from pathlib import Path

body = sys.argv[1]
entries = []
for number, line in enumerate(sys.stdin.read().strip().splitlines(), 1):
    summary, prose, constructive, tension, question, themes, topics = line.split("|")
    entries.append(dict(id=f"house.{body}.{number}", summary=summary, body=prose,
                        constructive=constructive, tension=tension, question=question,
                        themes=themes.split(","), topics=topics.split(","), scope="personal"))
assert len(entries) == 12
Path(f"content/astrology/natal/authored/{body}-house.json").write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")
