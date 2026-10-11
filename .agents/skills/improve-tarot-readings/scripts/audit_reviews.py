#!/usr/bin/env python3
"""Bounded, read-only diagnostics for representative PXOracle reading CSVs."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import sys

TOPICS = ('relationships', 'work', 'creativity', 'growth')
INTENTS = ('present', 'crossroads', 'action')
TEXTS = ('overall_text', 'relation_text', 'action_text', 'question_text',
         'position_1_text', 'position_2_text', 'position_3_text')
VERSIONS = ('engine_version', 'semantics_version', 'rules_version',
            'content_version', 'export_schema_version')
CARDS = tuple(f'card_{i}_{field}' for i in range(1, 4) for field in ('id', 'orientation'))
REQUIRED = ('case_id', 'topic', 'intent', 'fallback', 'relation_rule_ids') + CARDS + TEXTS + VERSIONS
PREFIXES = ('Within a relationship, ', 'In your work or career, ',
            'For a creative project, ', 'In your personal growth, ')


def normalize(text):
    for prefix in PREFIXES:
        if text.startswith(prefix):
            text = text[len(prefix):]
            break
    return ' '.join(text.split()).casefold()


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def audit(paths, max_rows=5000):
    if not 1 <= len(paths) <= 12:
        raise ValueError('Supply 1..12 representative review CSVs, one per context')
    if not 1 <= max_rows <= 50000:
        raise ValueError('max_rows must be 1..50000; use the export validator for full exports')
    files, contexts, versions = [], {}, set()
    for raw in paths:
        path = Path(raw).resolve()
        rows, context = {}, None
        with path.open(encoding='utf-8-sig', newline='') as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames or []
            missing = set(REQUIRED) - set(header)
            if missing or len(header) != len(set(header)):
                raise ValueError(f'{path.name}: invalid header; missing {sorted(missing)}')
            for index, row in enumerate(reader, 1):
                if index > max_rows:
                    raise ValueError(f'{path.name}: exceeds {max_rows} review rows; no truncated audit was produced')
                if None in row or any(row[k] is None for k in REQUIRED):
                    raise ValueError(f'{path.name}: malformed CSV record {index}')
                key = (row['topic'], row['intent'])
                if key[0] not in TOPICS or key[1] not in INTENTS:
                    raise ValueError(f'{path.name}: unknown context {key}')
                if context is not None and context != key:
                    raise ValueError(f'{path.name}: mixed contexts')
                context = key
                try:
                    case = int(row['case_id'])
                except ValueError:
                    raise ValueError(f'{path.name}: invalid case_id') from None
                if not 0 <= case < 3651648 or case in rows:
                    raise ValueError(f'{path.name}: invalid or duplicate case_id {case}')
                if any(row[f'card_{i}_orientation'] not in ('upright', 'reversed') for i in range(1, 4)):
                    raise ValueError(f'{path.name}: invalid orientation at {case}')
                if row['fallback'] not in ('true', 'false'):
                    raise ValueError(f'{path.name}: invalid fallback at {case}')
                versions.add(tuple(row[k] for k in VERSIONS))
                rows[case] = row
        if not rows or context in contexts:
            raise ValueError(f'{path.name}: empty file or duplicate context')
        contexts[context] = rows
        files.append({'path': str(path), 'sha256': digest(path), 'context': list(context),
                      'rows': len(rows), 'fallbackRows': sum(r['fallback'] == 'true' for r in rows.values()),
                      'uniqueText': {k: len({r[k] for r in rows.values()}) for k in TEXTS},
                      'blankRequiredText': {k: sum(not r[k].strip() for r in rows.values()) for k in TEXTS}})
    if len(versions) != 1:
        raise ValueError('Mixed pack/export versions; re-render compatible inputs before comparing')
    case_sets = [set(rows) for rows in contexts.values()]
    common, union = set.intersection(*case_sets), set.union(*case_sets)
    for case in union:
        signatures = {tuple(rows[case][k] for k in CARDS) for rows in contexts.values() if case in rows}
        if len(signatures) != 1:
            raise ValueError(f'Card/orientation mismatch for case {case}')
    comparisons = []
    groups = [('intents', t, [(t, i) for i in INTENTS]) for t in TOPICS]
    groups += [('topics', i, [(t, i) for t in TOPICS]) for i in INTENTS]
    for axis, label, keys in groups:
        available = [k for k in keys if k in contexts]
        if len(available) < 2:
            continue
        shared = sorted(set.intersection(*(set(contexts[k]) for k in available)))
        result = {'axis': axis, 'group': label, 'contexts': [list(k) for k in available],
                  'completeAxis': len(available) == len(keys), 'comparedCases': len(shared), 'sections': {}}
        for field in TEXTS:
            exact, normalized, examples = 0, 0, []
            for case in shared:
                texts = [contexts[k][case][field] for k in available]
                same = len(set(texts)) == 1
                norm_same = len({normalize(x) for x in texts}) == 1
                exact += same
                normalized += norm_same
                if norm_same and len(examples) < 5:
                    examples.append(case)
            result['sections'][field] = {'identicalCases': exact, 'normalizedIdenticalCases': normalized,
                                         'exampleCaseIds': examples}
        comparisons.append(result)
    return {'schemaVersion': 1, 'scope': 'supplied-review-files-only',
            'versions': dict(zip(VERSIONS, next(iter(versions)))), 'files': files,
            'coverage': {'contexts': [list(k) for k in sorted(contexts)], 'commonCases': len(common),
                         'unionCases': len(union), 'alignedCaseSets': all(x == case_sets[0] for x in case_sets),
                         'missingContexts': [list((t, i)) for t in TOPICS for i in INTENTS if (t, i) not in contexts]},
            'comparisons': comparisons,
            'limitations': ['Lexical equality is diagnostic, not a semantic quality score.',
                            'Normalization only strips four known English topic prefixes and folds case/whitespace.',
                            'Review sample frequencies do not estimate full export population frequencies.',
                            'This audit does not prove canonical enumeration, production parity or editorial approval.']}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('files', nargs='+', type=Path)
    p.add_argument('--out', type=Path)
    p.add_argument('--max-rows', type=int, default=5000)
    args = p.parse_args()
    try:
        if args.out and args.out.resolve() in {x.resolve() for x in args.files}:
            raise ValueError('Output must not overwrite an input CSV')
        report = audit(args.files, args.max_rows)
        text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(text, encoding='utf-8')
        else:
            print(text, end='')
    except (ValueError, OSError, csv.Error) as e:
        p.exit(2, f'AUDIT_FAILED: {e}\n')


if __name__ == '__main__':
    main()
