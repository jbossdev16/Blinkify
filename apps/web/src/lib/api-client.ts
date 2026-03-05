import { createSupabaseBrowserClient } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

const IMAGE_GENERATION_TIMEOUT_MS = 150_000; // 2.5 min — server uses 2 min for Gemini

/**
 * Client-side fetch helper for the Blinkify API.
 * Reads the Supabase session token from the browser client.
 * Use only in client components / event handlers.
 * For long-running routes (e.g. /generate) pass options.signal or use the default long timeout.
 * Pass timeoutMs to override the default timeout. Pass signal to allow external cancellation.
 * Both signals are combined: either a timeout or an external abort will cancel the request.
 */
export async function apiClientFetch<T = unknown>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs, ...restInit } = init ?? {};
  const isLongRunning =
    path.includes("/generate") && !path.includes("/generations");
  const timeout =
    timeoutMs ?? (isLongRunning ? IMAGE_GENERATION_TIMEOUT_MS : undefined);

  const timeoutController = timeout != null ? new AbortController() : undefined;
  const timeoutId =
    timeoutController && timeout
      ? setTimeout(() => timeoutController.abort(), timeout)
      : undefined;
  let timedOut = false;
  if (timeoutController) {
    timeoutController.signal.addEventListener("abort", () => { timedOut = true; }, { once: true });
  }

  const signals: AbortSignal[] = [];
  if (timeoutController) signals.push(timeoutController.signal);
  if (restInit.signal) signals.push(restInit.signal);
  const combinedSignal = signals.length > 0 ? AbortSignal.any(signals) : undefined;

  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(`${API_URL}${path}`, {
      ...restInit,
      signal: combinedSignal,
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token && {
          Authorization: `Bearer ${session.access_token}`,
        }),
        ...restInit.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message =
        body && typeof body === "object" && typeof body.error === "string"
          ? body.error
          : res.status === 502
            ? (path.includes("generate-video")
                ? "Video service unavailable. Check API key and Veo access."
                : "Image generation failed or timed out. Try again or a different prompt.")
            : `API error ${res.status}`;
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      if (timedOut) {
        throw new Error(
          "Request took too long. Image and video generation can take 1–2 minutes; please try again."
        );
      }
      throw new Error("Generation cancelled.");
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
