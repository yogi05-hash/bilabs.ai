import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Old generic services page (£29-tier copy) → packaged pricing
      { source: "/services", destination: "/#pricing", permanent: true },
    ];
  },
};

export default nextConfig;
