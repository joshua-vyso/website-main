import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Canonical host: redirect www.vyso.co.za → vyso.co.za (preserve path),
      // 308 permanent so search engines consolidate ranking on one domain.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.vyso.co.za" }],
        destination: "https://vyso.co.za/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
