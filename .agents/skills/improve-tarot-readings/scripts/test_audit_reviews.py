import csv
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from audit_reviews import audit, REQUIRED, TEXTS, VERSIONS


class ReviewAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def write(self, name, topic='work', intent='present', ids=(0,), **overrides):
        rows = []
        for case in ids:
            row = dict.fromkeys(REQUIRED, 'test')
            row.update(case_id=str(case), topic=topic, intent=intent, fallback='false')
            for i in range(1, 4):
                row[f'card_{i}_id'] = f'major.{i-1:02}'
                row[f'card_{i}_orientation'] = 'upright'
            row.update({k: 'v1' for k in VERSIONS})
            row.update({k: 'Line one, quoted "word"\nLine two' for k in TEXTS})
            row.update(overrides)
            rows.append(row)
        path = self.root/name
        with path.open('w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=REQUIRED)
            writer.writeheader()
            writer.writerows(rows)
        return path

    def test_partial_context_and_multiline(self):
        result = audit([self.write('a.csv')])
        self.assertEqual(result['coverage']['commonCases'], 1)
        self.assertEqual(len(result['coverage']['missingContexts']), 11)
        self.assertEqual(result['comparisons'], [])
        self.assertEqual(result['files'][0]['uniqueText']['overall_text'], 1)

    def test_prefix_only_and_real_difference(self):
        a = self.write('a.csv', action_text='In your work or career, test one step.', question_text='Which task?')
        b = self.write('b.csv', topic='growth', action_text='In your personal growth, test one step.', question_text='Which habit?')
        result = audit([a, b])['comparisons'][0]
        self.assertFalse(result['completeAxis'])
        self.assertEqual(result['sections']['action_text']['identicalCases'], 0)
        self.assertEqual(result['sections']['action_text']['normalizedIdenticalCases'], 1)
        self.assertEqual(result['sections']['question_text']['normalizedIdenticalCases'], 0)

    def test_misaligned_sets_reported(self):
        a = self.write('a.csv', ids=(0, 1))
        b = self.write('b.csv', intent='action', ids=(1, 2))
        result = audit([a, b])
        self.assertFalse(result['coverage']['alignedCaseSets'])
        self.assertEqual(result['comparisons'][0]['comparedCases'], 1)

    def test_duplicates_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate case_id'):
            audit([self.write('a.csv', ids=(0, 0))])

    def test_versions_and_cards_rejected(self):
        a = self.write('a.csv')
        b = self.write('b.csv', intent='action', content_version='v2')
        with self.assertRaisesRegex(ValueError, 'Mixed pack'):
            audit([a, b])
        b = self.write('b.csv', intent='action', card_1_id='major.05')
        with self.assertRaisesRegex(ValueError, 'Card/orientation mismatch'):
            audit([a, b])

    def test_overlap_mismatch_outside_global_intersection(self):
        a = self.write('a.csv', ids=(0, 1))
        b = self.write('b.csv', intent='action', ids=(1,), card_1_id='major.05')
        c = self.write('c.csv', intent='crossroads', ids=(0,))
        with self.assertRaisesRegex(ValueError, 'Card/orientation mismatch'):
            audit([a, b, c])

    def test_row_limit_rejects_without_silent_truncation(self):
        with self.assertRaisesRegex(ValueError, 'exceeds 1'):
            audit([self.write('a.csv', ids=(0, 1))], max_rows=1)

    def test_missing_header(self):
        path = self.root/'bad.csv'
        path.write_text('case_id\n0\n')
        with self.assertRaisesRegex(ValueError, 'invalid header'):
            audit([path])


if __name__ == '__main__':
    unittest.main()
