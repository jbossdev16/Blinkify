import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-HMR900832T";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-manrope",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai";
const isAppDomain =
  typeof baseUrl === "string" && baseUrl.includes("app.blinkify.ai");

const title =
  "Blinkify — AI Ad Creative Generator | Product Photo to Campaign in 3 Minutes";
const description =
  "AI-powered marketing campaigns from one product photo — Meta ads, TikTok, video, email, and social copy for ecommerce brands.";
const siteName = "Blinkify";

const jsonLd = !isAppDomain
  ? JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      url: "https://blinkify.ai",
      description,
      publisher: {
        "@type": "Organization",
        name: siteName,
        url: "https://blinkify.ai",
      },
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
    images: [
      {
        url: "/logo/blinkify-logo-color-white-bg.png",
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/logo/blinkify-logo-color-white-bg.png"],
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
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
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
        {/* Defer gtag until browser idle (or timeout) so LCP/FCP aren’t competing with GTM parse/eval */}
        <Script id="google-analytics-deferred" strategy="afterInteractive">
          {`
(function(){
  var id='${GA_MEASUREMENT_ID}';
  function load(){
    if(window.__blinkifyGtag)return;window.__blinkifyGtag=1;
    var s=document.createElement('script');
    s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);
    s.async=true;
    document.head.appendChild(s);
    s.onload=function(){
      window.dataLayer=window.dataLayer||[];
      function gtag(){dataLayer.push(arguments);}
      window.gtag=gtag;
      gtag('js',new Date());
      gtag('config',id,{cookie_flags:'SameSite=None;Secure'});
    };
  }
  if(typeof requestIdleCallback!=='undefined'){
    requestIdleCallback(load,{timeout:4000});
  }else{
    setTimeout(load,2800);
  }
})();`}
        </Script>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
