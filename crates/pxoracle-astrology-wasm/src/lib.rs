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

pub fn dispatch(text: &str) -> Result<serde_json::Value, String> {
    let input: pxoracle_astrology::Input =
        serde_json::from_str(text).map_err(|_| "INVALID_INPUT")?;
    serde_json::to_value(pxoracle_astrology::chart(&input)?).map_err(|_| "SERIALIZATION".into())
}
