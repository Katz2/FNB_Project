import { z } from "zod";

export const CATEGORIES = ["GBV", "ROBBERY", "HIJACKING", "DRUGS", "CORRUPTION", "OTHER"] as const;

/** Strict allow-list schema. Unknown fields (device IDs, IPs, names) are rejected, not ignored. */
export const TipSchema = z
  .object({
    category: z.enum(CATEGORIES),
    geohash: z.string().regex(/^[0-9b-hjkmnp-z]{5}$/), // ~5km cell: coarse on purpose
    hourBucket: z.iso.datetime(), // client rounds to the hour
    ciphertext: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(87_400), // ~64KB sealed payload
    commitment: z.string().regex(/^[a-f0-9]{64}$/), // SHA-256 of the claim secret
  })
  .strict();

export type TipInput = z.infer<typeof TipSchema>;
