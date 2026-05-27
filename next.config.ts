import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The portal is mounted under nexopstech.com/portal via the main site rewrites.
  basePath: "/portal",
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
