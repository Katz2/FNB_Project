import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, concatBytes, utf8ToBytes } from "@noble/hashes/utils";

/**
 * Tip sealing protocol "sa-sight/v1" (sealed box):
 *   ephemeral X25519 key -> shared secret with the SAPS public key -> HKDF-SHA256 -> XChaCha20-Poly1305.
 * Payload = 0x01 | ephemeralPublicKey(32) | nonce(24) | ciphertext. Plaintext is length-prefixed and padded
 * to a multiple of 512 bytes so message length leaks as little as possible. Pure JS (audited noble libraries):
 * works in Expo Go and release builds. Only SAPS, holding the private key, can open a sealed tip.
 */
export type Rng = (n: number) => Uint8Array;
export interface RecipientJwk { kty: "OKP"; crv: "X25519"; x: string }
export interface Sealed { ciphertext: string; commitment: string; claimSecret: string }

const VERSION = 1, BUCKET = 512, MAX_TEXT_BYTES = 16_000;
const INFO = utf8ToBytes("sa-sight/v1/tip");
const defaultRng: Rng = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function toBase64(b: Uint8Array): string {
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = ((b[i] ?? 0) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ALPHA[(n >> 18) & 63]! + ALPHA[(n >> 12) & 63]! + (i + 1 < b.length ? ALPHA[(n >> 6) & 63]! : "=") + (i + 2 < b.length ? ALPHA[n & 63]! : "=");
  }
  return out;
}
export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const c of clean) {
    const v = ALPHA.indexOf(c);
    if (v < 0) throw new Error("Invalid base64");
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
  }
  return Uint8Array.from(out);
}

function recipientKey(jwk: RecipientJwk): Uint8Array {
  if (jwk?.kty !== "OKP" || jwk.crv !== "X25519") throw new Error("Unsupported key");
  const k = fromBase64(jwk.x);
  if (k.length !== 32) throw new Error("Bad key length");
  return k;
}
const deriveKey = (shared: Uint8Array, eph: Uint8Array, rcpt: Uint8Array) => hkdf(sha256, shared, concatBytes(eph, rcpt), INFO, 32);

function pad(data: Uint8Array): Uint8Array {
  const total = Math.ceil((data.length + 2) / BUCKET) * BUCKET;
  const out = new Uint8Array(total);
  out[0] = data.length >> 8; out[1] = data.length & 255;
  out.set(data, 2);
  return out;
}

/** Encrypts the tip for SAPS and creates the claim secret + its SHA-256 commitment (the only thing the server sees). */
export function sealTip(text: string, recipient: RecipientJwk, rng: Rng = defaultRng): Sealed {
  const data = utf8ToBytes(text);
  if (data.length === 0 || data.length > MAX_TEXT_BYTES) throw new Error("Message length not allowed");
  const rcpt = recipientKey(recipient);
  const ephPriv = rng(32), ephPub = x25519.getPublicKey(ephPriv);
  const key = deriveKey(x25519.getSharedSecret(ephPriv, rcpt), ephPub, rcpt);
  const nonce = rng(24);
  const ct = xchacha20poly1305(key, nonce).encrypt(pad(data));
  const claim = rng(32);
  return {
    ciphertext: toBase64(concatBytes(Uint8Array.of(VERSION), ephPub, nonce, ct)),
    commitment: bytesToHex(sha256(claim)),
    claimSecret: bytesToHex(claim),
  };
}

/** Reference decryptor for the SAPS side and tests. The private key never exists on the phone or on our servers. */
export function openTip(ciphertext: string, recipientPrivate: Uint8Array): string {
  const b = fromBase64(ciphertext);
  if (b.length < 1 + 32 + 24 + 16 || b[0] !== VERSION) throw new Error("Bad payload");
  const ephPub = b.slice(1, 33), nonce = b.slice(33, 57), ct = b.slice(57);
  const key = deriveKey(x25519.getSharedSecret(recipientPrivate, ephPub), ephPub, x25519.getPublicKey(recipientPrivate));
  const p = xchacha20poly1305(key, nonce).decrypt(ct); // throws if tampered
  const len = ((p[0] ?? 0) << 8) | (p[1] ?? 0);
  return new TextDecoder().decode(p.slice(2, 2 + len));
}
