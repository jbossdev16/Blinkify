# SEO & Google indexing

How Blinkify’s marketing site is set up for search and fast indexing.

---

## What’s in place

- **Sitemap** – `https://blinkify.ai/sitemap.xml`  
  Includes: `/`, `/waitlist`, `/brand`, `/privacy`, `/terms`, `/cookies`.  
  Dashboard, signin, signup, and reset-password are intentionally excluded (noindex / not in sitemap).

- **Robots** – `https://blinkify.ai/robots.txt`  
  Allows crawlers on marketing pages; disallows `/dashboard/`, `/signin`, `/signup`, `/reset-password`.  
  References the sitemap and (on production) includes a `Host` directive for Google.

- **Structured data (JSON-LD)**  
  On the marketing domain only: `Organization`, `WebSite`, `SoftwareApplication` so Google can understand the product and brand.

- **Metadata**  
  `metadataBase`, canonical URLs, Open Graph, Twitter cards, and targeted keywords (e.g. AI product photo generator, ad creative generator, eCommerce product photography) on the root layout and key pages.

- **Per-page SEO**  
  Title, description, and canonical set on `/waitlist`, `/brand`, `/privacy`, `/terms`, `/cookies`.

---

## Get indexed faster

1. **Google Search Console**  
   - Add property: `https://blinkify.ai` (and optionally `https://www.blinkify.ai` if you use www).  
   - Submit **Sitemaps** → add `https://blinkify.ai/sitemap.xml`.  
   - Use **URL Inspection** for the homepage and `/waitlist` and request indexing.

2. **Verification**  
   - In Search Console, pick a method (HTML tag or DNS).  
   - For HTML tag: set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in your production env to the value Google gives you. The root layout already injects the meta tag when this env is set. See `docs/PRODUCTION_ENVIRONMENT.md`.

3. **Optional: default OG image**  
   - Add `apps/web/public/og.png` (1200×630) for link previews.  
   - Root layout already references `/og.png` in Open Graph; remove or change that reference if you use a different path or no image.

4. **Bing Webmaster Tools**  
   - Add the site and submit the same sitemap URL for broader coverage.

---

## App domain (app.blinkify.ai)

When the app is deployed at `app.blinkify.ai`, the same codebase:

- Serves an empty sitemap and a robots.txt that disallows all crawlers, so the app is not indexed.
- Omits JSON-LD and sets `robots: noindex, nofollow` in metadata.

No extra config is required for the app subdomain from an SEO perspective.
