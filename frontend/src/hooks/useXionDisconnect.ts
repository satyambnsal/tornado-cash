/**
 * useXionDisconnect - Hook for disconnecting from XION auth
 *
 * Provides two disconnect functions:
 * - xionDisconnect: Full disconnect — clears session and notifies parent SDK
 *   (sends HARD_DISCONNECT, causing the SDK to tear down the iframe).
 * - switchAccount: Local disconnect — clears session but keeps the iframe alive.
 *   Used by "Use a different account" buttons so the user can re-login
 *   within the same iframe without a white-screen flash.
 */

import { useStytch } from "@stytch/react";
import { useAuthState } from "../auth/useAuthState";

export function useXionDisconnect() {
  const stytch = useStytch();
  const { logout } = useAuthState();

  const xionDisconnect = async () => {
    await logout(window.location.origin, stytch);
  };

  const switchAccount = async () => {
    await logout(window.location.origin, stytch, { notifyParent: false });
  };

  return { xionDisconnect, switchAccount };
}
