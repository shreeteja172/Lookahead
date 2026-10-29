import type { NextConfig } from "next";

// The studio is a client-side application (the parsing engine runs in the
// browser), so Cache Components / partial prefetching are not used.
const nextConfig: NextConfig = {
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
