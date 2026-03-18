import { useEffect, useRef } from "react";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { getTurnstileTokenForSubmit } from "../utils/turnstile";
import { setZKEmailTurnstileTokenProvider } from "../auth/zk-email/zk-email-signing-status";
import { TURNSTILE_SITE_KEY } from "../config";

/**
 * Hook for ZK-Email signing flows that need a Turnstile token.
 * Registers the token provider when active so the signer can obtain a token.
 * Returns refs and a widget to render.
 *
 * @param isActive - When true, registers the provider; when false, clears it.
 * @returns Object with turnstileRef, turnstileTokenRef, and renderTurnstile().
 */
export function useZKEmailTurnstileProvider(isActive: boolean) {
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isActive) return;
    setZKEmailTurnstileTokenProvider(() =>
      getTurnstileTokenForSubmit({
        execute: () => turnstileRef.current?.execute?.() ?? Promise.resolve(),
        getResponse: () => turnstileRef.current?.getResponse?.() ?? "",
        getRefToken: () => turnstileTokenRef.current,
      }),
    );
    return () => {
      setZKEmailTurnstileTokenProvider(null);
    };
  }, [isActive]);

  const renderTurnstile = () => {
    if (!isActive || !TURNSTILE_SITE_KEY) return null;
    return (
      <Turnstile
        ref={turnstileRef}
        siteKey={TURNSTILE_SITE_KEY}
        options={{ size: "invisible", execution: "execute" }}
        onSuccess={(token) => {
          turnstileTokenRef.current = token;
        }}
        onError={() => {
          turnstileTokenRef.current = null;
        }}
        onExpire={() => {
          turnstileTokenRef.current = null;
        }}
      />
    );
  };

  return { turnstileRef, turnstileTokenRef, renderTurnstile };
}
