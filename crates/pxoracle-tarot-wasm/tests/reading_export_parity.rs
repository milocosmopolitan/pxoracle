//! The WASM adapter's dispatch path and the offline export runner must produce identical plans.
use pxoracle_tarot_reading::export::*;
use pxoracle_tarot_reading::*;
#[test]
fn dispatch_matches_batch_interpretation() {
    let base = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../content/tarot/reading");
    let read = |n: &str| std::fs::read_to_string(base.join(n)).unwrap();
    let (semantics, rules): (serde_json::Value, serde_json::Value) =
        (serde_json::from_str(&read("semantics.2.json")).unwrap(), serde_json::from_str(&read("rules.2.json")).unwrap());
    let init = serde_json::json!({"op":"readingInitialize","semantics":semantics,"rules":rules});
    pxoracle_tarot_wasm::dispatch(&init.to_string()).unwrap();
    let engine = Interpreter::new(serde_json::from_value(semantics).unwrap(), serde_json::from_value(rules).unwrap()).unwrap();
    let space = CaseSpace::new(FULL_DECK).unwrap();
    for id in [0u64, 1, 7, 8, 143_680, 1_826_000, space.len() - 1] {
        for (ctx, _) in contexts() {
            let input = space.input(id, &ctx, &Versions::default()).unwrap();
            let via_wasm = pxoracle_tarot_wasm::dispatch(&serde_json::json!({"op":"readingInterpret","input":input}).to_string()).unwrap();
            assert_eq!(via_wasm, serde_json::to_value(engine.interpret(input).unwrap()).unwrap(), "case {id}");
        }
    }
}
