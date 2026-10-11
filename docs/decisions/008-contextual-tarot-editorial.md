# ADR 008: Context-sensitive tarot editorial release

Status: implemented, 2026-10-11. Supplements ADR 004; human editorial approval is not established.

## Evidence and decision

The supplied release-1 review contains 2,696 aligned draws in each of 12 contexts. All 32,352 rows reproduced byte-for-byte through the unchanged current Rust interpreter and production `composeReading`. Across this sample, every action/question stayed identical across intents; removing the topic prefix also made the advice identical across topics. Topic reviewers additionally found orientation/role contradictions and care advice that added demands to an exhausted spread.

Rule advice now has `Topic -> Intent -> reference` maps. The pure Rust interpreter validates all 12 keys per action/question and selects the exact reference. Four authored TSV files supply 252 action/question pairs: present observes current conditions, crossroads compares real options/checks, and action offers a bounded attempt. There is no TypeScript interpretation selector or runtime language service.

Position references now resolve to the actual card's orientation-specific resource, difficulty, action or question through nine authored role frames. Generic theme clauses no longer diagnose the opposite of a reversed card. The overall flow names its cards. Relation phrases identify their actual participating card names, and ordered complements describe a possible progression rather than an already achieved resource. The primary relation still selects the single concluding action/question; secondary evidence is explanatory. Shared evidence templates require comparing phrase arguments as well as reference IDs when suppressing duplicate primary text.

Fallback retains the third card's exact authored action/question, contextualized by topic/intent frames. It explicitly says the rules found no shared theme among the cards, avoiding a judgment about the user's actual relationship. It never fabricates a relationship to improve apparent personalization.

## Compatibility and invariants

New tuple: schema `1`, engine `reading.2`, semantics `semantics.2`, rules `rules.2`, content `reading.en.1.1`. Input and plan shapes retain schema 1; the breaking internal rule-pack map is isolated by its new rules/engine tuple. Rust-generated pack schemas and TypeScript declarations describe the nested maps. Versioned filenames keep release-1 JSON byte-for-byte intact.

The unchanged save envelope accepts old version strings. Restoring an old interpretation keeps the original cards and perspective and requires explicit reinterpretation with current content. It does not rewrite storage until Save. The current engine rejects a release-1 interpretation input; retaining historical packs is not a claim that the current binary evaluates every past release.

Card IDs, core paragraphs, orientations, canonical case IDs, position IDs, lenses, themes, relation priorities and participating evidence are unchanged. Selection, scenes, camera, hand animation, one-card reflections and note privacy are outside this change. New packs remain external to WASM and load only when a completed three-card reading needs them.

## Validation and limits

See [matched evidence and checks](../validation/reading-quality/README.md). Original and revised versions are recorded separately; no old export checkpoint is resumed with new content. Topic agents review original raw rows; an independent validator reviews revised raw outputs and checks preservation separately. Automated parity, export consistency and agent editorial review do not imply human approval.

Relations still use 21 shared theme sentences. Naming their participants does not yet explain each participant's specific theme contribution inside that relation sentence. Some repeated framing remains, especially where secondary relation headers already name the cards. These are recorded limitations rather than lexical-diversity scores.
