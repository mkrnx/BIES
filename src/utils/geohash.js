// Minimal encode-only geohash (no dependency) — used for the optional NIP-52-style
// 'g' tag on cowork check-in events.
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a latitude/longitude pair into a geohash string.
 * Standard bit-interleaving: even bits refine longitude, odd bits refine latitude,
 * accumulating 5 bits per base32 character.
 */
export function encodeGeohash(lat, lng, precision = 9) {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = '';
  let bits = 0;
  let bitCount = 0;
  let evenBit = true; // even bits encode longitude

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        bits = (bits << 1) | 1;
        lngMin = mid;
      } else {
        bits = bits << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        bits = (bits << 1) | 1;
        latMin = mid;
      } else {
        bits = bits << 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    bitCount += 1;
    if (bitCount === 5) {
      hash += BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }

  return hash;
}
