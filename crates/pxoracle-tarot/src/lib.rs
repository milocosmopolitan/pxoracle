//! Pure tarot state transitions. Presentation never supplies or changes a draw.
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
pub const ALGORITHM: &str = "splitmix64-fisher-yates-rejection-v1";
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Card {
    pub card_id: String,
    pub orientation: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Selection {
    pub slot: usize,
    pub position_id: String,
    pub revealed: bool,
    pub card: Card,
    pub meaning_refs: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Session {
    pub schema_version: u32,
    pub engine_version: String,
    pub algorithm: String,
    pub deck_id: String,
    pub content_version: String,
    pub spread: usize,
    pub deck: Vec<Card>,
    pub selections: Vec<Selection>,
    pub state: String,
}
pub fn standard_ids() -> Vec<String> {
    let mut ids: Vec<_> = (0..22).map(|n| format!("major.{n:02}")).collect();
    for suit in ["wands", "cups", "swords", "pentacles"] {
        for n in 1..=14 {
            ids.push(format!("{suit}.{n:02}"));
        }
    }
    ids
}
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^ (z >> 31)
    }
    fn below(&mut self, n: u64) -> u64 {
        let threshold = n.wrapping_neg() % n;
        loop {
            let x = self.next();
            if x >= threshold {
                return x % n;
            }
        }
    }
}
pub fn create(seed: [u32; 2], spread: usize, reversal_percent: u32) -> Result<Session, String> {
    if ![1, 3].contains(&spread) || reversal_percent > 100 {
        return Err("INVALID_SETTINGS".into());
    }
    let mut rng = Rng((seed[0] as u64) << 32 | seed[1] as u64);
    let mut ids = standard_ids();
    for i in (1..ids.len()).rev() {
        let j = rng.below((i + 1) as u64) as usize;
        ids.swap(i, j)
    }
    let deck = ids
        .into_iter()
        .map(|card_id| Card {
            card_id,
            orientation: if rng.below(100) < reversal_percent as u64 {
                "reversed"
            } else {
                "upright"
            }
            .into(),
        })
        .collect();
    Ok(Session {
        schema_version: 1,
        engine_version: env!("CARGO_PKG_VERSION").into(),
        algorithm: ALGORITHM.into(),
        deck_id: "pxoracle.standard.v1".into(),
        content_version: "en.v1".into(),
        spread,
        deck,
        selections: vec![],
        state: "selecting".into(),
    })
}
pub fn validate(s: &Session) -> Result<(), String> {
    if s.schema_version != 1
        || s.algorithm != ALGORITHM
        || s.deck_id != "pxoracle.standard.v1"
        || s.content_version != "en.v1"
        || s.engine_version != env!("CARGO_PKG_VERSION")
    {
        return Err("INCOMPATIBLE_SESSION".into());
    }
    let ids: HashSet<_> = s.deck.iter().map(|c| c.card_id.clone()).collect();
    let expected: HashSet<_> = standard_ids().into_iter().collect();
    if ids != expected
        || s.deck.len() != 78
        || ![1, 3].contains(&s.spread)
        || s.selections.len() > s.spread
        || s.deck
            .iter()
            .any(|c| !matches!(c.orientation.as_str(), "upright" | "reversed"))
    {
        return Err("INVALID_SESSION".into());
    }
    let mut slots = HashSet::new();
    for (i, x) in s.selections.iter().enumerate() {
        if x.slot >= 78
            || !slots.insert(x.slot)
            || x.card != s.deck[x.slot]
            || x.position_id != position(s.spread, i)
            || x.meaning_refs != refs(&x.card, &x.position_id)
        {
            return Err("INVALID_SESSION".into());
        }
    }
    let all = s.selections.len() == s.spread && s.selections.iter().all(|x| x.revealed);
    if (!all && s.state != "selecting")
        || (all && !matches!(s.state.as_str(), "reading" | "completed"))
    {
        return Err("INVALID_STATE".into());
    }
    Ok(())
}
fn position(spread: usize, i: usize) -> String {
    if spread == 1 {
        "focus"
    } else {
        ["situation", "examination", "next_action"][i]
    }
    .into()
}
fn refs(card: &Card, p: &str) -> Vec<String> {
    vec![
        format!("{}.{}.core", card.card_id, card.orientation),
        format!("position.{p}"),
    ]
}
pub fn select(s: &mut Session, slot: usize) -> Result<(), String> {
    validate(s)?;
    if slot >= 78 {
        return Err("INVALID_SLOT".into());
    }
    if s.selections.iter().any(|x| x.slot == slot) {
        return Ok(());
    }
    if s.state != "selecting" || s.selections.len() == s.spread {
        return Err("SPREAD_FULL".into());
    }
    let card = s.deck[slot].clone();
    let position_id = position(s.spread, s.selections.len());
    let meaning_refs = refs(&card, &position_id);
    s.selections.push(Selection {
        slot,
        position_id,
        revealed: false,
        card,
        meaning_refs,
    });
    Ok(())
}
pub fn reveal(s: &mut Session, index: usize) -> Result<(), String> {
    validate(s)?;
    let x = s.selections.get_mut(index).ok_or("NOT_SELECTED")?;
    x.revealed = true;
    if s.selections.len() == s.spread && s.selections.iter().all(|x| x.revealed) {
        s.state = "reading".into()
    }
    Ok(())
}
pub fn complete(s: &mut Session) -> Result<(), String> {
    validate(s)?;
    if !matches!(s.state.as_str(), "reading" | "completed") {
        return Err("INVALID_STATE".into());
    }
    s.state = "completed".into();
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reference_rng() {
        let mut r = Rng(0);
        assert_eq!(r.next(), 0xe220a8397b1dcdaf);
        assert_eq!(r.next(), 0x6e789e6aa1b965f4)
    }
    #[test]
    fn permutations() {
        for seed in 0..1000 {
            let s = create([0, seed], 3, 0).unwrap();
            validate(&s).unwrap();
            assert!(s.deck.iter().all(|c| c.orientation == "upright"));
            assert_eq!(s, create([0, seed], 3, 0).unwrap())
        }
    }
    #[test]
    fn restore_and_idempotency() {
        let mut s = create([1, 2], 3, 50).unwrap();
        assert!(reveal(&mut s, 0).is_err());
        for slot in [4, 12, 77] {
            select(&mut s, slot).unwrap();
            select(&mut s, slot).unwrap();
        }
        assert!(select(&mut s, 2).is_err());
        for i in 0..3 {
            reveal(&mut s, i).unwrap();
            reveal(&mut s, i).unwrap();
        }
        complete(&mut s).unwrap();
        let restored: Session = serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
        validate(&restored).unwrap();
        assert_eq!(s, restored);
    }
    #[test]
    fn tamper() {
        let mut s = create([0, 1], 1, 0).unwrap();
        select(&mut s, 0).unwrap();
        s.selections[0].card.card_id = "major.99".into();
        assert!(validate(&s).is_err());
    }
}
