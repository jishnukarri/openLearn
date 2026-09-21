import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is too small for uploaded spec PDFs. Raised again for
      // bulk paper-marking uploads (a whole class's scanned answer scripts
      // in one submit) — a body over the limit doesn't fail cleanly, it
      // gets truncated mid-stream and the multipart parser throws a
      // generic "Unexpected end of form" instead of a size error.
      bodySizeLimit: "500MB",
    },
    // proxy.ts (this app's middleware) runs on every route it matches,
    // which includes the file-upload Server Action routes — and Next
    // independently clones/buffers the request body for the proxy layer,
    // capped at a DEFAULT of only 10MB, entirely separate from
    // serverActions.bodySizeLimit above. A body over *this* limit gets
    // truncated before the Server Action's own parser ever sees it,
    // producing the same "Unexpected end of form" error regardless of how
    // high bodySizeLimit is set. This is the actual limit that was hit.
    proxyClientMaxBodySize: "500MB",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            // 'unsafe-eval' is dev-only: Next.js/React use eval() in dev for
            // debugging (stack reconstruction) but never in production.
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${
              process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
            }; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
