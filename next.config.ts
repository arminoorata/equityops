import type { NextConfig } from "next";

/**
 * Content-Security-Policy for a static, client-side education tool.
 * The app stores no user data and does not call a backend.
 */
const csp = [
  "default-src 'self'",
  // Next.js + Turbopack require inline + eval in the framework runtime.
  // Tighter values would break hydration. The vector this leaves open
  // is mitigated by trusting the dependency tree at build time.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // next/font/google emits stylesheets from fonts.googleapis.com and
  // serves the actual font files from fonts.gstatic.com.
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project to avoid the
  // "multiple lockfiles" warning when /srv has its own package-lock.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
