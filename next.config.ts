import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
  },
  // Keep the rendering model aligned with lec13's App Router examples.
  cacheComponents: false,
  partialPrefetching: false,
  // Use native CSS handling. Rewriting *.css also renames *.module.css,
  // which removes its class exports and leaves components unstyled.
};

export default nextConfig;
