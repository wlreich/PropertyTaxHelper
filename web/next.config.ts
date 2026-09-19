import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/guides/ParcelSavvy-Protest-Guide.pdf', headers: [
      { key: 'Content-Type', value: 'application/pdf' },
      { key: 'Content-Disposition', value: 'inline; filename="ParcelSavvy-Protest-Guide.pdf"' },
      { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
    ] }];
  },
};

export default nextConfig;
