//! Canonical case space for the offline exhaustive three-card export.
//!
//! `case_id = ordered_triple_rank * 8 + orientation_mask` (0-based, no context dimension).
//! Ordered triples of distinct deck indices are ranked lexicographically by
//! `(a, b', c')`, where `b'`/`c'` are the 0-based ranks of the 2nd/3rd card among the
//! cards not yet used. Orientation bit `i` (value `1 << i`) is set when the card in
//! position `i` (0 = situation, 1 = examination, 2 = next action) is reversed.
use crate::{card_ids, Context, Intent, Orientation, Position, ReadingInput, RevealedCard, Topic, Versions};

pub const CASE_ENUMERATION: &str = "ordered-distinct-triples.lex.v1";
pub const FULL_DECK: usize = 78;
pub const TOPIC_ORDER: [(Topic, &str); 4] = [
    (Topic::Relationships, "relationships"),
    (Topic::Work, "work"),
    (Topic::Creativity, "creativity"),
    (Topic::Growth, "growth"),
];
pub const INTENT_ORDER: [(Intent, &str); 3] = [
    (Intent::Present, "present"),
    (Intent::Crossroads, "crossroads"),
    (Intent::Action, "action"),
];

/// Contexts in canonical file order: topic-major, intent-minor.
pub fn contexts() -> Vec<(Context, String)> {
    let mut out = Vec::new();
    for (topic, t) in TOPIC_ORDER {
        for (intent, i) in INTENT_ORDER {
            out.push((Context { topic, intent }, format!("{t}-{i}")));
        }
    }
    out
}

/// Enumerates the first `deck_size` cards in canonical deck order. Only the full 78-card deck
/// is a release export; smaller decks exist for tiny exhaustive tests.
#[derive(Clone, Debug)]
pub struct CaseSpace {
    deck: Vec<String>,
}
impl CaseSpace {
    pub fn new(deck_size: usize) -> Result<Self, String> {
        if !(3..=FULL_DECK).contains(&deck_size) {
            return Err("EXPORT_DECK_SIZE".into());
        }
        Ok(Self { deck: card_ids().into_iter().take(deck_size).collect() })
    }
    pub fn deck(&self) -> &[String] {
        &self.deck
    }
    pub fn len(&self) -> u64 {
        let n = self.deck.len() as u64;
        n * (n - 1) * (n - 2) * 8
    }
    pub fn is_empty(&self) -> bool {
        false
    }
    /// `(deck index, reversed)` for positions 1..3.
    pub fn decode(&self, case_id: u64) -> Result<[(usize, bool); 3], String> {
        if case_id >= self.len() {
            return Err("EXPORT_CASE_RANGE".into());
        }
        let n = self.deck.len() as u64;
        let (rank, mask) = (case_id / 8, case_id % 8);
        let a = rank / ((n - 1) * (n - 2));
        let rest = rank % ((n - 1) * (n - 2));
        let (bq, cq) = (rest / (n - 2), rest % (n - 2));
        let b = bq + u64::from(bq >= a);
        let (lo, hi) = if a < b { (a, b) } else { (b, a) };
        let mut c = cq;
        if c >= lo {
            c += 1;
        }
        if c >= hi {
            c += 1;
        }
        Ok([
            (a as usize, mask & 1 != 0),
            (b as usize, mask & 2 != 0),
            (c as usize, mask & 4 != 0),
        ])
    }
    pub fn encode(&self, cards: [(usize, bool); 3]) -> Result<u64, String> {
        let n = self.deck.len() as u64;
        let [(a, ra), (b, rb), (c, rc)] = cards.map(|(i, r)| (i as u64, r));
        if a >= n || b >= n || c >= n || a == b || a == c || b == c {
            return Err("EXPORT_CASE_INPUT".into());
        }
        let bq = b - u64::from(b > a);
        let cq = c - u64::from(c > a) - u64::from(c > b);
        let mask = u64::from(ra) | u64::from(rb) << 1 | u64::from(rc) << 2;
        Ok(((a * (n - 1) + bq) * (n - 2) + cq) * 8 + mask)
    }
    pub fn input(&self, case_id: u64, context: &Context, versions: &Versions) -> Result<ReadingInput, String> {
        let cards = self.decode(case_id)?;
        let positions = [Position::Situation, Position::Examination, Position::NextAction];
        Ok(ReadingInput {
            versions: versions.clone(),
            context: context.clone(),
            cards: cards
                .iter()
                .zip(positions)
                .map(|(&(i, reversed), position_id)| RevealedCard {
                    card_id: self.deck[i].clone(),
                    orientation: if reversed { Orientation::Reversed } else { Orientation::Upright },
                    position_id,
                })
                .collect(),
        })
    }
}
