/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output as a standalone Node.js server bundle – required for Render's Node web service.
  // This bundles the Next.js server and all dependencies into .next/standalone.
  output: "standalone",

  // Expose the WebSocket URL from build-time env to the browser bundle.
  env: {
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "",
  },
};

module.exports = nextConfig;
