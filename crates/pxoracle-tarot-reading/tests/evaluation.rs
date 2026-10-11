use pxoracle_tarot_reading::*;
fn packs() -> (SemanticPack, RulePack) {
    let base = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../content/tarot/reading");
    (
        serde_json::from_str(&std::fs::read_to_string(base.join("semantics.2.json")).unwrap())
            .unwrap(),
        serde_json::from_str(&std::fs::read_to_string(base.join("rules.2.json")).unwrap()).unwrap(),
    )
}
fn input(ids: [&str; 3]) -> ReadingInput {
    ReadingInput {
        versions: Versions::default(),
        context: Context {
            topic: Topic::Relationships,
            intent: Intent::Present,
        },
        cards: ids
            .iter()
            .zip([
                Position::Situation,
                Position::Examination,
                Position::NextAction,
            ])
            .map(|(id, position_id)| RevealedCard {
                card_id: id.to_string(),
                orientation: Orientation::Upright,
                position_id,
            })
            .collect(),
    }
}
#[test]
fn all_cards_orientations_contexts_and_positions() {
    let (s, r) = packs();
    let engine = Interpreter::new(s, r).unwrap();
    for id in card_ids() {
        for orientation in [Orientation::Upright, Orientation::Reversed] {
            for slot in 0..3 {
                for topic in TOPICS {
                    for intent in [Intent::Present, Intent::Crossroads, Intent::Action] {
                        let mut ids = card_ids().into_iter().filter(|v| v != &id);
                        let mut value = input([&id, &ids.next().unwrap(), &ids.next().unwrap()]);
                        value.cards.swap(0, slot);
                        for (card, position) in value.cards.iter_mut().zip([
                            Position::Situation,
                            Position::Examination,
                            Position::NextAction,
                        ]) {
                            card.position_id = position;
                        }
                        value.cards[slot].orientation = orientation;
                        value.context = Context { topic, intent };
                        let plan = engine.interpret(value.clone()).unwrap();
                        assert_eq!(plan, engine.interpret(value).unwrap());
                        assert_eq!(
                            plan.positions.iter().map(|p| p.role).collect::<Vec<_>>(),
                            roles(intent)
                        );
                        assert!(plan.relations.len() <= 2);
                        assert_eq!(
                            plan.positions[slot].lens == Lens::Direct,
                            orientation == Orientation::Upright
                        );
                        if let Some(primary) = plan.relations.first() {
                            assert_eq!(plan.action.card_indices, primary.card_indices);
                            assert_eq!(plan.question.card_indices, primary.card_indices);
                        }
                    }
                }
            }
        }
    }
}
#[test]
fn rejection_preserves_bounded_contract() {
    let (s, r) = packs();
    let engine = Interpreter::new(s.clone(), r.clone()).unwrap();
    let mut v = input(["major.00", "major.01", "major.02"]);
    v.cards[1] = v.cards[0].clone();
    assert_eq!(engine.interpret(v).unwrap_err(), "READING_INPUT");
    let mut v = input(["major.00", "major.01", "major.02"]);
    v.cards.swap(0, 1);
    assert!(engine.interpret(v).is_err());
    let mut v = input(["major.00", "major.01", "major.02"]);
    v.versions.content = "other".into();
    assert_eq!(engine.interpret(v).unwrap_err(), "READING_VERSION");
    let mut v = serde_json::to_value(input(["major.00", "major.01", "major.02"])).unwrap();
    v["note"] = "private".into();
    assert!(serde_json::from_value::<ReadingInput>(v).is_err());
    let mut missing = s.clone();
    missing.meanings.remove("major.00.upright");
    assert!(Interpreter::new(missing, r.clone()).is_err());
    let mut missing_name = s.clone();
    missing_name.reference_ids.retain(|r| r != "name.major.00");
    assert!(Interpreter::new(missing_name, r.clone()).is_err());
    let mut broken = s;
    broken
        .meanings
        .get_mut("major.00.upright")
        .unwrap()
        .action_ref = "absent".into();
    assert!(Interpreter::new(broken, r).is_err());
}
#[test]
fn rules_rank_stably_and_weak_links_fall_back() {
    let (mut s, r) = packs();
    for m in s.meanings.values_mut() {
        m.themes = vec![Theme::Expansion];
    }
    s.meanings.get_mut("major.01.upright").unwrap().themes = vec![Theme::Boundaries];
    let engine = Interpreter::new(s.clone(), r.clone()).unwrap();
    let v = input(["major.00", "major.01", "major.02"]);
    let plan = engine.interpret(v.clone()).unwrap();
    assert_eq!(plan.relations[0].kind, RelationKind::Tension);
    let mut reversed = r.clone();
    reversed.rules.reverse();
    assert_eq!(
        plan,
        Interpreter::new(s.clone(), reversed)
            .unwrap()
            .interpret(v.clone())
            .unwrap()
    );
    for (id, theme) in [
        ("major.00.upright", Theme::Solitude),
        ("major.01.upright", Theme::Effort),
        ("major.02.upright", Theme::Care),
    ] {
        s.meanings.get_mut(id).unwrap().themes = vec![theme];
    }
    let weak = Interpreter::new(s, r).unwrap().interpret(v).unwrap();
    assert!(weak.fallback);
    assert_eq!(weak.action.card_indices, vec![2]);
}
#[test]
fn complement_is_ordered_repetition_is_supported() {
    let (mut s, r) = packs();
    for m in s.meanings.values_mut() {
        m.themes = vec![Theme::Solitude];
    }
    s.meanings.get_mut("major.00.upright").unwrap().themes = vec![Theme::Clarity];
    s.meanings.get_mut("major.01.upright").unwrap().themes = vec![Theme::Effort];
    let engine = Interpreter::new(s, r).unwrap();
    let forward = engine
        .interpret(input(["major.00", "major.01", "major.02"]))
        .unwrap();
    assert_eq!(forward.relations[0].kind, RelationKind::Complement);
    let backward = engine
        .interpret(input(["major.01", "major.00", "major.02"]))
        .unwrap();
    assert!(backward.fallback);
    let repeat = engine
        .interpret(input(["major.03", "major.04", "major.05"]))
        .unwrap();
    assert_eq!(repeat.relations[0].kind, RelationKind::Repetition);
    assert_eq!(repeat.relations[0].card_indices, vec![0, 1, 2]);
}

#[test]
fn the_same_card_changes_role_when_its_position_changes() {
    let (s, r) = packs();
    let engine = Interpreter::new(s, r).unwrap();
    let first = engine
        .interpret(input(["major.00", "major.04", "major.14"]))
        .unwrap();
    let last = engine
        .interpret(input(["major.14", "major.04", "major.00"]))
        .unwrap();
    assert_eq!(
        first.positions[0].phrases[0].reference,
        last.positions[2].phrases[0].reference
    );
    assert_ne!(
        first.positions[0].phrases[1].reference,
        last.positions[2].phrases[1].reference
    );
    assert_ne!(first.overall, last.overall);
    assert_eq!(last.positions[2].phrases[0].card_indices, vec![2]);
}

#[test]
fn relation_advice_dispatches_all_intents_and_incomplete_maps_fail() {
    let (s, r) = packs();
    let engine = Interpreter::new(s.clone(), r.clone()).unwrap();
    for topic in TOPICS {
        for intent in INTENTS {
            let mut value = input(["major.00", "major.04", "major.14"]);
            value.context = Context { topic, intent };
            let plan = engine.interpret(value).unwrap();
            let primary = &plan.relations[0];
            let rule = r.rules.iter().find(|r| r.id == primary.rule_id).unwrap();
            assert_eq!(plan.action.reference, rule.action_refs[&topic][&intent]);
            assert_eq!(plan.question.reference, rule.question_refs[&topic][&intent]);
            assert_eq!(primary.phrase.arguments.last(), Some(&rule.relation_ref));
            assert_eq!(
                primary.phrase.arguments.len(),
                primary.card_indices.len() + 1
            );
        }
    }
    let mut missing = r.clone();
    missing.rules[0]
        .action_refs
        .get_mut(&Topic::Work)
        .unwrap()
        .remove(&Intent::Crossroads);
    assert!(Interpreter::new(s.clone(), missing).is_err());
    let mut broken = r;
    broken.rules[0]
        .question_refs
        .get_mut(&Topic::Growth)
        .unwrap()
        .insert(Intent::Action, "absent".into());
    assert!(Interpreter::new(s, broken).is_err());
}

#[test]
fn fallback_keeps_the_third_orientation_and_explicit_context() {
    let (s, r) = packs();
    let engine = Interpreter::new(s.clone(), r).unwrap();
    for topic in TOPICS {
        for intent in INTENTS {
            // Original review case 4935: all reversed Fool, Hermit and Wheel.
            let mut value = input(["major.00", "major.09", "major.10"]);
            for c in &mut value.cards {
                c.orientation = Orientation::Reversed;
            }
            value.context = Context { topic, intent };
            let plan = engine.interpret(value).unwrap();
            assert!(plan.fallback);
            assert_eq!(
                plan.action.arguments,
                vec![s.meanings["major.10.reversed"].action_ref.clone()]
            );
            assert_eq!(
                plan.question.arguments,
                vec![s.meanings["major.10.reversed"].question_ref.clone()]
            );
            assert_eq!(plan.action.card_indices, vec![2]);
            assert!(plan.action.reference.starts_with("fallback."));
            assert_eq!(
                plan.positions[1].phrases[1].reference,
                s.meanings["major.09.reversed"].role_refs[&roles(intent)[1]]
            );
        }
    }
}
