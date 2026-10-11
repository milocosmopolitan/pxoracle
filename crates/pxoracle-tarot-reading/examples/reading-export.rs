//! Offline batch runner for the exhaustive three-card export. Installs the validated packs once and
//! streams production `ReadingPlan`s as NDJSON, one line per canonical case holding all 12 contexts.
use pxoracle_tarot_reading::export::*;
use pxoracle_tarot_reading::*;
use std::collections::BTreeMap;
use std::io::{BufRead, BufWriter, Write};
use std::path::Path;

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned()
}
fn num(args: &[String], name: &str) -> Result<Option<u64>, String> {
    arg(args, name).map(|v| v.parse::<u64>().map_err(|_| format!("EXPORT_ARG {name}"))).transpose()
}
fn engine(args: &[String]) -> Result<Interpreter, String> {
    let read = |name: &str| std::fs::read_to_string(arg(args, name).ok_or(format!("EXPORT_ARG {name}"))?)
        .map_err(|e| format!("EXPORT_IO {name}: {e}"));
    let semantics = serde_json::from_str(&read("--semantics")?).map_err(|e| format!("EXPORT_PACK semantics: {e}"))?;
    let rules = serde_json::from_str(&read("--rules")?).map_err(|e| format!("EXPORT_PACK rules: {e}"))?;
    Interpreter::new(semantics, rules)
}
fn space(args: &[String]) -> Result<CaseSpace, String> {
    CaseSpace::new(num(args, "--deck-size")?.unwrap_or(FULL_DECK as u64) as usize)
}
/// Either a contiguous `[start, end)` range or an explicit ascending list from `--cases-file`.
fn case_list(args: &[String], space: &CaseSpace) -> Result<Box<dyn Iterator<Item = Result<u64, String>>>, String> {
    if let Some(path) = arg(args, "--cases-file") {
        let file = std::fs::File::open(Path::new(&path)).map_err(|e| format!("EXPORT_IO cases-file: {e}"))?;
        return Ok(Box::new(std::io::BufReader::new(file).lines().filter_map(|l| match l {
            Ok(l) if l.trim().is_empty() => None,
            Ok(l) => Some(l.trim().parse::<u64>().map_err(|_| "EXPORT_ARG cases-file".to_string())),
            Err(e) => Some(Err(format!("EXPORT_IO cases-file: {e}"))),
        })));
    }
    let start = num(args, "--start")?.unwrap_or(0);
    let end = num(args, "--end")?.unwrap_or(space.len());
    if start > end || end > space.len() {
        return Err("EXPORT_CASE_RANGE".into());
    }
    Ok(Box::new((start..end).map(Ok)))
}
fn is_broken_pipe(e: &std::io::Error) -> bool {
    e.kind() == std::io::ErrorKind::BrokenPipe
}
fn batch(args: &[String]) -> Result<(), String> {
    let (interpreter, space) = (engine(args)?, space(args)?);
    let stop_file = arg(args, "--stop-file");
    let versions = Versions::default();
    let contexts = contexts();
    let mut out = BufWriter::with_capacity(1 << 20, std::io::stdout().lock());
    let mut line = Vec::with_capacity(1 << 15);
    for (n, case) in case_list(args, &space)?.enumerate() {
        let case = case?;
        // Cooperative interruption: a stop file ends the stream at a case boundary.
        if n % 1024 == 0 && stop_file.as_deref().is_some_and(|p| Path::new(p).exists()) {
            return Err("EXPORT_INTERRUPTED".into());
        }
        line.clear();
        write!(line, "{{\"case\":{case},\"plans\":[").unwrap();
        for (k, (context, name)) in contexts.iter().enumerate() {
            let input = space.input(case, context, &versions)?;
            let plan = interpreter.interpret(input).map_err(|e| format!("EXPORT_EVAL case={case} context={name}: {e}"))?;
            if k > 0 {
                line.push(b',');
            }
            serde_json::to_writer(&mut line, &plan).map_err(|e| e.to_string())?;
        }
        line.extend_from_slice(b"]}\n");
        if let Err(e) = out.write_all(&line) {
            return if is_broken_pipe(&e) { Err("EXPORT_BROKEN_PIPE".into()) } else { Err(format!("EXPORT_IO stdout: {e}")) };
        }
    }
    out.flush().map_err(|e| format!("EXPORT_IO stdout: {e}"))
}
#[derive(Default)]
struct Signature {
    count: u64,
    by_mask: [u64; 8],
    /// first case of each coarse class: [all upright, all reversed, mixed]
    first: [Option<u64>; 3],
}
/// Sweeps cases, groups production relation outcomes, and verifies relations are context independent.
fn scan(args: &[String]) -> Result<(), String> {
    let (interpreter, space) = (engine(args)?, space(args)?);
    let versions = Versions::default();
    let contexts = contexts();
    let mut sigs: BTreeMap<String, Signature> = BTreeMap::new();
    let mut total = 0u64;
    for case in case_list(args, &space)? {
        let case = case?;
        let mut key0: Option<String> = None;
        for (context, name) in &contexts {
            let plan = interpreter
                .interpret(space.input(case, context, &versions)?)
                .map_err(|e| format!("EXPORT_EVAL case={case} context={name}: {e}"))?;
            let key = if plan.fallback {
                "fallback".to_string()
            } else {
                plan.relations
                    .iter()
                    .map(|r| format!("{}{:?}", r.rule_id, r.card_indices))
                    .collect::<Vec<_>>()
                    .join("|")
            };
            match &key0 {
                None => key0 = Some(key),
                Some(k) if *k != key => return Err(format!("EXPORT_CONTEXT_DEPENDENT_RELATIONS case={case} context={name}")),
                _ => {}
            }
        }
        let mask = (case % 8) as usize;
        let s = sigs.entry(key0.unwrap()).or_default();
        s.count += 1;
        s.by_mask[mask] += 1;
        let class = match mask { 0 => 0, 7 => 1, _ => 2 };
        s.first[class].get_or_insert(case);
        total += 1;
    }
    let rows: Vec<_> = sigs
        .iter()
        .map(|(k, s)| serde_json::json!({"signature": k, "count": s.count, "byMask": s.by_mask, "first": s.first}))
        .collect();
    let doc = serde_json::json!({"cases": total, "contexts": contexts.len(), "signatures": rows});
    println!("{}", serde_json::to_string(&doc).map_err(|e| e.to_string())?);
    Ok(())
}
fn info(args: &[String]) -> Result<(), String> {
    let space = space(args)?;
    let probe = |id: u64| -> Result<serde_json::Value, String> {
        let c = space.decode(id)?;
        Ok(serde_json::json!({"caseId": id, "cards": c.map(|(i, r)| (space.deck()[i].clone(), r))}))
    };
    let last = space.len() - 1;
    println!(
        "{}",
        serde_json::json!({"enumeration": CASE_ENUMERATION, "deckSize": space.deck().len(), "cases": space.len(),
            "deck": space.deck(), "vectors": [probe(0)?, probe(1)?, probe(7)?, probe(8)?, probe(last)?]})
    );
    Ok(())
}
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let result = match args.get(1).map(String::as_str) {
        Some("batch") => batch(&args),
        Some("scan") => scan(&args),
        Some("info") => info(&args),
        _ => Err("usage: reading-export <batch|scan|info> --semantics S --rules R [--start N --end M | --cases-file F] [--deck-size N] [--stop-file P]".into()),
    };
    if let Err(e) = result {
        if e != "EXPORT_BROKEN_PIPE" {
            eprintln!("{e}");
        }
        std::process::exit(match e.as_str() { "EXPORT_INTERRUPTED" => 4, "EXPORT_BROKEN_PIPE" => 3, _ => 2 });
    }
}
