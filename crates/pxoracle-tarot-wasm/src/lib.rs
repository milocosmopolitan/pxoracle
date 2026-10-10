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

use pxoracle_tarot::*;
#[derive(serde::Deserialize)]
#[serde(tag = "op", rename_all = "camelCase", deny_unknown_fields)]
enum Request {
    Create {
        seed: [u32; 2],
        spread: usize,
        #[serde(rename = "reversalPercent", default)]
        reversal_percent: u32,
    },
    Select {
        session: Session,
        slot: usize,
    },
    Reveal {
        session: Session,
        index: usize,
    },
    Restore {
        session: Session,
    },
    Complete {
        session: Session,
    },
}
pub fn dispatch(text: &str) -> Result<serde_json::Value, String> {
    let request: Request = serde_json::from_str(text).map_err(|_| "INVALID_INPUT")?;
    let s = match request {
        Request::Create {
            seed,
            spread,
            reversal_percent,
        } => create(seed, spread, reversal_percent)?,
        Request::Select { mut session, slot } => {
            select(&mut session, slot)?;
            session
        }
        Request::Reveal { mut session, index } => {
            reveal(&mut session, index)?;
            session
        }
        Request::Restore { session } => {
            validate(&session)?;
            session
        }
        Request::Complete { mut session } => {
            complete(&mut session)?;
            session
        }
    };
    serde_json::to_value(s).map_err(|_| "SERIALIZATION".into())
}
