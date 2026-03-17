import { HeroForm, DemoVideoPlayer } from "./hero-interactives";

const leftMessages: { label: string; color: string }[] = [
  { label: "Higher Ad Conversion", color: "text-[#7c3aed]" },
  { label: "Lower Cost", color: "text-[#2563eb]" },
  { label: "10x More Content", color: "text-[#db2777]" },
];
const rightMessages: { label: string; color: string }[] = [
  { label: "No Designer Needed", color: "text-[#059669]" },
  { label: "Brand-Consistent", color: "text-[#7c3aed]" },
  { label: "Launch in Minutes", color: "text-[#dc2626]" },
];

function MessagePill({
  label,
  color,
  tilt,
}: {
  label: string;
  color: string;
  tilt: string;
}) {
  return (
    <span
      className={`rounded-full bg-white px-4 py-2.5 text-xs font-semibold shadow-lg border border-black/5 whitespace-nowrap ${color} ${tilt}`}
    >
      {label}
    </span>
  );
}

export function HeroSection() {
  return (
    <section className="relative flex-none md:flex-1 bg-[#ffffff] overflow-x-hidden">
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 pt-18 pb-12 lg:pt-24 lg:pb-28">
        {/* Desktop: row with [left pills] [center] [right pills] */}
        <div className="hidden md:flex md:items-center md:justify-between md:gap-8">
          <div className="flex flex-col gap-3 shrink-0 pointer-events-none z-20 w-[160px] items-end justify-center">
            <MessagePill
              label={leftMessages[0].label}
              color={leftMessages[0].color}
              tilt="-rotate-2 self-end"
            />
            <MessagePill
              label={leftMessages[1].label}
              color={leftMessages[1].color}
              tilt="rotate-1 self-start ml-4"
            />
            <MessagePill
              label={leftMessages[2].label}
              color={leftMessages[2].color}
              tilt="-rotate-2 self-end"
            />
          </div>

          <div className="relative max-w-3xl mx-auto text-center flex-1 min-w-0">
            <div
              className="pointer-events-none absolute inset-[-40px] sm:inset-[-56px] -z-10 blur-3xl opacity-90"
              aria-hidden
            >
              <div className="mx-auto h-full w-full max-w-2xl bg-[radial-gradient(ellipse_80%_50%_at_20%_30%,rgba(59,130,246,0.25),_transparent_50%),radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.2),_transparent_55%),radial-gradient(ellipse_70%_50%_at_80%_70%,rgba(249,115,22,0.2),_transparent_50%),radial-gradient(ellipse_50%_50%_at_70%_20%,rgba(239,68,68,0.15),_transparent_55%)]" />
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-2">
              Ad creatives that convert,
            </h1>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-6 md:mb-7">
              <span className="text-gradient-brand">10x Faster & Cheaper.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#000000] max-w-xl mx-auto mb-7 md:mb-8 leading-relaxed">
              Upload once, get scroll-stopping visuals in seconds.
            </p>
            <HeroForm />
          </div>

          <div className="flex flex-col gap-3 shrink-0 pointer-events-none z-20 w-[160px] items-start justify-center">
            <MessagePill
              label={rightMessages[0].label}
              color={rightMessages[0].color}
              tilt="rotate-2 self-start"
            />
            <MessagePill
              label={rightMessages[1].label}
              color={rightMessages[1].color}
              tilt="-rotate-1 self-end mr-4"
            />
            <MessagePill
              label={rightMessages[2].label}
              color={rightMessages[2].color}
              tilt="rotate-2 self-start"
            />
          </div>
        </div>

        {/* Mobile: center content only */}
        <div className="md:hidden relative max-w-3xl mx-auto text-center">
          <div
            className="pointer-events-none absolute inset-[-40px] sm:inset-[-56px] -z-10 blur-3xl opacity-90"
            aria-hidden
          >
            <div className="mx-auto h-full w-full max-w-2xl bg-[radial-gradient(ellipse_80%_50%_at_20%_30%,rgba(59,130,246,0.25),_transparent_50%),radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.2),_transparent_55%),radial-gradient(ellipse_70%_50%_at_80%_70%,rgba(249,115,22,0.2),_transparent_50%),radial-gradient(ellipse_50%_50%_at_70%_20%,rgba(239,68,68,0.15),_transparent_55%)]" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-2">
            Ad creatives that convert,
          </h1>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-6 md:mb-7">
            <span className="text-gradient-brand">10x Faster & Cheaper.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#000000] max-w-xl mx-auto mb-7 md:mb-8 leading-relaxed">
            Upload once, get scroll-stopping visuals in seconds.
          </p>
          <HeroForm />
        </div>

        {/* Demo video */}
        <div className="relative mt-18 sm:mt-20 lg:mt-28">
          <div className="relative w-full rounded-xl border border-black/5 bg-slate-100 overflow-hidden aspect-[16/9]">
            <DemoVideoPlayer />
          </div>
        </div>
      </div>
    </section>
  );
}
