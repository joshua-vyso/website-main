import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to THIS folder. Without this, a stray
  // ~/package-lock.json makes Next infer the home directory as the root, which
  // breaks module/path (@/*) resolution (see the "inferred workspace root" warning).
  turbopack: {
    root: __dirname,
  },
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
