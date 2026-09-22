import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

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

export default withSentryConfig(nextConfig, {
  org: "sreematechhub",
  project: "javascript-nextjs",
  silent: true,
  // No SENTRY_AUTH_TOKEN configured — source map upload needs one, and readable stack traces
  // in the Sentry dashboard are a nice-to-have, not required for error capture/alerts to work.
  // Disabling this outright avoids the build depending on a secret we don't have and don't need
  // yet, rather than letting it silently no-op every build.
  sourcemaps: { disable: true },
});
