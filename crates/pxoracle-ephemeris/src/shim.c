#include "astronomy.h"
#include <math.h>
int px_position(int body, double days, double *out) {
    const astro_body_t bodies[] = {BODY_SUN, BODY_MOON, BODY_MERCURY, BODY_VENUS, BODY_MARS, BODY_JUPITER, BODY_SATURN, BODY_URANUS, BODY_NEPTUNE, BODY_PLUTO};
    if (body < 0 || body >= 10 || !isfinite(days)) return -1;
    astro_time_t time = Astronomy_TimeFromDays(days);
    astro_vector_t v = Astronomy_GeoVector(bodies[body], time, ABERRATION);
    if (v.status != ASTRO_SUCCESS) return (int)v.status;
    astro_ecliptic_t e = Astronomy_Ecliptic(v);
    if (e.status != ASTRO_SUCCESS) return (int)e.status;
    out[0] = e.elon; out[1] = e.elat; out[2] = Astronomy_SiderealTime(&time); out[3] = time.tt;
    astro_rotation_t rot = Astronomy_Rotation_EQD_ECT(&time);
    out[4] = atan2(rot.rot[2][1],rot.rot[1][1]);
    return 0;
}
