import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai";
const isAppDomain =
  typeof baseUrl === "string" && baseUrl.includes("app.blinkify.ai");

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: isAppDomain ? "Blinkify App" : "Blinkify",
    short_name: "Blinkify",
    description:
      "Upload your product. Get branded, ad-ready images instantly. AI-powered image generation for small businesses, eCommerce, and agencies.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/icon", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
