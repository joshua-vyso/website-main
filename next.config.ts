import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to THIS folder. Without this, a stray
  // ~/package-lock.json makes Next infer the home directory as the root, which
  // breaks module/path (@/*) resolution (see the "inferred workspace root" warning).
  turbopack: {
    root: __dirname,
  },
  // Only pull the modules actually used from these large barrel-export packages
  // (the animation runtime is on every marketing page). No-ops for any listed
  // package that isn't a barrel.
  experimental: {
    optimizePackageImports: ['framer-motion', 'motion'],
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
      // Retired marketing URLs now consolidate on their canonical replacements.
      {
        source: "/about",
        destination: "/platform",
        permanent: true,
      },
      // Finch rebrand (was "Vyso AI").
      {
        source: "/platform/vyso-ai",
        destination: "/platform/finch",
        permanent: true,
      },
      {
        source: "/apps",
        destination: "/platform/vyso-for-smes",
        permanent: true,
      },
      {
        source: "/services",
        destination: "/pricing",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
