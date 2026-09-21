import type { NextConfig } from "next";
import path from "node:path";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src https://datastudio.google.com https://lookerstudio.google.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./src/assets/radar-fonts/*.ttf", "./src/assets/radar-fonts/OFL.txt", "./src/assets/radar-fonts/fonts.conf"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nexopstech.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "31mb",
    },
  },
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      // The private preview uses an explicitly tracked popup and exact-origin postMessage.
      // Keep the stronger default for every page that does not open this preview.
      ...["/portal/radar/operacion", "/backoffice/radar/operacion"].map((source) => ({
        source,
        headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }],
      })),
    ];
  },
};

export default nextConfig;
