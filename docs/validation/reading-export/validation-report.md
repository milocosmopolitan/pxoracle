# Reading export validation report

- State: **complete** (scope `full`, cases 0..3651647)
- Rows per context: 3,651,648 x 12 = 43,819,776
- Source: 1b53168fb3ed7fd1dbf73cd7d29b37b0f89eb3a3 (clean)
- Automated gates passed: yes
- Production parity: 2279 sampled cases x 12 contexts, 0 mismatches; 18 native/WASM fixture cases, 0 mismatches
- **Human editorial approval: NOT performed.** Automated checks do not approve sentences.

## Coverage status

| Claim | Status |
| --- | --- |
| Full export verified | yes, all rows |
| Review set | 2696 cases, card x orientation x position 468/468 |
| Unreachable rules | none |

## Rule frequencies (identical across all 12 contexts)

Fallback rows: 75,001 (2.05%)

| Rule | As primary | In any relation |
| --- | ---: | ---: |
| tension.care-boundaries | 960480 | 1284246 |
| repetition.clarity | 159745 | 616897 |
| repetition.care | 214223 | 563335 |
| tension.expansion-boundaries | 514230 | 543762 |
| tension.clarity-uncertainty | 298908 | 536514 |
| repetition.boundaries | 119271 | 453027 |
| tension.change-stability | 284736 | 388950 |
| complement.care-connection | 184929 | 385286 |
| complement.clarity-effort | 158173 | 349391 |
| tension.effort-rest | 296322 | 296322 |
| tension.connection-solitude | 162438 | 229296 |
| repetition.stability | 25903 | 138799 |
| repetition.connection | 39986 | 135137 |
| repetition.change | 34977 | 124609 |
| complement.release-change | 44079 | 100488 |
| repetition.rest | 15390 | 84487 |
| repetition.expansion | 21046 | 79928 |
| repetition.effort | 19190 | 74017 |
| repetition.uncertainty | 6758 | 40854 |
| repetition.release | 8651 | 39691 |
| repetition.solitude | 7212 | 34830 |

## Cross-context text differences

For each section, how many cases yield N distinct texts across the 12 contexts (identical text is legitimate, not an error).

**overall_text**: 12 distinct: 3,651,648

**relation_text**: 1 distinct: 3,651,648

**action_text**: 1 distinct: 75,001, 4 distinct: 3,576,647

**question_text**: 1 distinct: 75,001, 4 distinct: 3,576,647

**position_1_text**: 12 distinct: 3,651,648

**position_2_text**: 12 distinct: 3,651,648

**position_3_text**: 12 distinct: 3,651,648

## Distinct texts per context file (hash-based)

| Context | overall_text | relation_text | action_text | question_text | position_1_text | position_2_text | position_3_text |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| relationships-present | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| relationships-crossroads | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| relationships-action | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| work-present | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| work-crossroads | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| work-action | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| creativity-present | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| creativity-crossroads | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| creativity-action | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| growth-present | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| growth-crossroads | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |
| growth-action | 791,614 | 2,069,142 | 177 | 177 | 156 | 156 | 156 |

## Spreadsheet-formula-leading fields in canonical files

None. Canonical text needs no escaping.

Reviewer copies (`--reviewer-copies`) prefix such cells with an apostrophe; canonical files are never altered.
