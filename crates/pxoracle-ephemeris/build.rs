fn main() {
    println!("cargo:rerun-if-changed=vendor");
    println!("cargo:rerun-if-changed=src/shim.c");
    cc::Build::new()
        .files(["vendor/astronomy.c", "src/shim.c"])
        .include("vendor")
        .flag_if_supported("-fno-fast-math")
        .compile("pxastronomy");
    if !std::env::var("TARGET").unwrap().contains("emscripten") {
        println!("cargo:rustc-link-lib=m");
    }
}
