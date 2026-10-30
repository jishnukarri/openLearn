import { headers } from "next/headers";
import QRCode from "qrcode";
import { PresentationDeck } from "@/components/presentation-deck";

export const metadata = { title: "Presentation" };

export default async function AdminPresentationPage() {
  // The QR code points at whichever origin the admin is viewing the site on.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  // Inline SVG (generated here from our own URL) stays crisp when projected
  // and doesn't depend on any image loading.
  const qr = await QRCode.toString(`${proto}://${host}/`, {
    type: "svg",
    margin: 2,
    color: { dark: "#211c17", light: "#ffffff" },
  });

  return <PresentationDeck qr={qr} />;
}
