import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-manrope",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai";
const isAppDomain =
  typeof baseUrl === "string" && baseUrl.includes("app.blinkify.ai");

const title = "Blinkify – Generate Product Images & Ad Creatives in 60 Seconds";
const description =
  "Upload your product. Get branded, ad-ready images instantly. AI-powered image generation for small businesses, eCommerce, and agencies.";
const siteName = "Blinkify";

const jsonLd = !isAppDomain
  ? JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", "@id": `${baseUrl}/#organization`, name: siteName, url: "https://blinkify.ai" },
        { "@type": "WebSite", "@id": `${baseUrl}/#website`, url: baseUrl, name: siteName, description, publisher: { "@id": `${baseUrl}/#organization` } },
      ],
    })
  : "";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title,
  description,
  keywords: [
    "AI image generation",
    "product photos",
    "ad creatives",
    "eCommerce",
    "product photography",
    "AI ads",
    "Blinkify",
  ],
  authors: [{ name: siteName, url: "https://blinkify.ai" }],
  creator: siteName,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName,
    title,
    description,
    url: baseUrl,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: isAppDomain
    ? { index: false, follow: false }
    : { index: true, follow: true },
  alternates: isAppDomain ? undefined : { canonical: baseUrl },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/Sunglasses.webp" as="image" />
        {!isAppDomain && jsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        ) : null}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=window.location.pathname;if((p.startsWith("/creative-studio")||p.startsWith("/brand")||p.startsWith("/billing")||p.startsWith("/asset-collection")||p.startsWith("/admin")||p.startsWith("/settings"))&&localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${manrope.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
