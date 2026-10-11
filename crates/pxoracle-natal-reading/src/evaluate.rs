use crate::*;
use std::collections::{BTreeMap, BTreeSet};

const BODIES: [&str; 10] = [
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
];
const ASPECTS: [(&str, f64); 5] = [
    ("conjunction", 0.),
    ("sextile", 60.),
    ("square", 90.),
    ("trine", 120.),
    ("opposition", 180.),
];
type Result<T> = std::result::Result<T, String>;
fn check(ok: bool, error: &str) -> Result<()> {
    if ok {
        Ok(())
    } else {
        Err(error.into())
    }
}
fn angle(x: f64) -> bool {
    x.is_finite() && (0.0..360.0).contains(&x)
}
fn identifier(x: &str) -> bool {
    !x.is_empty()
        && x.len() <= 100
        && x.bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || b"._-".contains(&c))
}

pub fn validate_input(input: &NatalInput) -> Result<()> {
    check(
        input.versions == NatalVersions::default(),
        "unsupported natal versions",
    )?;
    check(
        input.bodies.len() == 10 && input.aspects.len() <= 225,
        "invalid fact count",
    )?;
    check(
        input
            .orbs
            .iter()
            .all(|o| o.is_finite() && (0.0..=15.0).contains(o)),
        "invalid aspect limits",
    )?;
    let sampled = input.certainty == Certainty::Sampled;
    check(
        !sampled || (input.ascendant.is_none() && input.aspects.is_empty()),
        "sampled chart has time-sensitive facts",
    )?;
    check(
        !input.polar || input.ascendant.is_none(),
        "polar chart has ascendant",
    )?;
    check(
        sampled || input.polar || input.ascendant.is_some(),
        "exact chart is missing ascendant",
    )?;
    if let Some(asc) = input.ascendant {
        check(angle(asc), "invalid ascendant")?;
    }
    for (i, body) in input.bodies.iter().enumerate() {
        check(
            body.id == BODIES[i] && angle(body.longitude) && body.speed.is_finite(),
            "invalid body",
        )?;
        check(
            !body.possible_signs.is_empty()
                && body.possible_signs.len() <= 12
                && body.possible_signs.iter().all(|s| *s < 12)
                && body.possible_signs.windows(2).all(|w| w[0] < w[1]),
            "invalid possible signs",
        )?;
        check(
            body.possible_signs
                .contains(&((body.longitude / 30.).floor() as u32)),
            "midpoint sign missing",
        )?;
        check(
            sampled || body.possible_signs.len() == 1,
            "exact chart has alternative signs",
        )?;
        let house = input.ascendant.map(|asc| {
            (((body.longitude / 30.).floor() as u32 + 12 - (asc / 30.).floor() as u32) % 12) + 1
        });
        check(
            body.house == house && (!sampled || body.house.is_none()),
            "inconsistent Whole Sign house",
        )?;
    }
    // Reconstruct the complete set from longitudes: omissions, duplicates and invented orbs fail.
    let mut expected = BTreeMap::new();
    if !sampled {
        for i in 0..10 {
            for j in i + 1..10 {
                let d = (input.bodies[i].longitude - input.bodies[j].longitude).abs();
                let separation = d.min(360. - d);
                for (k, (kind, exact)) in ASPECTS.iter().enumerate() {
                    let orb = (separation - exact).abs();
                    if orb <= input.orbs[k] {
                        expected.insert((BODIES[i], BODIES[j], *kind), orb);
                    }
                }
            }
        }
    }
    check(expected.len() == input.aspects.len(), "incomplete aspects")?;
    for a in &input.aspects {
        let expected_orb = expected
            .remove(&(a.a.as_str(), a.b.as_str(), a.kind.as_str()))
            .ok_or("invalid aspect pair")?;
        check(
            a.orb.is_finite() && (a.orb - expected_orb).abs() < 1e-7,
            "inconsistent aspect orb",
        )?;
    }
    Ok(())
}

pub fn validate_packs(semantics: &NatalSemantics, rules: &NatalRules) -> Result<()> {
    check(
        semantics.versions == NatalVersions::default() && rules.versions == semantics.versions,
        "unsupported pack versions",
    )?;
    check(
        semantics.meanings.len() <= 800
            && semantics.reference_ids.len() <= 1200
            && rules.theme_rules.len() <= 100,
        "oversized pack",
    )?;
    let refs: BTreeSet<_> = semantics.reference_ids.iter().collect();
    check(
        refs.len() == semantics.reference_ids.len() && refs.iter().all(|r| identifier(r)),
        "invalid reference ids",
    )?;
    for (id, m) in &semantics.meanings {
        check(
            identifier(id)
                && refs.contains(&m.reference)
                && !m.themes.is_empty()
                && m.themes.len() <= 8
                && m.themes.iter().all(|s| identifier(s))
                && !m.topics.is_empty()
                && m.topics.len() <= 4,
            "invalid meaning",
        )?;
    }
    for b in BODIES {
        check(
            rules.body_weights.get(b).is_some_and(|v| *v <= 200),
            "missing body weight",
        )?;
        for sign in 0..12 {
            check(
                semantics.meanings.contains_key(&format!("sign.{b}.{sign}")),
                "missing planet-sign meaning",
            )?;
        }
        for house in 1..=12 {
            check(
                semantics
                    .meanings
                    .contains_key(&format!("house.{b}.{house}")),
                "missing planet-house meaning",
            )?;
        }
    }
    for sign in 0..12 {
        check(
            semantics
                .meanings
                .contains_key(&format!("ascendant.{sign}")),
            "missing ascendant meaning",
        )?;
    }
    for i in 0..10 {
        for j in i + 1..10 {
            for (kind, _) in ASPECTS {
                let excluded = (i == 0 && j == 2 && kind != "conjunction")
                    || (i == 0 && j == 3 && !matches!(kind, "conjunction" | "sextile"))
                    || (i == 2 && j == 3 && matches!(kind, "trine" | "opposition"));
                if !excluded {
                    check(
                        semantics
                            .meanings
                            .contains_key(&format!("aspect.{}.{}.{kind}", BODIES[i], BODIES[j])),
                        "missing supported pair-aspect meaning",
                    )?;
                }
            }
        }
    }
    for (kind, _) in ASPECTS {
        check(
            rules.aspect_weights.get(kind).is_some_and(|v| *v <= 100),
            "missing aspect weight",
        )?;
    }
    for reference in [
        &rules.overview_ref,
        &rules.weak_ref,
        &rules.sampled_ref,
        &rules.polar_ref,
        &rules.no_aspects_ref,
    ]
    .into_iter()
    .chain(rules.topic_refs.values())
    {
        check(refs.contains(reference), "missing rule prose reference")?;
    }
    check(rules.topic_refs.len() == 4, "missing life topic")?;
    let mut ids = BTreeSet::new();
    for rule in &rules.theme_rules {
        check(
            identifier(&rule.id)
                && ids.insert(&rule.id)
                && identifier(&rule.left)
                && identifier(&rule.right)
                && rule.priority <= 1000
                && refs.contains(&rule.reference),
            "invalid theme rule",
        )?;
        check(
            rule.kind != ThemeRelation::Repetition || rule.left == rule.right,
            "invalid repetition rule",
        )?;
    }
    Ok(())
}

fn item(
    id: String,
    evidence: NatalEvidence,
    priority: u32,
    semantics: &NatalSemantics,
) -> Result<NatalItem> {
    let meaning = semantics
        .meanings
        .get(&id)
        .ok_or_else(|| format!("missing meaning: {id}"))?;
    Ok(NatalItem {
        scope: meaning.scope,
        fallback: meaning.fallback,
        id,
        reference: meaning.reference.clone(),
        rule_id: "placement.v1".into(),
        priority,
        evidence: vec![evidence],
    })
}
fn rank(items: &mut [NatalItem]) {
    items.sort_by(|a, b| b.priority.cmp(&a.priority).then(a.id.cmp(&b.id)));
}

/// Packs must be validated once when installed. Input is always validated per call.
pub fn evaluate(
    input: &NatalInput,
    semantics: &NatalSemantics,
    rules: &NatalRules,
) -> Result<InterpretationPlan> {
    validate_input(input)?;
    check(
        input.versions == semantics.versions && input.versions == rules.versions,
        "pack version mismatch",
    )?;
    let mut placements = Vec::new();
    let mut aspects = Vec::new();
    let mut core_ids = Vec::new();
    let mut distribution = NatalDistribution {
        exact_elements: [0; 4],
        exact_modalities: [0; 3],
        sampled_elements: [0; 4],
        sampled_modalities: [0; 3],
        ambiguous_bodies: vec![],
    };
    for body in &input.bodies {
        let weight = *rules
            .body_weights
            .get(&body.id)
            .ok_or("missing body weight")?;
        for sign in &body.possible_signs {
            let id = format!("sign.{}.{sign}", body.id);
            if body.id == "sun" || body.id == "moon" {
                core_ids.push(id.clone());
            }
            placements.push(item(
                id,
                NatalEvidence {
                    kind: EvidenceKind::Sign,
                    bodies: vec![body.id.clone()],
                    sign: Some(*sign),
                    house: None,
                    aspect: None,
                    orb: None,
                    certainty: input.certainty,
                },
                weight,
                semantics,
            )?);
        }
        if body.possible_signs.len() == 1 {
            let sign = body.possible_signs[0] as usize;
            if input.certainty == Certainty::Exact {
                distribution.exact_elements[sign % 4] += 1;
                distribution.exact_modalities[sign % 3] += 1;
            } else {
                distribution.sampled_elements[sign % 4] += 1;
                distribution.sampled_modalities[sign % 3] += 1;
            }
        } else {
            distribution.ambiguous_bodies.push(body.id.clone());
        }
        if let Some(house) = body.house {
            placements.push(item(
                format!("house.{}.{house}", body.id),
                NatalEvidence {
                    kind: EvidenceKind::House,
                    bodies: vec![body.id.clone()],
                    sign: None,
                    house: Some(house),
                    aspect: None,
                    orb: None,
                    certainty: input.certainty,
                },
                weight + 10,
                semantics,
            )?);
        }
    }
    if let Some(asc) = input.ascendant {
        let sign = (asc / 30.).floor() as u32;
        let id = format!("ascendant.{sign}");
        core_ids.push(id.clone());
        placements.push(item(
            id,
            NatalEvidence {
                kind: EvidenceKind::Ascendant,
                bodies: vec!["ascendant".into()],
                sign: Some(sign),
                house: Some(1),
                aspect: None,
                orb: None,
                certainty: input.certainty,
            },
            110,
            semantics,
        )?);
    }
    for a in &input.aspects {
        let index = ASPECTS
            .iter()
            .position(|(name, _)| *name == a.kind)
            .ok_or("unknown aspect")?;
        let tightness = if input.orbs[index] == 0. {
            100
        } else {
            ((1. - a.orb / input.orbs[index]) * 100.).round() as u32
        };
        let priority = rules.body_weights[&a.a]
            + rules.body_weights[&a.b]
            + rules.aspect_weights[&a.kind]
            + tightness;
        let mut entry = item(
            format!("aspect.{}.{}.{}", a.a, a.b, a.kind),
            NatalEvidence {
                kind: EvidenceKind::Aspect,
                bodies: vec![a.a.clone(), a.b.clone()],
                sign: None,
                house: None,
                aspect: Some(a.kind.clone()),
                // Evidence has a portable microdegree precision; calculation facts retain full precision.
                orb: Some((a.orb * 1_000_000.).round() / 1_000_000.),
                certainty: input.certainty,
            },
            priority,
            semantics,
        )?;
        entry.rule_id = "aspect-relevance.v1".into();
        aspects.push(entry);
    }
    rank(&mut aspects);
    let important_aspect_ids = aspects.iter().take(5).map(|a| a.id.clone()).collect();
    let mut themes = Vec::new();
    // Interval samples cannot establish a definitive repeated pattern.
    if input.certainty == Certainty::Exact {
        for rule in &rules.theme_rules {
            let candidates = |theme: &String| {
                placements
                    .iter()
                    .filter(|p| semantics.meanings[&p.id].themes.contains(theme))
                    .collect::<Vec<_>>()
            };
            let mut pairs = vec![];
            for a in candidates(&rule.left) {
                for b in candidates(&rule.right) {
                    if a.id != b.id && a.evidence[0].bodies != b.evidence[0].bodies {
                        pairs.push((a.priority + b.priority, a, b));
                    }
                }
            }
            pairs.sort_by(|a, b| {
                b.0.cmp(&a.0)
                    .then(a.1.id.cmp(&b.1.id))
                    .then(a.2.id.cmp(&b.2.id))
            });
            if let Some((priority, a, b)) = pairs.first() {
                themes.push(NatalItem {
                    scope: NatalScope::Personal,
                    fallback: false,
                    id: format!("theme.{}", rule.id),
                    reference: rule.reference.clone(),
                    rule_id: rule.id.clone(),
                    priority: rule.priority + priority,
                    evidence: vec![a.evidence[0].clone(), b.evidence[0].clone()],
                });
            }
        }
    }
    rank(&mut themes);
    themes.truncate(3);
    let mut overview_refs = vec![rules.overview_ref.clone()];
    if themes.is_empty() {
        overview_refs.push(rules.weak_ref.clone());
    }
    if input.certainty == Certainty::Sampled {
        overview_refs.push(rules.sampled_ref.clone());
    }
    if input.polar {
        overview_refs.push(rules.polar_ref.clone());
    }
    if aspects.is_empty() {
        overview_refs.push(rules.no_aspects_ref.clone());
    }
    let mut topics = vec![];
    for (topic, reference) in &rules.topic_refs {
        let mut eligible: Vec<_> = placements
            .iter()
            .chain(aspects.iter())
            .filter(|p| semantics.meanings[&p.id].topics.contains(topic))
            .cloned()
            .collect();
        rank(&mut eligible);
        let mut used_bodies = BTreeSet::new();
        let item_ids = eligible
            .iter()
            .filter(|p| {
                let key = p.evidence[0].bodies.join(".");
                used_bodies.insert(key)
            })
            .take(3)
            .map(|p| p.id.clone())
            .collect();
        topics.push(NatalTopicSection {
            topic: *topic,
            reference: reference.clone(),
            item_ids,
        });
    }
    Ok(InterpretationPlan {
        versions: input.versions.clone(),
        certainty: input.certainty,
        overview_refs,
        placements,
        aspects,
        core_ids,
        important_aspect_ids,
        themes,
        topics,
        distribution,
    })
}
