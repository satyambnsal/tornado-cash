import { useEffect, useState } from "react";
import {
  subscribeZKEmailSigningStatus,
  type ZKEmailSigningStatus,
} from "../auth/zk-email/zk-email-signing-status";

/**
 * Subscribe to zk-email signing status (email sent, waiting for reply, generating proof).
 * Used by SigningModal, AddAuthenticatorsForm, and RemoveAuthenticatorForm to show
 * status when the user is signing a transaction with zk-email.
 * @param enabled - When false, the subscription is not set up and null is returned. Pass true only when connectionMethod is zk-email to avoid unnecessary work.
 */
export function useZKEmailSigningStatus(
  enabled: boolean = true,
): ZKEmailSigningStatus | null {
  const [status, setStatus] = useState<ZKEmailSigningStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return subscribeZKEmailSigningStatus(setStatus);
  }, [enabled]);

  return enabled ? status : null;
}
