const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Geohash encoder. Precision 5 is a ~5 km cell: deliberately coarse to protect the tipster. */
export function encode(lat: number, lon: number, precision = 5): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error("Invalid coordinates");
  let [latLo, latHi, lonLo, lonHi] = [-90, 90, -180, 180];
  let hash = "", bits = 0, ch = 0, even = true;
  while (hash.length < precision) {
    const mid = even ? (lonLo + lonHi) / 2 : (latLo + latHi) / 2;
    const v = even ? lon : lat;
    ch <<= 1;
    if (v >= mid) { ch |= 1; if (even) lonLo = mid; else latLo = mid; } else if (even) lonHi = mid; else latHi = mid;
    even = !even;
    if (++bits === 5) { hash += B32[ch]; bits = 0; ch = 0; }
  }
  return hash;
}
