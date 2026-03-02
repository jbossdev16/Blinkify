import { Spinner } from "./spinner";

/**
 * Full-page centered loading state for route transitions.
 * Shows a minimal spinner with subtle fade-in.
 */
export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] lg:min-h-screen px-6">
      <Spinner size="lg" className="text-muted-foreground" />
    </div>
  );
}
