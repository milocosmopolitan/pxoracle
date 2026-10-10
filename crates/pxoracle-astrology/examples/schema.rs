fn main() {
    println!("{}", serde_json::to_string_pretty(&serde_json::json!({"astrology": schemars::schema_for!(pxoracle_astrology::Chart) , "input":schemars::schema_for!(pxoracle_astrology::Input)})).unwrap());
}
