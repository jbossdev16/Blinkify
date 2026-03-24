import { createSupabaseBrowserClient } from "./supabase";
import { getBrowserApiBaseUrl } from "./browser-api-base";

const IMAGE_GENERATION_TIMEOUT_MS = 150_000; // 2.5 min — server uses 2 min for Gemini

/**
 * Client-side fetch helper for the Blinkify API.
 * Reads the Supabase session token from the browser client.
 * Use only in client components / event handlers.
 * For long-running routes (e.g. /generate) pass options.signal or use the default long timeout.
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

  const controller = timeout != null ? new AbortController() : undefined;
  const timeoutId =
    controller && timeout
      ? setTimeout(() => controller.abort(), timeout)
      : undefined;

  try {
    const supabase = createSupabaseBrowserClient();
    let accessToken: string | undefined;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      accessToken = session?.access_token;
    } catch {
      throw new Error(
        "Could not reach the sign-in service. Check your network and Supabase URL / keys."
      );
    }

    const base = getBrowserApiBaseUrl();
    const res = await fetch(`${base}${path}`, {
      ...restInit,
      signal: controller?.signal ?? restInit.signal,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...restInit.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      let message: string;
      if (body && typeof body === "object") {
        if (typeof body.error === "string") {
          message = body.error;
        } else if (body.error && typeof body.error === "object" && typeof (body.error as { message?: unknown }).message === "string") {
          message = (body.error as { message: string }).message;
        } else if (res.status === 502) {
          message = path.includes("generate-video")
            ? "Video service unavailable. Check API key and Veo access."
            : "Image generation failed or timed out. Try again or a different prompt.";
        } else if (res.status === 503) {
          message = typeof body.error === "string" ? body.error : "Service temporarily unavailable. Please try again.";
        } else if (res.status === 413) {
          message =
            typeof body.error === "string"
              ? body.error
              : "Request too large (images were too big). Try smaller images or fewer attachments.";
        } else {
          message = `API error ${res.status}`;
        }
      } else {
        message =
          res.status === 413
            ? "Request too large (images were too big). Try smaller images or fewer attachments."
            : res.status === 503
              ? "Service temporarily unavailable. Please try again."
              : `API error ${res.status}`;
      }
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "Request took too long. Image and video generation can take 1–2 minutes; please try again."
      );
    }
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      throw new Error(
        "Could not reach the API. On local dev, start the backend (port 4001) and check NEXT_PUBLIC_API_URL."
      );
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
