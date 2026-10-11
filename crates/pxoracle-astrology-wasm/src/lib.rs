use std::ffi::{CStr, CString};
use std::os::raw::c_char;
/// Input is a valid, NUL-terminated UTF-8 allocation owned by caller.
/// Return is owned by Rust and must be released exactly once with px_free.
#[no_mangle]
pub unsafe extern "C" fn px_process(input: *const c_char) -> *mut c_char {
    let response = if input.is_null() {
        Err("INVALID_INPUT".to_string())
    } else {
        CStr::from_ptr(input)
            .to_str()
            .map_err(|_| "INVALID_UTF8".into())
            .and_then(dispatch)
    };
    let output = match response {
        Ok(result) => serde_json::json!({"ok":true,"result":result}),
        Err(code) => serde_json::json!({"ok":false,"error":{"code":code}}),
    };
    CString::new(output.to_string()).unwrap().into_raw()
}
/// Only accepts a non-null live pointer returned by px_process, exactly once.
#[no_mangle]
pub unsafe extern "C" fn px_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        drop(CString::from_raw(ptr));
    }
}

use pxoracle_natal_reading::{
    Certainty, NatalAspect, NatalBody, NatalInput, NatalRules, NatalSemantics, NatalVersions,
};
use std::cell::RefCell;
thread_local! { static NATAL: RefCell<Option<(NatalSemantics, NatalRules)>> = const { RefCell::new(None) }; }

#[derive(serde::Deserialize)]
#[serde(tag = "op", rename_all = "camelCase", deny_unknown_fields)]
enum Request {
    CalculateNatal {
        input: pxoracle_astrology::Input,
    },
    RestoreNatal {
        chart: pxoracle_astrology::Chart,
    },
    NatalInitialize {
        semantics: NatalSemantics,
        rules: NatalRules,
    },
    NatalInterpret {
        input: NatalInput,
    },
}

pub fn natal_facts(chart: &pxoracle_astrology::Chart) -> Result<NatalInput, String> {
    pxoracle_astrology::validate_chart(chart)?;
    let settings: pxoracle_astrology::Input =
        serde_json::from_value(chart.provenance["settings"].clone())
            .map_err(|_| "INVALID_CHART")?;
    let facts = NatalInput {
        versions: NatalVersions::default(),
        certainty: if chart.interval[0] == chart.interval[1] {
            Certainty::Exact
        } else {
            Certainty::Sampled
        },
        polar: settings.latitude.abs() >= 66.,
        bodies: chart
            .bodies
            .iter()
            .map(|b| NatalBody {
                id: b.id.clone(),
                longitude: b.longitude,
                speed: b.speed,
                possible_signs: b.possible_signs.clone(),
                house: b.house,
            })
            .collect(),
        ascendant: chart.angles.as_ref().map(|a| a.asc),
        aspects: chart
            .aspects
            .iter()
            .map(|a| NatalAspect {
                a: a.a.clone(),
                b: a.b.clone(),
                kind: a.kind.clone(),
                orb: a.orb,
            })
            .collect(),
        orbs: settings.orbs,
    };
    pxoracle_natal_reading::validate_input(&facts).map_err(|_| "INVALID_CHART")?;
    Ok(facts)
}

pub fn dispatch(text: &str) -> Result<serde_json::Value, String> {
    if text.len() > 1_000_000 {
        return Err("INPUT_TOO_LARGE".into());
    }
    let value: serde_json::Value = serde_json::from_str(text).map_err(|_| "INVALID_INPUT")?;
    if value.get("op").is_none() {
        let input: pxoracle_astrology::Input =
            serde_json::from_value(value).map_err(|_| "INVALID_INPUT")?;
        return serde_json::to_value(pxoracle_astrology::chart(&input)?)
            .map_err(|_| "SERIALIZATION".into());
    }
    let request: Request = serde_json::from_value(value).map_err(|_| "INVALID_INPUT")?;
    match request {
        Request::CalculateNatal { input } => {
            let chart = pxoracle_astrology::chart(&input)?;
            let facts = natal_facts(&chart)?;
            Ok(serde_json::json!({"chart": chart, "facts": facts}))
        }
        Request::RestoreNatal { chart } => {
            let facts = natal_facts(&chart)?;
            Ok(serde_json::json!({"chart": chart, "facts": facts}))
        }
        Request::NatalInitialize { semantics, rules } => {
            pxoracle_natal_reading::validate_packs(&semantics, &rules)
                .map_err(|_| "NATAL_PACK_INVALID")?;
            NATAL.with(|cache| *cache.borrow_mut() = Some((semantics, rules)));
            Ok(serde_json::json!({"initialized":true}))
        }
        Request::NatalInterpret { input } => NATAL.with(|cache| {
            let cache = cache.borrow();
            let (semantics, rules) = cache.as_ref().ok_or("NATAL_NOT_INITIALIZED")?;
            let plan = pxoracle_natal_reading::evaluate(&input, semantics, rules)
                .map_err(|_| "NATAL_INPUT_OR_CONTENT_INVALID")?;
            serde_json::to_value(plan).map_err(|_| "SERIALIZATION".into())
        }),
    }
}
