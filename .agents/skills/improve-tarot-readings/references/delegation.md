# Delegation and finding contract

Use the host's available subagent API; do not hardcode one model vendor. Assign explicit roles and bounded inputs. Keep development-time agents separate from production interpretation.

## Dispatch

1. Coordinator: establish versions, baseline, aligned anchor cases and allowed scope.
2. Topic reviewers: assign relationships, work, creativity and growth separately, each comparing present/crossroads/action. Supply CSV paths, selected case IDs, source map, rubric, relevant authored sources and a maximum review batch (start with 20-40 cases). Request read-only findings and proposed original text.
3. Integrator: consolidate findings, map shared causes and implement. Parallelize implementation only for disjoint owned files; shared generator/Rust/contracts belong to one owner.
4. Independent validator: after integration, supply raw old/new outputs, current source and acceptance requirements. Do not supply the author's expected verdict. Request regression findings, not a rubber-stamp approval.

Scale by relation family and orientation after the initial anchors; avoid launching one agent per exported row. Return each worker's revision and reviewed keys, deduplicate by root cause and retain disagreements. Never label unreviewed cases approved.

## Task template

Use improve-tarot-readings at <skill path>. Review <topic> in <CSV paths> for case IDs <list> against all available intents. Read <source paths>. Work read-only; do not change shared files, generated packs, fixtures or exported CSVs. Return JSON findings with evidence and proposed production-source changes. State missing contexts and checks you cannot perform.

## Machine-readable findings

Use a JSON object with schemaVersion=1, sourceRevision, inputHashes, versions, coverage (contexts, caseIds, limitations), findings array and checks array. Each finding must contain:

- id, severity (high/medium/low), dimension, topic, intents, caseIds;
- section and before excerpts, explanation, productionSource (path and referenceId or authored-row key);
- proposedChange, rationale and verificationCases;
- disposition (open/accepted/rejected/implemented), with a reason for rejection or implementation evidence.

Use null for an unknown reference and explain it; never invent IDs. Keep excerpts minimal. Store private input files locally; share only synthetic card/context rows with agents. Include original-review versions alongside revised versions in a delta artifact. Report agent review as agent review, never human approval.
