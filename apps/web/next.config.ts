import type { NextConfig } from "next";
import path from "path";

// Required for app.blinkify.ai: rewrites proxy /auth, /workspaces, etc. to the API.
// If API_BACKEND_URL is missing at build time, rewrites are empty → signup/login/API calls 404.
const apiBackend = process.env.API_BACKEND_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Use monorepo root for file tracing so Next doesn't infer a wrong root (e.g. parent lockfile)
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
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
      { source: "/ad-styles", destination: `${apiBackend}/ad-styles` },
      { source: "/ad-styles/:path*", destination: `${apiBackend}/ad-styles/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tcbziypuirgizkqlslzw.supabase.co",
        pathname: "/storage/**",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/api/**",
      },
    ],
    // Serve 320w/378w/560w for common slots to reduce payload; 560 avoids 640 for ~557px display
    deviceSizes: [320, 378, 560, 640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
      // allowedOrigins: ["my-proxy.com", "*.my-proxy.com"],
    },
    optimizePackageImports: ["lucide-react", "@tabler/icons-react"],
  },
};

export default nextConfig;
