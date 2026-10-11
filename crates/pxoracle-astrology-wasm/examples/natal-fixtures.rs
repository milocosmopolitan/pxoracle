use pxoracle_astrology::{chart, Input};
use pxoracle_astrology_wasm::natal_facts;
use pxoracle_natal_reading::{evaluate, validate_packs, NatalRules, NatalSemantics};
fn main() {
    let semantics: NatalSemantics = serde_json::from_str(
        &std::fs::read_to_string("apps/web/public/content/natal/semantics.1.json").unwrap(),
    )
    .unwrap();
    let rules: NatalRules = serde_json::from_str(
        &std::fs::read_to_string("apps/web/public/content/natal/rules.1.json").unwrap(),
    )
    .unwrap();
    validate_packs(&semantics, &rules).unwrap();
    let base = Input {
        date: "2000-01-01".into(),
        time: Some("12:00".into()),
        timezone: "UTC".into(),
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: "exact".into(),
        fold: None,
        uncertainty_minutes: None,
        orbs: [8., 4., 6., 6., 8.],
    };
    let mut cases = vec![("exact", base.clone())];
    let mut i = base.clone();
    i.accuracy = "approximate".into();
    i.uncertainty_minutes = Some(90);
    cases.push(("approximate", i));
    let mut i = base.clone();
    i.accuracy = "unknown".into();
    i.time = None;
    cases.push(("unknown", i));
    let mut i = base.clone();
    i.latitude = 70.;
    cases.push(("polar", i));
    let mut i = base.clone();
    i.orbs = [0.; 5];
    cases.push(("no-aspects", i));
    let mut i = base.clone();
    i.orbs = [15.; 5];
    cases.push(("wide-orbs", i));
    let mut i = base.clone();
    i.date = "1966-06-01".into();
    cases.push(("generational", i));
    let mut i = base.clone();
    i.date = "1955-01-01".into();
    i.timezone = "Asia/Seoul".into();
    i.latitude = 37.566;
    i.longitude = 126.978;
    cases.push(("historical", i));
    for day in 1..=28 {
        let mut i = base.clone();
        i.date = format!("2000-01-{day:02}");
        i.accuracy = "unknown".into();
        i.time = None;
        if chart(&i).unwrap().bodies[1].possible_signs.len() > 1 {
            cases.push(("moon-boundary", i));
            break;
        }
    }
    let reports: Vec<_> = cases
        .into_iter()
        .map(|(name, input)| {
            let chart = chart(&input).unwrap();
            let facts = natal_facts(&chart).unwrap();
            let plan = evaluate(&facts, &semantics, &rules).unwrap();
            serde_json::json!({"name":name,"input":input,"chart":chart,"facts":facts,"plan":plan})
        })
        .collect();
    println!("{}", serde_json::to_string_pretty(&reports).unwrap());
}
