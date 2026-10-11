use pxoracle_tarot_reading::*;
fn main() {
    let name = std::env::args().nth(1).unwrap_or("input".into());
    let schema = match name.as_str() {
        "input" => schemars::schema_for!(ReadingInput),
        "plan" => schemars::schema_for!(ReadingPlan),
        "semantics" => schemars::schema_for!(SemanticPack),
        "rules" => schemars::schema_for!(RulePack),
        _ => panic!("unknown schema"),
    };
    println!("{}", serde_json::to_string_pretty(&schema).unwrap());
}
