//! Pure, bounded interpretation of external symbols. No draw state or localized sentences.
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
macro_rules! domain {
    ($name:ident { $($v:ident),+ }) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, JsonSchema)]
        #[serde(rename_all="snake_case")]
        pub enum $name { $($v),+ }
    }
}
domain!(Topic {
    Relationships,
    Work,
    Creativity,
    Growth
});
domain!(Intent {
    Present,
    Crossroads,
    Action
});
domain!(Orientation { Upright, Reversed });
domain!(Position {
    Situation,
    Examination,
    NextAction
});
domain!(Role {
    Visible,
    Examination,
    Direction,
    Values,
    Conditions,
    Checks,
    Foundation,
    Difficulty,
    SmallAction
});
domain!(Theme {
    Expansion,
    Boundaries,
    Connection,
    Solitude,
    Clarity,
    Uncertainty,
    Change,
    Stability,
    Effort,
    Rest,
    Care,
    Release
});
domain!(Lens {
    Direct,
    Inward,
    Blockage,
    Excess,
    Review,
    Restoration
});
domain!(RelationKind {
    Repetition,
    Complement,
    Tension
});
pub const TOPICS: [Topic; 4] = [
    Topic::Relationships,
    Topic::Work,
    Topic::Creativity,
    Topic::Growth,
];
pub const ROLES: [Role; 9] = [
    Role::Visible,
    Role::Examination,
    Role::Direction,
    Role::Values,
    Role::Conditions,
    Role::Checks,
    Role::Foundation,
    Role::Difficulty,
    Role::SmallAction,
];
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Versions {
    #[schemars(extend("const" = 1))]
    pub schema: u32,
    #[schemars(extend("const" = "reading.1"))]
    pub engine: String,
    #[schemars(extend("const" = "semantics.1"))]
    pub semantics: String,
    #[schemars(extend("const" = "rules.1"))]
    pub rules: String,
    #[schemars(extend("const" = "reading.en.1"))]
    pub content: String,
}
impl Default for Versions {
    fn default() -> Self {
        Self {
            schema: 1,
            engine: "reading.1".into(),
            semantics: "semantics.1".into(),
            rules: "rules.1".into(),
            content: "reading.en.1".into(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Context {
    pub topic: Topic,
    pub intent: Intent,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RevealedCard {
    #[schemars(extend("pattern" = "^(major\\.(0[0-9]|1[0-9]|2[01])|(wands|cups|swords|pentacles)\\.(0[1-9]|1[0-4]))$"))]
    pub card_id: String,
    pub orientation: Orientation,
    pub position_id: Position,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadingInput {
    pub versions: Versions,
    pub context: Context,
    #[schemars(length(min = 3, max = 3))]
    pub cards: Vec<RevealedCard>,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Meaning {
    pub themes: Vec<Theme>,
    pub lens: Lens,
    pub core_ref: String,
    pub resource_ref: String,
    pub difficulty_ref: String,
    pub topic_refs: BTreeMap<Topic, String>,
    pub role_refs: BTreeMap<Role, String>,
    pub action_ref: String,
    pub question_ref: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticPack {
    pub versions: Versions,
    pub meanings: BTreeMap<String, Meaning>,
    pub reference_ids: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Rule {
    pub id: String,
    pub kind: RelationKind,
    pub left: Theme,
    pub right: Theme,
    pub priority: u8,
    pub relation_ref: String,
    pub action_refs: BTreeMap<Topic, String>,
    pub question_refs: BTreeMap<Topic, String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RulePack {
    pub versions: Versions,
    pub rules: Vec<Rule>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Phrase {
    pub reference: String,
    pub arguments: Vec<String>,
    pub card_indices: Vec<usize>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PositionPlan {
    pub index: usize,
    pub role: Role,
    pub lens: Lens,
    pub phrases: Vec<Phrase>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Evidence {
    pub rule_id: String,
    pub kind: RelationKind,
    pub card_indices: Vec<usize>,
    pub phrase: Phrase,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadingPlan {
    pub versions: Versions,
    pub context: Context,
    pub cards: Vec<RevealedCard>,
    pub positions: Vec<PositionPlan>,
    pub overall: Vec<Phrase>,
    pub relations: Vec<Evidence>,
    pub action: Phrase,
    pub question: Phrase,
    pub fallback: bool,
}
pub fn card_ids() -> Vec<String> {
    let mut ids: Vec<_> = (0..22).map(|i| format!("major.{i:02}")).collect();
    for suit in ["wands", "cups", "swords", "pentacles"] {
        for i in 1..=14 {
            ids.push(format!("{suit}.{i:02}"));
        }
    }
    ids
}
pub fn roles(intent: Intent) -> [Role; 3] {
    match intent {
        Intent::Present => [Role::Visible, Role::Examination, Role::Direction],
        Intent::Crossroads => [Role::Values, Role::Conditions, Role::Checks],
        Intent::Action => [Role::Foundation, Role::Difficulty, Role::SmallAction],
    }
}
fn phrase(reference: &str, arguments: Vec<String>, card_indices: Vec<usize>) -> Phrase {
    Phrase {
        reference: reference.into(),
        arguments,
        card_indices,
    }
}
fn key(card: &RevealedCard) -> String {
    format!(
        "{}.{}",
        card.card_id,
        if card.orientation == Orientation::Upright {
            "upright"
        } else {
            "reversed"
        }
    )
}
fn valid_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 96
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"._-".contains(&b))
}
/// Packs are validated once when installed, then borrowed for bounded evaluations.
pub struct Interpreter {
    semantics: SemanticPack,
    rules: RulePack,
}
impl Interpreter {
    pub fn new(semantics: SemanticPack, rules: RulePack) -> Result<Self, String> {
        if semantics.versions != Versions::default() || rules.versions != semantics.versions {
            return Err("READING_VERSION".into());
        }
        let expected: BTreeSet<_> = card_ids()
            .iter()
            .flat_map(|id| [format!("{id}.upright"), format!("{id}.reversed")])
            .collect();
        if semantics.meanings.keys().cloned().collect::<BTreeSet<_>>() != expected
            || semantics.reference_ids.len() > 6000
            || rules.rules.len() > 64
        {
            return Err("READING_PACK".into());
        }
        let refs: BTreeSet<_> = semantics.reference_ids.iter().collect();
        if refs.len() != semantics.reference_ids.len() || refs.iter().any(|s| !valid_id(s)) {
            return Err("READING_PACK".into());
        }
        let check = |r: &String| refs.contains(r);
        for (id, m) in &semantics.meanings {
            if m.themes.is_empty()
                || m.themes.len() > 3
                || m.themes.iter().collect::<BTreeSet<_>>().len() != m.themes.len()
                || (id.ends_with("upright") != (m.lens == Lens::Direct))
                || m.topic_refs.len() != 4
                || m.role_refs.len() != 9
                || !TOPICS.iter().all(|t| m.topic_refs.contains_key(t))
                || !ROLES.iter().all(|r| m.role_refs.contains_key(r))
                || [
                    &m.core_ref,
                    &m.resource_ref,
                    &m.difficulty_ref,
                    &m.action_ref,
                    &m.question_ref,
                ]
                .iter()
                .any(|r| !check(r))
                || m.topic_refs
                    .values()
                    .chain(m.role_refs.values())
                    .any(|r| !check(r))
            {
                return Err("READING_PACK".into());
            }
        }
        let mut ids = BTreeSet::new();
        for r in &rules.rules {
            if !valid_id(&r.id)
                || !ids.insert(&r.id)
                || r.priority > 100
                || !check(&r.relation_ref)
                || (r.kind == RelationKind::Repetition && r.left != r.right)
                || (r.kind != RelationKind::Repetition && r.left == r.right)
                || r.action_refs.len() != 4
                || r.question_refs.len() != 4
                || !TOPICS
                    .iter()
                    .all(|t| r.action_refs.contains_key(t) && r.question_refs.contains_key(t))
                || r.action_refs
                    .values()
                    .chain(r.question_refs.values())
                    .any(|s| !check(s))
            {
                return Err("READING_PACK".into());
            }
        }
        for intent in ["present", "crossroads", "action"] {
            for part in ["opening", "first", "second", "third", "fallback"] {
                if !check(&format!("flow.{intent}.{part}")) {
                    return Err("READING_PACK".into());
                }
            }
        }
        Ok(Self { semantics, rules })
    }
    pub fn interpret(&self, input: ReadingInput) -> Result<ReadingPlan, String> {
        if input.versions != self.semantics.versions {
            return Err("READING_VERSION".into());
        }
        let positions = [
            Position::Situation,
            Position::Examination,
            Position::NextAction,
        ];
        if input.cards.len() != 3
            || input
                .cards
                .iter()
                .map(|c| &c.card_id)
                .collect::<BTreeSet<_>>()
                .len()
                != 3
            || input
                .cards
                .iter()
                .zip(positions)
                .any(|(c, p)| c.position_id != p || !self.semantics.meanings.contains_key(&key(c)))
        {
            return Err("READING_INPUT".into());
        }
        let m: Vec<_> = input
            .cards
            .iter()
            .map(|c| &self.semantics.meanings[&key(c)])
            .collect();
        let mapped = roles(input.context.intent);
        let topic = input.context.topic;
        let mut candidates = Vec::new();
        for rule in &self.rules.rules {
            let mut participants = BTreeSet::new();
            for i in 0..3 {
                for j in i + 1..3 {
                    let forward =
                        m[i].themes.contains(&rule.left) && m[j].themes.contains(&rule.right);
                    let backward = rule.kind != RelationKind::Complement
                        && m[j].themes.contains(&rule.left)
                        && m[i].themes.contains(&rule.right);
                    if forward || backward {
                        participants.insert(i);
                        participants.insert(j);
                    }
                }
            }
            if participants.len() >= 2 {
                candidates.push((rule, participants.into_iter().collect::<Vec<_>>()));
            }
        }
        candidates.sort_by(|(a, ai), (b, bi)| {
            b.priority
                .cmp(&a.priority)
                .then(a.id.cmp(&b.id))
                .then(ai.cmp(bi))
        });
        // One primary relation aligns the conclusion, action and question. A second can be explanatory only.
        let mut descriptions = BTreeSet::new();
        candidates.retain(|(rule, _)| descriptions.insert(&rule.relation_ref));
        candidates.truncate(2);
        let relations: Vec<_> = candidates
            .iter()
            .map(|(r, indices)| Evidence {
                rule_id: r.id.clone(),
                kind: r.kind,
                card_indices: indices.clone(),
                phrase: phrase(&r.relation_ref, vec![], indices.clone()),
            })
            .collect();
        let (action, question) = if let Some((r, indices)) = candidates.first() {
            (
                phrase(&r.action_refs[&topic], vec![], indices.clone()),
                phrase(&r.question_refs[&topic], vec![], indices.clone()),
            )
        } else {
            (
                phrase(&m[2].action_ref, vec![], vec![2]),
                phrase(&m[2].question_ref, vec![], vec![2]),
            )
        };
        let intent = match input.context.intent {
            Intent::Present => "present",
            Intent::Crossroads => "crossroads",
            Intent::Action => "action",
        };
        let flow = |part: &str, args: Vec<String>, indices| {
            phrase(&format!("flow.{intent}.{part}"), args, indices)
        };
        let mut overall = vec![
            flow("opening", vec![m[0].topic_refs[&topic].clone()], vec![0]),
            flow("first", vec![m[0].resource_ref.clone()], vec![0]),
            flow("second", vec![m[1].difficulty_ref.clone()], vec![1]),
            flow("third", vec![m[2].role_refs[&mapped[2]].clone()], vec![2]),
        ];
        overall.push(
            relations
                .first()
                .map(|r| r.phrase.clone())
                .unwrap_or_else(|| flow("fallback", vec![], vec![0, 1, 2])),
        );
        let positions = m
            .iter()
            .enumerate()
            .map(|(index, m)| PositionPlan {
                index,
                role: mapped[index],
                lens: m.lens,
                phrases: vec![
                    phrase(&m.core_ref, vec![], vec![index]),
                    phrase(&m.role_refs[&mapped[index]], vec![], vec![index]),
                    phrase(&m.topic_refs[&topic], vec![], vec![index]),
                ],
            })
            .collect();
        Ok(ReadingPlan {
            versions: input.versions,
            context: input.context,
            cards: input.cards,
            positions,
            overall,
            relations,
            action,
            question,
            fallback: candidates.is_empty(),
        })
    }
}
