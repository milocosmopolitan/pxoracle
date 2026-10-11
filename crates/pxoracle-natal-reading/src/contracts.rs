use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

macro_rules! domain {
    ($name:ident { $($variant:ident),+ }) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, JsonSchema)]
        #[serde(rename_all = "snake_case")]
        pub enum $name { $($variant),+ }
    }
}
domain!(NatalTopic {
    SelfEmotions,
    Communication,
    Relationships,
    ActionWorkGrowth
});
domain!(EvidenceKind {
    Sign,
    House,
    Ascendant,
    Aspect
});
domain!(Certainty { Exact, Sampled });
domain!(NatalScope {
    Personal,
    Social,
    Generational
});
domain!(ThemeRelation {
    Repetition,
    Complement,
    Tension
});

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalVersions {
    #[schemars(extend("const" = 1))]
    pub schema: u32,
    pub calculation: String,
    pub interpretation: String,
    pub semantics: String,
    pub rules: String,
    pub content: String,
}
impl Default for NatalVersions {
    fn default() -> Self {
        Self {
            schema: 1,
            calculation: "0.1.0".into(),
            interpretation: "natal.1".into(),
            semantics: "natal-semantics.1".into(),
            rules: "natal-rules.1".into(),
            content: "natal.en.1".into(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalBody {
    pub id: String,
    pub longitude: f64,
    pub speed: f64,
    #[schemars(length(min = 1, max = 12))]
    pub possible_signs: Vec<u32>,
    pub house: Option<u32>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalAspect {
    pub a: String,
    pub b: String,
    pub kind: String,
    pub orb: f64,
}
/// Extracted facts only. No date, coordinates, timezone, name, notes or hidden state.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalInput {
    pub versions: NatalVersions,
    pub certainty: Certainty,
    pub polar: bool,
    #[schemars(length(min = 10, max = 10))]
    pub bodies: Vec<NatalBody>,
    pub ascendant: Option<f64>,
    #[schemars(length(max = 225))]
    pub aspects: Vec<NatalAspect>,
    pub orbs: [f64; 5],
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalMeaning {
    pub scope: NatalScope,
    pub fallback: bool,
    pub reference: String,
    pub themes: Vec<String>,
    pub topics: Vec<NatalTopic>,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalSemantics {
    pub versions: NatalVersions,
    pub meanings: BTreeMap<String, NatalMeaning>,
    pub reference_ids: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalThemeRule {
    pub id: String,
    pub kind: ThemeRelation,
    pub left: String,
    pub right: String,
    pub priority: u32,
    pub reference: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalRules {
    pub versions: NatalVersions,
    pub body_weights: BTreeMap<String, u32>,
    pub aspect_weights: BTreeMap<String, u32>,
    pub theme_rules: Vec<NatalThemeRule>,
    pub overview_ref: String,
    pub weak_ref: String,
    pub sampled_ref: String,
    pub polar_ref: String,
    pub no_aspects_ref: String,
    pub topic_refs: BTreeMap<NatalTopic, String>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalEvidence {
    pub kind: EvidenceKind,
    pub bodies: Vec<String>,
    pub sign: Option<u32>,
    pub house: Option<u32>,
    pub aspect: Option<String>,
    pub orb: Option<f64>,
    pub certainty: Certainty,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalItem {
    pub scope: NatalScope,
    pub fallback: bool,
    pub id: String,
    pub reference: String,
    pub rule_id: String,
    pub priority: u32,
    pub evidence: Vec<NatalEvidence>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalTopicSection {
    pub topic: NatalTopic,
    pub reference: String,
    pub item_ids: Vec<String>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NatalDistribution {
    /// Exact-time placements only. Sampled alternatives never enter these counts.
    pub exact_elements: [u32; 4],
    pub exact_modalities: [u32; 3],
    /// Counts among midpoint/sampled single-sign observations, not certified bounds.
    pub sampled_elements: [u32; 4],
    pub sampled_modalities: [u32; 3],
    pub ambiguous_bodies: Vec<String>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InterpretationPlan {
    pub versions: NatalVersions,
    pub certainty: Certainty,
    pub overview_refs: Vec<String>,
    pub placements: Vec<NatalItem>,
    pub aspects: Vec<NatalItem>,
    pub core_ids: Vec<String>,
    pub important_aspect_ids: Vec<String>,
    pub themes: Vec<NatalItem>,
    pub topics: Vec<NatalTopicSection>,
    pub distribution: NatalDistribution,
}
