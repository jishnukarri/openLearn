import type { MetadataRoute } from "next";

// Public pages may be indexed; everything behind a login may not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/privacy"], disallow: ["/admin", "/teacher", "/dashboard", "/learn", "/practice", "/account", "/onboarding", "/api", "/join"] },
  };
}
