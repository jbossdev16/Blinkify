"use client";

const STEP_KEY = "blinkify:onboarding:step";
const BRAND_DONE_KEY = "blinkify:onboarding:brand_done";
const GENERATED_KEY = "blinkify:onboarding:generated";
const WELCOME_SEEN_KEY = "blinkify:onboarding:welcome_seen";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new Event("blinkify:onboarding-change"));
  } catch {
    /* ignore */
  }
}

export function useOnboarding() {
  const getStep = () => safeGet(STEP_KEY) ?? "0";

  const setStep = (step: string) => safeSet(STEP_KEY, step);

  const isDone = () => getStep() === "done";

  const isNew = () => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    const step = getStep();
    return params.get("new") === "true" || step === "0" || step === "1";
  };

  const markBrandDone = () => {
    safeSet(BRAND_DONE_KEY, "true");
    setStep("2");
  };

  const markGenerated = () => {
    safeSet(GENERATED_KEY, "true");
    setStep("done");
  };

  const dismiss = () => setStep("done");

  const brandDone = () => safeGet(BRAND_DONE_KEY) === "true";

  const hasGenerated = () => safeGet(GENERATED_KEY) === "true";

  const welcomeSeen = () => safeGet(WELCOME_SEEN_KEY) === "true";
  const markWelcomeSeen = () => safeSet(WELCOME_SEEN_KEY, "true");

  return {
    getStep,
    setStep,
    isDone,
    isNew,
    markBrandDone,
    markGenerated,
    dismiss,
    brandDone,
    hasGenerated,
    welcomeSeen,
    markWelcomeSeen,
  };
}
