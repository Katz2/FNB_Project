import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

/** Unguessable identifier (128-bit) used as the tipster's receipt. */
export const newId = (bytes = 16): string => randomBytes(bytes).toString("hex");

/** Constant-time check that sha256(secret) equals the stored commitment. */
export function secretMatches(secretHex: string, commitmentHex: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(secretHex) || !/^[a-f0-9]{64}$/.test(commitmentHex)) return false;
  const a = Buffer.from(sha256(Buffer.from(secretHex, "hex")), "hex");
  const b = Buffer.from(commitmentHex, "hex");
  return timingSafeEqual(a, b);
}
