import { jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Role } from "./audit";

export class AuthError extends Error {}
export interface Identity { actor: string; role: Role }
export interface AuthConfig { issuer: string; audience: string; getKey: JWTVerifyGetKey }

/** Identity-provider groups -> application roles. A user must hold exactly one of these. */
const GROUP_TO_ROLE: Record<string, Role> = {
  "sas-analyst": "ANALYST",
  "sas-case-officer": "CASE_OFFICER",
  "sas-auditor": "AUDITOR",
};

/**
 * Verifies a staff bearer token (Cognito/OIDC ID token, MFA enforced in the user pool) and derives the role
 * server-side. Signature, issuer, audience and expiry are all checked; only RS256 is accepted (no "none"/HS256).
 * Any failure yields the same AuthError so callers learn nothing about why.
 */
export async function authenticate(header: string | undefined, cfg: AuthConfig): Promise<Identity> {
  const m = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header ?? "");
  if (!m) throw new AuthError("Unauthorized");
  try {
    const { payload } = await jwtVerify(m[1]!, cfg.getKey, {
      issuer: cfg.issuer, audience: cfg.audience, algorithms: ["RS256"], clockTolerance: 5,
    });
    const groups = Array.isArray(payload["cognito:groups"]) ? (payload["cognito:groups"] as unknown[]) : [];
    const roles = groups.map((g) => GROUP_TO_ROLE[String(g)]).filter((r): r is Role => !!r);
    if (roles.length !== 1 || !payload.sub) throw new AuthError("Unauthorized");
    return { actor: payload.sub, role: roles[0]! };
  } catch {
    throw new AuthError("Unauthorized");
  }
}
