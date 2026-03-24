import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlinkifyLogo } from "@/components/blinkify-logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Link href="/" className="mb-8">
        <BlinkifyLogo variant="full" height={22} className="text-xl" />
      </Link>
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="mt-2 text-lg text-muted-foreground text-center max-w-sm">
        This page doesn&apos;t exist or was moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/creative-studio">Creative Studio</Link>
        </Button>
      </div>
    </div>
  );
}
