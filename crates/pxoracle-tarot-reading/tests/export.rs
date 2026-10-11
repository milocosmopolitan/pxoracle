use pxoracle_tarot_reading::export::*;
use pxoracle_tarot_reading::*;
fn packs() -> (SemanticPack, RulePack) {
    let base = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../content/tarot/reading");
    (
        serde_json::from_str(&std::fs::read_to_string(base.join("semantics.1.json")).unwrap()).unwrap(),
        serde_json::from_str(&std::fs::read_to_string(base.join("rules.1.json")).unwrap()).unwrap(),
    )
}
#[test]
fn scope_and_reference_vectors() {
    let full = CaseSpace::new(FULL_DECK).unwrap();
    assert_eq!(full.len(), 3_651_648);
    assert_eq!(full.len() * contexts().len() as u64, 43_819_776);
    assert_eq!(full.decode(0).unwrap(), [(0, false), (1, false), (2, false)]);
    assert_eq!(full.decode(1).unwrap(), [(0, true), (1, false), (2, false)]);
    assert_eq!(full.decode(8).unwrap(), [(0, false), (1, false), (3, false)]);
    assert_eq!(full.decode(full.len() - 1).unwrap(), [(77, true), (76, true), (75, true)]);
    assert!(full.decode(full.len()).is_err());
    assert!(CaseSpace::new(2).is_err() && CaseSpace::new(79).is_err());
}
#[test]
fn exhaustive_toy_enumeration_is_a_bijection() {
    for n in [3usize, 4, 9] {
        let space = CaseSpace::new(n).unwrap();
        let mut seen = std::collections::BTreeSet::new();
        for id in 0..space.len() {
            let cards = space.decode(id).unwrap();
            assert!(cards[0].0 != cards[1].0 && cards[0].0 != cards[2].0 && cards[1].0 != cards[2].0);
            assert_eq!(space.encode(cards).unwrap(), id);
            seen.insert(cards);
        }
        assert_eq!(seen.len() as u64, space.len());
    }
    assert!(CaseSpace::new(5).unwrap().encode([(1, false), (1, true), (2, false)]).is_err());
}
#[test]
fn twelve_contexts_in_fixed_file_order() {
    let names: Vec<_> = contexts().into_iter().map(|c| c.1).collect();
    assert_eq!(names[0], "relationships-present");
    assert_eq!(names[2], "relationships-action");
    assert_eq!(names[11], "growth-action");
}
#[test]
fn every_toy_case_interprets_and_repeated_cards_are_rejected() {
    let (s, r) = packs();
    let engine = Interpreter::new(s, r).unwrap();
    let space = CaseSpace::new(8).unwrap();
    let v = Versions::default();
    for id in 0..space.len() {
        for (ctx, _) in contexts() {
            let plan = engine.interpret(space.input(id, &ctx, &v).unwrap()).unwrap();
            assert_eq!(plan.positions.len(), 3);
        }
    }
    let mut bad = space.input(0, &contexts()[0].0, &v).unwrap();
    bad.cards[1].card_id = bad.cards[0].card_id.clone();
    assert_eq!(engine.interpret(bad).unwrap_err(), "READING_INPUT");
}
