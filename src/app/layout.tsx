import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://equityops.arminoorata.com"),
  title: {
    default: "Equity Ops Workbench",
    template: "%s · Equity Ops Workbench",
  },
  description:
    "Free practitioner tools for stock-based compensation professionals. Board-ready stock plan health diagnostics, equity event readiness checklists, and more. Built by Armi Noorata.",
  applicationName: "Equity Ops Workbench",
  authors: [{ name: "Armi Noorata", url: "https://arminoorata.com" }],
  creator: "Armi Noorata",
  keywords: [
    "stock-based compensation",
    "equity compensation",
    "Total Rewards",
    "stock plan health",
    "burn rate",
    "overhang",
    "board memo",
    "ISS-aware",
    "RSU",
    "ISO",
    "NSO",
    "compensation committee",
  ],
  openGraph: {
    type: "website",
    url: "https://equityops.arminoorata.com",
    siteName: "Equity Ops Workbench",
    title: "Equity Ops Workbench",
    description:
      "Free practitioner tools for stock-based compensation professionals. Built by Armi Noorata.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Equity Ops Workbench",
    description:
      "Free practitioner tools for stock-based compensation professionals. Built by Armi Noorata.",
    creator: "@arminoorata",
  },
};

const bootstrap = `(function(){try{var s=localStorage.getItem('theme');var t=s||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body className="min-h-screen">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
