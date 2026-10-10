use std::io::Read;
fn main() {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap();
    match pxoracle_tarot_wasm::dispatch(&input) {
        Ok(x) => println!("{}", x),
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1)
        }
    }
}
