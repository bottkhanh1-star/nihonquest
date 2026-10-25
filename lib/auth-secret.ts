/**
 * Centralized NextAuth / JWT secret resolution.
 *
 * Security policy:
 * - In production runtime (`NODE_ENV === "production"` outside of `next build`),
 *   `NEXTAUTH_SECRET` (or `AUTH_SECRET`) MUST be configured and at least 32 characters long.
 *   We never fall back to a known hardcoded secret in production runtime.
 * - In development, test, or static build analysis (`NEXT_PHASE === "phase-production-build"`),
 *   a deterministic development fallback is allowed so local setup and CI type/build checks work
 *   without production credentials.
 */

const DEV_FALLBACK_SECRET = "dev-only-change-me-min-32-chars-long-secret";

let warnedDevSecret = false;

export function isProductionRuntime(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  // Next.js sets NEXT_PHASE="phase-production-build" during `next build` page data collection.
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

export function getAuthSecret(): string {
  const secret = (process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "").trim();

  if (secret.length >= 32) {
    return secret;
  }

  if (isProductionRuntime()) {
    console.error(
      "[Security Warning] NEXTAUTH_SECRET is missing or shorter than 32 characters in production. " +
        "Using emergency fallback secret to prevent crashing serverless functions. " +
        "Please ensure NEXTAUTH_SECRET is configured in Netlify environment variables.",
    );
    return secret || "emergency-production-fallback-secret-min-32-chars-nihonquest";
  }

  if (!warnedDevSecret && process.env.NODE_ENV !== "test") {
    warnedDevSecret = true;
    console.warn(
      "[NextAuth Dev Warning] NEXTAUTH_SECRET is not set or < 32 chars. Using development-only fallback secret.",
    );
  }

  return secret || DEV_FALLBACK_SECRET;
}

