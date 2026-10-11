use pxoracle_astrology::{chart, Input};
use pxoracle_astrology_wasm::natal_facts;
use pxoracle_natal_reading::{evaluate, validate_packs, NatalRules, NatalSemantics};
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
#[test]
fn all_214_sampled_aspect_witnesses_have_pair_specific_evaluated_content() {
    let (s, r) = packs();
    let coverage: serde_json::Value = serde_json::from_str(include_str!(
        "../../../content/astrology/natal/aspect-witnesses.json"
    ))
    .unwrap();
    for (reference, witness) in coverage["witnesses"].as_object().unwrap() {
        let utc = witness["utc"].as_str().unwrap();
        let input = Input {
            date: utc[..10].into(),
            time: Some(utc[11..16].into()),
            timezone: "UTC".into(),
            latitude: 0.,
            longitude: 0.,
            accuracy: "exact".into(),
            fold: None,
            uncertainty_minutes: None,
            orbs: [15.; 5],
        };
        let facts = natal_facts(&chart(&input).unwrap()).unwrap();
        let plan = evaluate(&facts, &s, &r).unwrap();
        let found = plan
            .aspects
            .iter()
            .find(|item| &item.reference == reference)
            .unwrap_or_else(|| panic!("missing witness {reference}"));
        assert!(!found.fallback, "{reference}");
        assert_eq!(found.evidence[0].bodies.len(), 2);
    }
}
#[test]
fn supported_sign_house_and_ascendant_refs_are_all_selectable_without_prose() {
    let (s, r) = packs();
    let input = Input {
        date: "2000-01-01".into(),
        time: Some("12:00".into()),
        timezone: "UTC".into(),
        latitude: 0.,
        longitude: 0.,
        accuracy: "exact".into(),
        fold: None,
        uncertainty_minutes: None,
        orbs: [0.; 5],
    };
    let mut facts = natal_facts(&chart(&input).unwrap()).unwrap();
    let mut refs = std::collections::BTreeSet::new();
    for sign in 0..12 {
        facts.ascendant = Some(sign as f64 * 30. + 1.);
        for body in &mut facts.bodies {
            body.house = Some(((body.longitude / 30.).floor() as u32 + 12 - sign) % 12 + 1);
        }
        for p in evaluate(&facts, &s, &r).unwrap().placements {
            refs.insert(p.reference);
        }
    }
    facts.certainty = pxoracle_natal_reading::Certainty::Sampled;
    facts.ascendant = None;
    facts.aspects.clear();
    for body in &mut facts.bodies {
        body.house = None;
        body.possible_signs = (0..12).collect();
    }
    for p in evaluate(&facts, &s, &r).unwrap().placements {
        refs.insert(p.reference);
    }
    assert_eq!(refs.len(), 252);
}
