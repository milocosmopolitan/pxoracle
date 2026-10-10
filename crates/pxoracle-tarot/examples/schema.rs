fn main() {
    println!(
        "{}",
        serde_json::to_string_pretty(
            &serde_json::json!({"tarot": schemars::schema_for!(pxoracle_tarot::Session) })
        )
        .unwrap()
    );
}
