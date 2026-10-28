import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { z } from "zod";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

// Bật AUTH_TRUST_HOST trên Cloudflare Workers / Vercel / Netlify để NextAuth tự động nhận diện domain
if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}

// Chuẩn hoá NEXTAUTH_URL: loại bỏ dấu gạch chéo cuối nếu có
if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.replace(/\/+$/, "");
}

// Tự động nhận diện URL trên Netlify hoặc Vercel
// Nếu đang deploy mà NEXTAUTH_URL bị set nhầm thành localhost hoặc chưa set:
const detectedCloudUrl =
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

if (detectedCloudUrl && (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost"))) {
  process.env.NEXTAUTH_URL = detectedCloudUrl.replace(/\/+$/, "");
} else if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.replace(/\/+$/, "");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

const isSecureCookieEnv =
  process.env.NODE_ENV === "production" &&
  Boolean(
    process.env.VERCEL ||
      process.env.NEXTAUTH_URL?.startsWith("https://") ||
      process.env.URL?.startsWith("https://") ||
      process.env.DEPLOY_PRIME_URL?.startsWith("https://"),
  );

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 ngày ghi nhớ phiên đăng nhập
    updateAge: 24 * 60 * 60, // Tự động gia hạn khi người dùng tương tác mỗi ngày
  },
  secret: getAuthSecret(),
  pages: { signIn: "/login", newUser: "/onboarding" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Chống brute-force mật khẩu theo từng email
        const attempt = rateLimit(`login:${parsed.data.email}`, 10, 15 * 60_000);
        if (!attempt.ok) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                prompt: "select_account",
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user?.id) {
        try {
          await prisma.profile.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              displayName: user.name || (profile as { name?: string })?.name || "Học viên",
              avatar: user.image || (profile as { picture?: string })?.picture || null,
            },
            update: {},
          }).catch(() => {});
        } catch {
          // Không để lỗi profile ngăn cản đăng nhập
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // 1. Cho phép các đường dẫn tương đối (vd: "/app", "/onboarding"), chặn protocol-relative "//evil.com"
      if (url.startsWith("/") && !url.startsWith("//")) {
        return `${baseUrl}${url}`;
      }
      // 2. Cho phép redirect nếu cùng origin/domain
      try {
        const targetUrl = new URL(url);
        const baseObj = new URL(baseUrl);
        if (targetUrl.origin === baseObj.origin) {
          return url;
        }
      } catch {
        // url không hợp lệ
      }
      return baseUrl;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
      }
      // Bảo vệ kích thước Cookie trên Vercel/Netlify:
      // Tuyệt đối không lưu avatar base64 hoặc dữ liệu lớn vào JWT để tránh lỗi 494 REQUEST_HEADER_TOO_LARGE
      if (typeof token.picture === "string" && (token.picture.startsWith("data:") || token.picture.length > 256)) {
        delete token.picture;
      }
      if (
        "image" in token &&
        (typeof token.image !== "string" ||
          (token.image as string).startsWith("data:") ||
          (token.image as string).length > 256)
      ) {
        delete (token as Record<string, unknown>).image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      // Đảm bảo session không chứa base64
      if (
        session.user &&
        typeof session.user.image === "string" &&
        (session.user.image.startsWith("data:") || session.user.image.length > 256)
      ) {
        session.user.image = null;
      }
      return session;
    },
  },
  useSecureCookies: isSecureCookieEnv,
  cookies: {
    sessionToken: {
      name: isSecureCookieEnv ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isSecureCookieEnv,
        maxAge: 30 * 24 * 60 * 60, // 30 ngày
      },
    },
    callbackUrl: {
      name: isSecureCookieEnv ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: isSecureCookieEnv,
      },
    },
    csrfToken: {
      name: isSecureCookieEnv ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isSecureCookieEnv,
      },
    },
  },
  logger: {
    error(code, metadata) {
      console.error("[NextAuth Error]", code, metadata);
    },
    warn(code) {
      console.warn("[NextAuth Warning]", code);
    },
  },
};
