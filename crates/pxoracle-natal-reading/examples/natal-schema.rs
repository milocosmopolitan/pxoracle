use pxoracle_natal_reading::*;
fn main() {
    let schema = match std::env::args().nth(1).as_deref() {
        Some("input") => schemars::schema_for!(NatalInput),
        Some("plan") => schemars::schema_for!(InterpretationPlan),
        Some("semantics") => schemars::schema_for!(NatalSemantics),
        Some("rules") => schemars::schema_for!(NatalRules),
        _ => panic!("unknown schema"),
    };
    println!("{}", serde_json::to_string_pretty(&schema).unwrap());
}
