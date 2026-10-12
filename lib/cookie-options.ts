import "server-only";
import { headers } from "next/headers";

// Cookies marked Secure are silently dropped by browsers on plain HTTP, so
// forcing `secure` whenever NODE_ENV is "production" loses the login for any
// production build reached over http (an IP, a LAN host, Safari on
// localhost). Mark Secure only when the request actually arrived over HTTPS,
// including behind a TLS-terminating proxy such as Caddy.
export async function isHttpsRequest(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return h.get("origin")?.startsWith("https://") ?? false;
}
