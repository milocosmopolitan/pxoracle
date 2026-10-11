//! Reproducible witnesses, not a proof that unsampled combinations are impossible.
use chrono::{Duration, NaiveDate, TimeZone, Utc};
use pxoracle_astrology::{delta, ASPECTS, BODIES};
use pxoracle_ephemeris::position;
use std::collections::BTreeMap;
fn main() {
    let mut date = NaiveDate::from_ymd_opt(1900, 1, 1).unwrap();
    let end = NaiveDate::from_ymd_opt(2101, 1, 1).unwrap();
    let mut witnesses: BTreeMap<String, serde_json::Value> = BTreeMap::new();
    let mut maxima: BTreeMap<String, f64> = BTreeMap::new();
    while date < end {
        let instant = Utc.from_utc_datetime(&date.and_hms_opt(12, 0, 0).unwrap());
        let days = (instant.timestamp() as f64 - 946728000.) / 86400.;
        let positions: Vec<_> = (0..10)
            .map(|b| position(b, days).unwrap().longitude)
            .collect();
        for a in 0..10 {
            for b in a + 1..10 {
                let distance = delta(positions[a], positions[b]).abs();
                let pair = format!("{}.{}", BODIES[a], BODIES[b]);
                maxima
                    .entry(pair.clone())
                    .and_modify(|v| *v = v.max(distance))
                    .or_insert(distance);
                for (angle, kind) in ASPECTS {
                    let orb = (distance - angle).abs();
                    let key = format!("aspect.{pair}.{kind}");
                    if orb <= 15.
                        && witnesses
                            .get(&key)
                            .is_none_or(|v| v["orb"].as_f64().unwrap() > orb)
                    {
                        witnesses.insert(key,serde_json::json!({"utc":instant.to_rfc3339(),"distance":distance,"orb":orb}));
                    }
                }
            }
        }
        date += Duration::days(1);
    }
    println!("{}",serde_json::to_string_pretty(&serde_json::json!({"sampling":"daily at 12:00 UTC, 1900-01-01 through 2100-12-31; witnesses only, not an exclusion proof","maximumAllowedOrb":15,"witnesses":witnesses,"sampledPairMaxima":maxima})).unwrap());
}
