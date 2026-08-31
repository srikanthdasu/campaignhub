import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure's zip-deploy pipeline silently drops dot-prefixed directories when packaging the
  // combined-server deployment, so the default `.next` build output never survived the trip —
  // the API would boot fine but Next.js would fail with "Could not find a production build".
  // A non-dot output dir sidesteps that entirely.
  distDir: "build-output",
};

export default nextConfig;
