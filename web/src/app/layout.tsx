import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Property Tax Helper",
  description:
    "Search Travis County properties by partial address and review TCAD assessment records.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
