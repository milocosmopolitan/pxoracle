//! Natal chart calculations. Historical local times use embedded chrono-tz data.
use chrono::{Datelike, Duration, LocalResult, NaiveDate, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use pxoracle_ephemeris::{position, BACKEND_VERSION};
use serde::{Deserialize, Serialize};
pub const BODIES: [&str; 10] = [
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
];
#[derive(Clone, Debug, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    pub date: String,
    pub time: Option<String>,
    pub timezone: String,
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: String,
    pub fold: Option<String>,
    pub uncertainty_minutes: Option<u32>,
    #[serde(default = "default_orbs")]
    pub orbs: [f64; 5],
}
fn default_orbs() -> [f64; 5] {
    [8., 4., 6., 6., 8.]
}
#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Body {
    pub id: String,
    pub longitude: f64,
    pub latitude: f64,
    pub speed: f64,
    pub sign: u32,
    pub degree: f64,
    pub possible_signs: Vec<u32>,
    pub house: Option<u32>,
    pub meaning_ref: String,
}
#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Aspect {
    pub a: String,
    pub b: String,
    pub kind: String,
    pub angle: f64,
    pub orb: f64,
    pub meaning_ref: String,
}
#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Angles {
    pub asc: f64,
    pub mc: f64,
}
#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Chart {
    pub schema_version: u32,
    pub engine_version: String,
    pub bodies: Vec<Body>,
    pub angles: Option<Angles>,
    pub houses: Option<Vec<f64>>,
    pub aspects: Vec<Aspect>,
    pub interval: Vec<String>,
    pub warnings: Vec<String>,
    pub provenance: serde_json::Value,
}
pub fn norm(x: f64) -> f64 {
    x.rem_euclid(360.)
}
pub fn delta(a: f64, b: f64) -> f64 {
    (a - b + 180.).rem_euclid(360.) - 180.
}
fn local(tz: Tz, dt: NaiveDateTime, fold: Option<&str>) -> Result<chrono::DateTime<Utc>, String> {
    match tz.from_local_datetime(&dt) {
        LocalResult::Single(x) => Ok(x.with_timezone(&Utc)),
        LocalResult::None => Err("NONEXISTENT_LOCAL_TIME".into()),
        LocalResult::Ambiguous(a, b) => match fold {
            Some("earlier") => Ok(a.min(b).with_timezone(&Utc)),
            Some("later") => Ok(a.max(b).with_timezone(&Utc)),
            _ => Err("AMBIGUOUS_LOCAL_TIME".into()),
        },
    }
}
pub fn resolve(i: &Input) -> Result<(chrono::DateTime<Utc>, chrono::DateTime<Utc>), String> {
    if !i.latitude.is_finite()
        || !i.longitude.is_finite()
        || i.latitude.abs() > 90.
        || i.longitude.abs() > 180.
        || i.orbs.iter().any(|x| !x.is_finite() || *x < 0. || *x > 15.)
    {
        return Err("INVALID_COORDINATES_OR_ORBS".into());
    }
    if i.fold
        .as_deref()
        .is_some_and(|x| x != "earlier" && x != "later")
    {
        return Err("INVALID_FOLD".into());
    }
    let date = NaiveDate::parse_from_str(&i.date, "%Y-%m-%d").map_err(|_| "INVALID_DATE")?;
    if !(1900..=2100).contains(&date.year()) {
        return Err("UNSUPPORTED_DATE".into());
    }
    let tz: Tz = i.timezone.parse().map_err(|_| "INVALID_TIMEZONE")?;
    if i.accuracy == "unknown" {
        let start = local(tz, date.and_hms_opt(0, 0, 0).unwrap(), Some("earlier"))?;
        let end = local(
            tz,
            date.succ_opt().unwrap().and_hms_opt(0, 0, 0).unwrap(),
            Some("earlier"),
        )?;
        return Ok((start, end));
    }
    if !matches!(i.accuracy.as_str(), "exact" | "approximate") {
        return Err("INVALID_ACCURACY".into());
    }
    let dt = NaiveDateTime::parse_from_str(
        &format!("{} {}", i.date, i.time.as_deref().ok_or("TIME_REQUIRED")?),
        "%Y-%m-%d %H:%M",
    )
    .map_err(|_| "INVALID_TIME")?;
    let instant = local(tz, dt, i.fold.as_deref())?;
    if i.accuracy == "approximate" {
        let m = i.uncertainty_minutes.ok_or("UNCERTAINTY_REQUIRED")?;
        if m == 0 || m > 720 {
            return Err("INVALID_UNCERTAINTY".into());
        }
        Ok((
            instant - Duration::minutes(m as i64),
            instant + Duration::minutes(m as i64),
        ))
    } else {
        Ok((instant, instant))
    }
}
fn days(t: chrono::DateTime<Utc>) -> f64 {
    (t.timestamp() as f64 - 946728000.) / 86400.
}
pub fn chart(i: &Input) -> Result<Chart, String> {
    let (start, end) = resolve(i)?;
    let uncertain = start != end;
    let representative = start + (end - start) / 2;
    let ut = days(representative);
    let sun = position(0, ut)?;
    let mut warnings = vec![];
    let angles = if uncertain {
        warnings.push("TIME_INTERVAL: representative positions are midpoint samples; ASC, houses and aspects omitted".into());
        None
    } else if i.latitude.abs() >= 66. {
        warnings.push("POLAR_ANGLES_UNSUPPORTED: ASC and houses omitted".into());
        None
    } else {
        let theta = (sun.sidereal_hours * 15. + i.longitude).to_radians();
        let e = sun.obliquity;
        let asc = norm(
            (-theta.cos())
                .atan2(theta.sin() * e.cos() + i.latitude.to_radians().tan() * e.sin())
                .to_degrees()
                + 180.,
        );
        let mc = norm(theta.sin().atan2(theta.cos() * e.cos()).to_degrees());
        Some(Angles { asc, mc })
    };
    let houses = angles.as_ref().map(|a| {
        (0..12)
            .map(|n| norm((a.asc / 30.).floor() * 30. + n as f64 * 30.))
            .collect::<Vec<_>>()
    });
    let mut bodies = vec![];
    for (id, name) in BODIES.iter().enumerate() {
        let p = position(id, ut)?;
        let before = position(id, ut - 0.005)?;
        let after = position(id, ut + 0.005)?;
        let sign = (p.longitude / 30.).floor() as u32;
        let mut possible_signs = vec![sign];
        if uncertain {
            let steps = ((end - start).num_seconds() as f64 / 900.).ceil() as usize;
            for n in 0..=steps {
                let sample = days(start) + (days(end) - days(start)) * n as f64 / steps as f64;
                let s = (position(id, sample)?.longitude / 30.).floor() as u32;
                if !possible_signs.contains(&s) {
                    possible_signs.push(s)
                }
            }
            possible_signs.sort();
        }
        bodies.push(Body {
            id: name.to_string(),
            longitude: p.longitude,
            latitude: p.latitude,
            speed: delta(after.longitude, before.longitude) / 0.01,
            sign,
            degree: p.longitude % 30.,
            possible_signs,
            house: houses
                .as_ref()
                .map(|h| (norm(p.longitude - h[0]) / 30.).floor() as u32 + 1),
            meaning_ref: format!("body.{name}"),
        });
    }
    let mut aspects = vec![];
    if !uncertain {
        for a in 0..10 {
            for b in a + 1..10 {
                let distance = delta(bodies[a].longitude, bodies[b].longitude).abs();
                for (n, (angle, kind)) in [
                    (0., "conjunction"),
                    (60., "sextile"),
                    (90., "square"),
                    (120., "trine"),
                    (180., "opposition"),
                ]
                .iter()
                .enumerate()
                {
                    let orb = (distance - angle).abs();
                    if orb <= i.orbs[n] {
                        aspects.push(Aspect {
                            a: BODIES[a].into(),
                            b: BODIES[b].into(),
                            kind: kind.to_string(),
                            angle: *angle,
                            orb,
                            meaning_ref: format!("aspect.{kind}"),
                        });
                    }
                }
            }
        }
    }
    warnings.push("UTC approximates UT1; no Earth-orientation DUT1 correction".into());
    if uncertain {
        warnings.push("Possible signs sampled every <=15 minutes; boundary extrema between samples are not certified".into());
    }
    Ok(Chart {
        schema_version: 1,
        engine_version: env!("CARGO_PKG_VERSION").into(),
        bodies,
        angles,
        houses,
        aspects,
        interval: vec![start.to_rfc3339(), end.to_rfc3339()],
        warnings,
        provenance: serde_json::json!({"backend":BACKEND_VERSION,"frame":"apparent geocentric true ecliptic/equinox of date","zodiac":"tropical","houses":"whole-sign","deltaT":"Espenak-Meeus backend default","utPolicy":"UTC-as-UT1","ttDays":sun.tt_days,"speed":"central difference +/-0.005 days","timezoneDatabase":chrono_tz::IANA_TZDB_VERSION,"settings":i,"uncertaintyPolicy":"midpoint with 15-minute sampled signs; no interval angles/aspects"}),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    fn input() -> Input {
        Input {
            date: "2000-01-01".into(),
            time: Some("12:00".into()),
            timezone: "UTC".into(),
            latitude: 0.,
            longitude: 0.,
            accuracy: "exact".into(),
            fold: None,
            uncertainty_minutes: None,
            orbs: default_orbs(),
        }
    }
    #[test]
    fn wraps() {
        assert_eq!(delta(1., 359.), 2.);
        assert_eq!(norm(-1.), 359.);
    }
    #[test]
    fn natal() {
        let c = chart(&input()).unwrap();
        assert_eq!(c.bodies.len(), 10);
        assert!((c.bodies[0].longitude - 280.37).abs() < 0.02);
        assert!(c
            .bodies
            .iter()
            .all(|b| (1..=12).contains(&b.house.unwrap())));
        assert!((c.angles.unwrap().asc - 11.37).abs() < 0.3);
    }
    #[test]
    fn dst() {
        let mut i = input();
        i.timezone = "America/New_York".into();
        i.date = "2024-03-10".into();
        i.time = Some("02:30".into());
        assert_eq!(resolve(&i).unwrap_err(), "NONEXISTENT_LOCAL_TIME");
        i.date = "2024-11-03".into();
        i.time = Some("01:30".into());
        assert_eq!(resolve(&i).unwrap_err(), "AMBIGUOUS_LOCAL_TIME");
        i.fold = Some("earlier".into());
        let a = resolve(&i).unwrap().0;
        i.fold = Some("later".into());
        assert_eq!((resolve(&i).unwrap().0 - a).num_hours(), 1);
        i.accuracy = "unknown".into();
        assert_eq!(
            (resolve(&i).unwrap().1 - resolve(&i).unwrap().0).num_hours(),
            25
        );
        i.date = "2024-03-10".into();
        assert_eq!(
            (resolve(&i).unwrap().1 - resolve(&i).unwrap().0).num_hours(),
            23
        );
    }
    #[test]
    fn unknown() {
        let mut i = input();
        i.accuracy = "unknown".into();
        let c = chart(&i).unwrap();
        assert!(c.angles.is_none() && c.houses.is_none() && c.aspects.is_empty());
    }
    #[test]
    fn historical() {
        let mut i = input();
        i.date = "1950-01-01".into();
        i.timezone = "Asia/Seoul".into();
        assert_eq!(resolve(&i).unwrap().0.hour(), 3);
    }
    use chrono::Timelike;
}
