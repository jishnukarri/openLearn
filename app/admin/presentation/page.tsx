import { headers } from "next/headers";
import QRCode from "qrcode";
import { PresentationDeck } from "@/components/presentation-deck";

export const metadata = { title: "Presentation" };

const DEFAULT_PUBLIC_URL = "https://openlearn.prox1.lon.jishnu.tech/";

export default async function AdminPresentationPage() {
  // The QR code must open the public site, never localhost. Order: the
  // PUBLIC_SITE_URL env var, then the address the admin is viewing the site on,
  // and only if that is a local address, the default public address below.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const siteUrl = process.env.PUBLIC_SITE_URL || (isLocal ? DEFAULT_PUBLIC_URL : `${proto}://${host}/`);
  // Inline SVG (generated here from our own URL) stays crisp when projected
  // and doesn't depend on any image loading.
  const qr = await QRCode.toString(siteUrl, {
    type: "svg",
    margin: 2,
    color: { dark: "#211c17", light: "#ffffff" },
  });

  return <PresentationDeck qr={qr} />;
}
