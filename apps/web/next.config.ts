import type { NextConfig } from "next";

// Required for app.blinkify.ai: rewrites proxy /auth, /workspaces, etc. to the API.
// If API_BACKEND_URL is missing at build time, rewrites are empty → signup/login/API calls 404.
const apiBackend = process.env.API_BACKEND_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/icon", permanent: false },
      { source: "/icon", destination: "/icon.svg", permanent: false },
    ];
  },
  async rewrites() {
    if (!apiBackend) return [];
    return [
      { source: "/health", destination: `${apiBackend}/health` },
      { source: "/me", destination: `${apiBackend}/me` },
      { source: "/auth/:path*", destination: `${apiBackend}/auth/:path*` },
      { source: "/checkout/:path*", destination: `${apiBackend}/checkout/:path*` },
      { source: "/workspaces/:path*", destination: `${apiBackend}/workspaces/:path*` },
      { source: "/invitations/:path*", destination: `${apiBackend}/invitations/:path*` },
      { source: "/admin/:path*", destination: `${apiBackend}/admin/:path*` },
      { source: "/waitlist/:path*", destination: `${apiBackend}/waitlist/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tcbziypuirgizkqlslzw.supabase.co",
        pathname: "/storage/**",
      },
    ],
    // Serve 320w for ~320px slots (demo cards) and 378w for bento to reduce payload vs default 640w
    deviceSizes: [320, 378, 640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
      // allowedOrigins: ["my-proxy.com", "*.my-proxy.com"],
    },
  },
};

export default nextConfig;
