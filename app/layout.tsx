import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavBar } from "@/components/navbar";
import { PwaRegister } from "@/components/pwa-register";
import { NavigationProgress } from "@/components/navigation-progress";
import { StudentBottomNav } from "@/components/student-bottom-nav";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import { cn } from "@/lib/utils";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", geistSans.variable, geistMono.variable, poppins.variable)}>
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
