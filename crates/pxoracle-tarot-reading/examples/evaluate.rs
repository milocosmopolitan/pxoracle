use pxoracle_tarot_reading::*;
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let semantics = serde_json::from_str(&std::fs::read_to_string(&args[1]).unwrap()).unwrap();
    let rules = serde_json::from_str(&std::fs::read_to_string(&args[2]).unwrap()).unwrap();
    let interpreter = Interpreter::new(semantics, rules).unwrap();
    let inputs: Vec<ReadingInput> =
        serde_json::from_str(&std::fs::read_to_string(&args[3]).unwrap()).unwrap();
    println!(
        "{}",
        serde_json::to_string(
            &inputs
                .into_iter()
                .map(|i| interpreter.interpret(i).unwrap())
                .collect::<Vec<_>>()
        )
        .unwrap()
    );
}
