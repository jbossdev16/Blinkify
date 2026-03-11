import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";

export const metadata = {
  title: "Brand Assets — Blinkify",
  description: "Download Blinkify logos and icons in SVG and PNG. Use for press, partners, and marketing.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai"}/brand`,
  },
};

const LOGO_BASE = "/logo";

type Asset = {
  name: string;
  svg: string;
  png?: string;
  description: string;
};

const FULL_LOGOS: Asset[] = [
  { name: "Color", svg: "blinkify-logo-color.svg", png: "blinkify-logo-color.png", description: "Gradient icon + wordmark" },
  { name: "Black", svg: "blinkify-logo-black.svg", png: "blinkify-logo-black.png", description: "Solid black on light backgrounds" },
  { name: "White", svg: "blinkify-logo-white.svg", png: "blinkify-logo-white.png", description: "Solid white on dark backgrounds" },
];

const ICONS: Asset[] = [
  { name: "Color", svg: "blinkify-icon-color.svg", png: "blinkify-icon-color.png", description: "Gradient star" },
  { name: "Black", svg: "blinkify-icon-black.svg", png: "blinkify-icon-black.png", description: "Solid black" },
  { name: "White", svg: "blinkify-icon-white.svg", png: "blinkify-icon-white.png", description: "Solid white" },
];

function AssetCard({
  asset,
  type,
}: {
  asset: Asset;
  type: "logo" | "icon";
}) {
  const isWhite = asset.name === "White";
  const bg = isWhite ? "bg-neutral-900" : "bg-white";
  const border = isWhite ? "border-neutral-700" : "border-border";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={`p-6 ${bg} border-b ${border} flex items-center justify-center min-h-[120px]`}>
        <img
          src={`${LOGO_BASE}/${asset.svg}`}
          alt={`Blinkify ${type} — ${asset.name}`}
          className={type === "logo" ? "h-10 w-auto object-contain" : "h-16 w-16 object-contain"}
        />
      </div>
      <div className="p-4">
        <p className="text-sm font-normal text-foreground mb-1">{asset.name}</p>
        <p className="text-xs text-muted-foreground mb-4">{asset.description}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${LOGO_BASE}/${asset.svg}`}
            download
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-xs font-normal hover:bg-muted transition-colors"
          >
            Download SVG
          </a>
          {asset.png && (
            <a
              href={`${LOGO_BASE}/${asset.png}`}
              download
              className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-xs font-normal hover:bg-muted transition-colors"
            >
              Download PNG
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ScalePreview({
  src,
  label,
  size,
  logo,
}: {
  src: string;
  label: string;
  size: number;
  logo?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-center">
        {logo ? (
          <img src={src} alt="" className="object-contain" style={{ width: size, height: "auto" }} />
        ) : (
          <img src={src} alt="" className="object-contain" style={{ height: size, width: size }} />
        )}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-[100px] pb-16">
        <section className="mb-14">
          <h2 className="text-h4 font-normal text-foreground mb-6">Full Logo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FULL_LOGOS.map((asset) => (
              <AssetCard key={asset.name} asset={asset} type="logo" />
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="text-h4 font-normal text-foreground mb-6">Icon Only</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ICONS.map((asset) => (
              <AssetCard key={asset.name} asset={asset} type="icon" />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-h4 font-normal text-foreground mb-6">Scale Preview</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-normal text-foreground mb-4">Full logo (color)</h3>
              <div className="flex flex-wrap gap-8 items-end">
                <ScalePreview src={`${LOGO_BASE}/blinkify-logo-color.svg`} label="Small (280×64)" size={140} logo />
                <ScalePreview src={`${LOGO_BASE}/blinkify-logo-color.svg`} label="Medium (560×128)" size={280} logo />
                <ScalePreview src={`${LOGO_BASE}/blinkify-logo-color.svg`} label="Large (1120×256)" size={400} logo />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-normal text-foreground mb-4">Icon (color)</h3>
              <div className="flex flex-wrap gap-8 items-end">
                <ScalePreview src={`${LOGO_BASE}/blinkify-icon-color.svg`} label="64×64" size={64} />
                <ScalePreview src={`${LOGO_BASE}/blinkify-icon-color.svg`} label="128×128" size={128} />
                <ScalePreview src={`${LOGO_BASE}/blinkify-icon-color.svg`} label="256×256" size={256} />
              </div>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
