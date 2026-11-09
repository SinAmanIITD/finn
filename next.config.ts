import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Left off deliberately: these experimental Next 16 flags (on by default
  // from create-next-app) were implicated in a production-only bug where
  // client pages using useSearchParams() (Research, Chat) got stuck on
  // their loading state forever - the underlying fetches succeeded, but
  // React state updates never reflected. Not worth the risk for an app
  // that doesn't need partial prerendering.
  // cacheComponents: true,
  // partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
