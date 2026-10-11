use pxoracle_natal_reading::*;

fn packs() -> (NatalSemantics, NatalRules) {
    let s = serde_json::from_str(include_str!(
        "../../../apps/web/public/content/natal/semantics.1.json"
    ))
    .unwrap();
    let r = serde_json::from_str(include_str!(
        "../../../apps/web/public/content/natal/rules.1.json"
    ))
    .unwrap();
    validate_packs(&s, &r).unwrap();
    (s, r)
}
fn input() -> NatalInput {
    let names = [
        "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
        "pluto",
    ];
    let longitudes = [10., 43., 19., 36., 123., 185., 224., 271., 296., 334.];
    NatalInput {
        versions: NatalVersions::default(),
        certainty: Certainty::Exact,
        polar: true,
        bodies: names
            .iter()
            .zip(longitudes)
            .map(|(id, longitude)| NatalBody {
                id: id.to_string(),
                longitude,
                speed: 0.1,
                possible_signs: vec![(longitude / 30.) as u32],
                house: None,
            })
            .collect(),
        ascendant: None,
        aspects: vec![],
        orbs: [0.; 5],
    }
}
#[test]
fn packs_cover_all_supported_references_and_reject_missing_content() {
    let (mut s, r) = packs();
    assert_eq!(s.meanings.len(), 468);
    s.meanings.remove("aspect.sun.moon.square");
    assert!(validate_packs(&s, &r).is_err());
}
#[test]
fn deterministic_plan_and_fact_order_are_explicit() {
    let (s, r) = packs();
    let i = input();
    let a = evaluate(&i, &s, &r).unwrap();
    let b = evaluate(&i, &s, &r).unwrap();
    assert_eq!(a, b);
    assert_eq!(a.placements.len(), 10);
    assert_eq!(a.core_ids.len(), 2);
    assert_eq!(a.distribution.exact_elements.iter().sum::<u32>(), 10);
    assert!(a.overview_refs.contains(&"overview.polar".into()));
    assert!(a.overview_refs.contains(&"overview.no-aspects".into()));
    assert_eq!(a.topics.len(), 4);
    let mut bad = i.clone();
    bad.bodies.swap(0, 1);
    assert!(evaluate(&bad, &s, &r).is_err());
    let mut bad = i.clone();
    bad.bodies[0].possible_signs = vec![1];
    assert!(evaluate(&bad, &s, &r).is_err());
    let mut bad = i.clone();
    bad.versions.content = "future".into();
    assert!(evaluate(&bad, &s, &r).is_err());
}
#[test]
fn sampled_alternatives_remain_conditional_and_never_enter_exact_counts() {
    let (s, r) = packs();
    let mut i = input();
    i.certainty = Certainty::Sampled;
    i.bodies[1].possible_signs = vec![1, 2];
    let p = evaluate(&i, &s, &r).unwrap();
    assert!(p.themes.is_empty());
    assert_eq!(p.distribution.exact_elements, [0; 4]);
    assert_eq!(p.distribution.sampled_elements.iter().sum::<u32>(), 9);
    assert_eq!(p.distribution.ambiguous_bodies, vec!["moon"]);
    assert!(p
        .placements
        .iter()
        .all(|p| p.evidence[0].certainty == Certainty::Sampled));
    i.aspects.push(NatalAspect {
        a: "sun".into(),
        b: "moon".into(),
        kind: "square".into(),
        orb: 0.,
    });
    assert!(evaluate(&i, &s, &r).is_err());
}
#[test]
fn house_and_ascendant_meanings_follow_actual_whole_sign_mapping() {
    let (s, r) = packs();
    let mut i = input();
    i.polar = false;
    i.ascendant = Some(35.);
    for b in &mut i.bodies {
        b.house = Some(((b.longitude / 30.).floor() as u32 + 11) % 12 + 1);
    }
    let p = evaluate(&i, &s, &r).unwrap();
    assert!(p.core_ids.contains(&"ascendant.1".into()));
    assert!(p.placements.iter().any(|p| p.id == "house.sun.12"));
    i.bodies[0].house = Some(1);
    assert!(evaluate(&i, &s, &r).is_err());
}
#[test]
fn theme_evidence_requires_distinct_bodies_and_weak_relationships_are_not_invented() {
    let (mut s, mut r) = packs();
    let i = input();
    r.theme_rules.retain(|r| r.id == "repeat-care.v1");
    for m in s.meanings.values_mut() {
        m.themes = vec!["unmatched".into()];
    }
    s.meanings.get_mut("sign.sun.0").unwrap().themes = vec!["care".into()];
    let p = evaluate(&i, &s, &r).unwrap();
    assert!(p.themes.is_empty());
    assert!(p.overview_refs.contains(&"overview.no-pattern".into()));
    s.meanings.get_mut("sign.moon.1").unwrap().themes = vec!["care".into()];
    let p = evaluate(&i, &s, &r).unwrap();
    assert_eq!(p.themes.len(), 1);
    assert_eq!(p.themes[0].evidence.len(), 2);
    assert_ne!(
        p.themes[0].evidence[0].bodies,
        p.themes[0].evidence[1].bodies
    );
}
#[test]
fn every_relation_kind_selects_traceable_stable_evidence() {
    let (mut s, mut r) = packs();
    let i = input();
    for m in s.meanings.values_mut() {
        m.themes = vec!["unmatched".into()];
    }
    for id in ["care-structure.v1", "independence-reciprocity.v1"] {
        let rule = r.theme_rules.iter().find(|r| r.id == id).unwrap().clone();
        s.meanings.get_mut("sign.sun.0").unwrap().themes = vec![rule.left.clone()];
        s.meanings.get_mut("sign.moon.1").unwrap().themes = vec![rule.right.clone()];
        let original = r.theme_rules.clone();
        r.theme_rules = vec![rule];
        let p = evaluate(&i, &s, &r).unwrap();
        assert_eq!(p.themes[0].rule_id, id);
        assert_eq!(p.themes[0].evidence.len(), 2);
        r.theme_rules = original;
    }
}

#[test]
fn aspect_order_orb_boundaries_and_editorial_ties_are_stable() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../tests/fixtures/natal.json")).unwrap();
    let mut i: NatalInput = serde_json::from_value(fixtures[0]["facts"].clone()).unwrap();
    let (s, r) = packs();
    let original = evaluate(&i, &s, &r).unwrap();
    i.aspects.reverse();
    assert_eq!(original, evaluate(&i, &s, &r).unwrap());
    let pair = i
        .aspects
        .iter()
        .find(|a| a.a == "sun" && a.b == "saturn")
        .unwrap()
        .clone();
    i.orbs[3] = pair.orb;
    i.aspects.retain(|a| a.kind != "trine" || a.orb <= pair.orb);
    let edge = evaluate(&i, &s, &r).unwrap();
    assert!(edge
        .aspects
        .iter()
        .any(|a| a.id == "aspect.sun.saturn.trine"));
    i.orbs[3] = pair.orb - 1e-6;
    i.aspects
        .retain(|a| a.kind != "trine" || a.orb <= i.orbs[3]);
    let outside = evaluate(&i, &s, &r).unwrap();
    assert!(!outside
        .aspects
        .iter()
        .any(|a| a.id == "aspect.sun.saturn.trine"));
    let close = original
        .aspects
        .iter()
        .find(|a| a.id == "aspect.sun.saturn.trine")
        .unwrap();
    let wide = edge.aspects.iter().find(|a| a.id == close.id).unwrap();
    assert!(close.priority > wide.priority);
    // The wire uses canonical engine body order, never duplicate directional pairs.
    let a = &mut i.aspects[0];
    std::mem::swap(&mut a.a, &mut a.b);
    assert!(evaluate(&i, &s, &r).is_err());
}
