import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Property Tax Helper",
  description: "Property tax transparency for Travis County homeowners. Coming soon.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
