import type { NextConfig } from "next";

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
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
      // allowedOrigins: ["my-proxy.com", "*.my-proxy.com"],
    },
  },
};

export default nextConfig;
