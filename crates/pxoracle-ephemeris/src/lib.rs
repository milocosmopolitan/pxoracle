//! Serialized safe facade: upstream Pluto cache is mutable global C state.
use std::sync::Mutex;
static BACKEND: Mutex<()> = Mutex::new(());
extern "C" {
    fn px_position(body: i32, days: f64, out: *mut f64) -> i32;
}
pub const BACKEND_VERSION: &str = "astronomy-engine/865d3da7d8112bbc7911238052c6af4aaf877181";
#[derive(Debug)]
pub struct Position {
    pub longitude: f64,
    pub latitude: f64,
    pub sidereal_hours: f64,
    pub tt_days: f64,
    pub obliquity: f64,
}
pub fn position(body: usize, ut_days: f64) -> Result<Position, String> {
    if body >= 10 || !ut_days.is_finite() {
        return Err("INVALID_INPUT".into());
    }
    let _lock = BACKEND.lock().map_err(|_| "BACKEND_POISONED")?;
    let mut out = [0.0; 5];
    // The shim writes exactly five doubles. The mutex protects all C cache access.
    let status = unsafe { px_position(body as i32, ut_days, out.as_mut_ptr()) };
    if status != 0 || out.iter().any(|x| !x.is_finite()) {
        return Err("BACKEND_ERROR".into());
    }
    Ok(Position {
        longitude: out[0],
        latitude: out[1],
        sidereal_hours: out[2],
        tt_days: out[3],
        obliquity: out[4],
    })
}
#[cfg(test)]
mod tests {
    #[test]
    fn j2000_sun() {
        let p = super::position(0, 0.0).unwrap();
        assert!((p.longitude - 280.37).abs() < 0.02);
    }
}
