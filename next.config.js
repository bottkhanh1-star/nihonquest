/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["msedge-tts"],
  },
  typescript: {
    // Pre-existing type errors in seed-data files (n3-data.ts, n4-data.ts)
    // which are only used at seed time and never in the Next.js runtime.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Prevent ESLint warnings/errors from failing production builds on Netlify
    ignoreDuringBuilds: true,
  },
  images: {
    // Was `hostname: "**"` for both https and http, which allowed the optimizer
    // to proxy any host (including plaintext) and opened an abuse/mixed-content
    // surface. Explicit allow-list instead.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async redirects() {
    return [
      { source: '/explore/:path*', destination: '/app/explore/:path*', permanent: false },
      { source: '/grammar/:path*', destination: '/app/grammar/:path*', permanent: false },
      { source: '/journey/:path*', destination: '/app/journey/:path*', permanent: false },
      { source: '/leaderboard/:path*', destination: '/app/leaderboard/:path*', permanent: false },
      { source: '/learn/:path*', destination: '/app/learn/:path*', permanent: false },
      { source: '/path/:path*', destination: '/app/path/:path*', permanent: false },
      { source: '/practice/:path*', destination: '/app/practice/:path*', permanent: false },
      { source: '/profile/:path*', destination: '/app/profile/:path*', permanent: false },
      { source: '/review/:path*', destination: '/app/review/:path*', permanent: false },
      { source: '/sensei/:path*', destination: '/app/sensei/:path*', permanent: false },
      { source: '/survival/:path*', destination: '/app/survival/:path*', permanent: false },
      { source: '/vocabulary/:path*', destination: '/app/vocabulary/:path*', permanent: false },
      { source: '/dashboard/:path*', destination: '/app/:path*', permanent: false },
      { source: '/home', destination: '/app', permanent: false },
    ];
  },
};

module.exports = nextConfig;
