import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth-secret";

export async function middleware(req: NextRequest) {
  // Dọn dẹp cookie phân mảnh cũ (ví dụ .session-token.0, .1) nếu còn sót lại từ sự cố trước đó
  const cleanupStaleChunks = (response: NextResponse) => {
    for (const cookie of req.cookies.getAll()) {
      if (/\.(session-token)\.\d+$/.test(cookie.name)) {
        response.cookies.delete(cookie.name);
      }
    }
    return response;
  };

  let secret: string;
  try {
    secret = getAuthSecret();
  } catch (err) {
    console.error((err as Error).message);
    const signInUrl = new URL("/login", req.url);
    signInUrl.searchParams.set("error", "Configuration");
    return cleanupStaleChunks(NextResponse.redirect(signInUrl));
  }

  // Kiểm tra cookie: Hỗ trợ cả HTTPS (__Secure-) và HTTP/Proxy chuẩn của Netlify / Vercel
  const isSecure = Boolean(
    req.cookies.get("__Secure-next-auth.session-token") ||
      req.cookies.getAll().some((c) => c.name.startsWith("__Secure-next-auth.session-token")),
  );
  const primaryCookieName = isSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token";

  let token = await getToken({
    req,
    secret,
    cookieName: primaryCookieName,
  });

  // Fallback: nếu chưa lấy được qua tên chính, thử kiểm tra tên cookie còn lại
  if (!token && !isSecure) {
    token = await getToken({
      req,
      secret,
      cookieName: "__Secure-next-auth.session-token",
    });
  } else if (!token && isSecure) {
    token = await getToken({
      req,
      secret,
      cookieName: "next-auth.session-token",
    });
  }

  const pathname = req.nextUrl.pathname;
  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Nếu người dùng đã đăng nhập mà truy cập trang đăng nhập/đăng ký -> tự động chuyển thẳng sang /app
  if (isAuthPage) {
    if (token) {
      const callback = req.nextUrl.searchParams.get("callbackUrl");
      const targetPath =
        callback && !callback.startsWith("/login") && !callback.startsWith("/register") ? callback : "/app";
      return cleanupStaleChunks(NextResponse.redirect(new URL(targetPath, req.url)));
    }
    return cleanupStaleChunks(NextResponse.next());
  }

  // Nếu chưa đăng nhập mà truy cập các trang yêu cầu xác thực (/app, /onboarding)
  if (!token) {
    const signInUrl = new URL("/login", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return cleanupStaleChunks(NextResponse.redirect(signInUrl));
  }

  return cleanupStaleChunks(NextResponse.next());
}

export const config = {
  matcher: ["/app/:path*", "/onboarding", "/login", "/register"],
};
