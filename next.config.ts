import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the sandbox preview proxy to hit the dev server so HMR and
  // chunk requests resolve over the preview domain (prevents stale pages).
  // Bare domains do NOT match subdomains in Next 16 — need the wildcard
  // form for preview-chat-<id>.space-z.ai (verified: bare form still 403s).
  allowedDevOrigins: ["*.space-z.ai", "space-z.ai"],
  // static game assets are content-addressed in practice (models swap only
  // via new files / ?v= revs) — hard-cache them at the HTTP layer so a
  // production deploy never re-downloads 26MB of GLBs + textures per visit.
  // Dev is covered by the asset service worker (public/sw.js).
  async headers() {
    const immutable = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    return [
      { source: "/models/:path*", headers: immutable },
      { source: "/textures/:path*", headers: immutable },
      { source: "/draco/:path*", headers: immutable },
      { source: "/ktx2/:path*", headers: immutable },
    ];
  },
};

export default nextConfig;
