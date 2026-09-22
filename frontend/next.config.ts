import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure's zip-deploy pipeline silently drops dot-prefixed directories when packaging the
  // combined-server deployment, so the default `.next` build output never survived the trip —
  // the API would boot fine but Next.js would fail with "Could not find a production build".
  // A non-dot output dir sidesteps that entirely.
  distDir: "build-output",
  // Lets next/image optimize media (resolveMediaUrl in lib/api.ts) served from either real
  // source: Azure Blob Storage in production (account name varies by deployment, hence the
  // wildcard), or the backend's own local-disk fallback in local dev, where the frontend
  // (port 3000) and backend (port 3001) are different origins. Production's local-disk fallback
  // path is same-origin relative ("/uploads/...") and needs no entry here — next/image handles
  // same-origin images natively.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.blob.core.windows.net" },
      { protocol: "http", hostname: "localhost", port: "3001" },
    ],
    // Next's SSRF guard refuses to proxy any URL that resolves to a loopback/private address by
    // default — which is exactly local dev's cross-origin backend (localhost:3001). Safe here
    // specifically because the URL always comes from resolveMediaUrl()/API_URL, never user input,
    // and production never takes this code path at all (its local-disk fallback URL is
    // same-origin relative, not proxied through this remote-pattern list). Scoped to dev only so
    // this stays off in the one place it could theoretically matter.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
};

export default nextConfig;
