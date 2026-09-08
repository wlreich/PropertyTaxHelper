import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const manrope = localFont({ src: "../../fonts/manrope-latin-wght-normal.woff2", variable: "--font-manrope", weight: "200 800", display: "swap", fallback: ["Arial"], adjustFontFallback: "Arial" });
const inter = localFont({ src: "../../fonts/inter-latin-wght-normal.woff2", variable: "--font-inter", weight: "100 900", display: "swap", fallback: ["Arial"], adjustFontFallback: "Arial" });

export const metadata: Metadata = {
  title: "ParcelSavvy | Understand your assessment",
  description:
    "Know your property. Understand your assessment. Search Travis County property records with ParcelSavvy.",
  icons: { icon: "/brand/parcelsavvy-logo-mark.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
