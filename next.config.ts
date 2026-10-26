import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photo uploads go through server actions (payment proofs up to 5 MB,
      // special-request sample photos resized in the browser to ~1 MB).
      // The 1 MB default would reject a normal phone screenshot.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
