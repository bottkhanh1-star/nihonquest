import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

/**
 * Cloudflare Workers / workerd compatible NextAuth handler.
 *
 * Problem: Cloudflare's Web Standard Headers API folds multiple Set-Cookie
 * headers into a single comma-separated string when using headers.append() or
 * headers.set(). This breaks NextAuth's OAuth flow because the browser can't
 * parse concatenated cookie strings — PKCE verifier, state, and CSRF cookies
 * all get dropped, causing OAuthSignin errors.
 *
 * Fix: After NextAuth processes the request, we extract all Set-Cookie values
 * using getSetCookie() (which returns an array), delete the folded header, and
 * re-append each cookie individually so they're sent as separate headers.
 */
const nextAuthHandler = NextAuth(authOptions);

async function handler(req: Request) {
  const res = await nextAuthHandler(req as Parameters<typeof nextAuthHandler>[0]);

  // Re-cast to a standard Response so we can manipulate headers
  const response = res as Response;

  // getSetCookie() returns an array of individual Set-Cookie strings (Web API standard)
  const setCookies: string[] =
    typeof (response.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? ((response.headers as { getSetCookie: () => string[] }).getSetCookie())
      : (response.headers.get("set-cookie") ?? "").split(/,(?=[^;]+=[^;]*(;|$))/).filter(Boolean);

  if (setCookies.length <= 1) {
    // Nothing to fix — return as-is
    return response;
  }

  // Clone headers, remove folded Set-Cookie, re-append each cookie individually
  const newHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      newHeaders.set(key, value);
    }
  });
  for (const cookie of setCookies) {
    newHeaders.append("Set-Cookie", cookie);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export { handler as GET, handler as POST };
