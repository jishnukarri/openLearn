import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavBar } from "@/components/navbar";
import { PwaRegister } from "@/components/pwa-register";
import { NavigationProgress } from "@/components/navigation-progress";
import { StudentBottomNav } from "@/components/student-bottom-nav";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { cn } from "@/lib/utils";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Variable serif display face committed in DESIGN.md — warm, high-contrast,
// used sparingly for lesson/topic titles and headline moments so the brand
// doesn't read as one more geometric-sans AI default.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  weight: "variable",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "OpenLearn",
  description: "A opensource platform to help students get better using AI.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "openLearn",
  },
  icons: [
    {
      url: '/openLearnLight.png',
      media: '(prefers-color-scheme: light)',
    },
    {
      url: '/openLearnDark.png',
      media: '(prefers-color-scheme: dark)',
    },
    { url: "/icon.svg", rel: "apple-touch-icon" },
  ]
};

export const viewport: Viewport = {
  themeColor: "#534FE0",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full antialiased", "font-sans", geistSans.variable, geistMono.variable, fraunces.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NavigationProgress />
        <PwaRegister />
        <NavBar />
        {children}
        <StudentBottomNav />
      </body>
    </html>
  );
}
