import { isUrlSafe } from "@burnt-labs/account-management";

/**
 * Constructs and returns a redirect URL with the specified parameters
 * @param redirectUri - The base redirect URI to use
 * @param granterId - Optional ID of the granter to append to the URL
 * @param state - Optional state parameter to preserve in redirect URL
 * @returns The constructed redirect URL or null if the redirect URI is invalid
 */
export const constructRedirectUrl = (
  redirectUri: string | null,
  granterId?: string,
  state?: string,
): string | null => {
  if (!redirectUri) return null;

  try {
    const url = new URL(redirectUri);
    const params = new URLSearchParams(url.search);

    if (granterId) {
      params.append("granted", "true");
      params.append("granter", granterId);
    }

    if (state) {
      params.append("state", state);
    }

    url.search = params.toString();
    return url.toString();
  } catch {
    return null;
  }
};

/**
 * Redirects to the dapp with the specified parameters
 * @param redirectUri - The redirect URI to use
 * @param granterId - Optional ID of the granter to append to the URL
 * @param state - Optional state parameter to preserve in redirect URL
 * @returns true if redirect was successful, false otherwise
 */
export const redirectToDapp = (
  redirectUri: string,
  granterId?: string,
  state?: string,
): boolean => {
  // First check if the redirect URI is safe
  if (!isUrlSafe(redirectUri)) {
    console.error(
      `Redirect blocked: URI "${redirectUri}" contains potentially malicious content`,
    );
    return false;
  }

  const redirectUrl = constructRedirectUrl(redirectUri, granterId, state);

  if (redirectUrl) {
    window.location.href = redirectUrl;
    return true;
  }
  return false;
};

/**
 * Safely redirects to a URI or optionally disconnects if no URI is provided
 * @param redirectUri - The redirect URI to use
 * @param setError - Function to set an error message if the redirect fails
 * @param disconnect - Function to disconnect if no redirect URI is provided and shouldDisconnect is true
 * @param granterId - Optional ID of the granter to append to the URL. This is only needed when redirecting after a successful grant operation
 * to inform the destination app about which account granted the permissions. It should be omitted when redirecting after a denied grant or in non-grant contexts.
 * @param shouldDisconnect - Optional flag to determine if disconnect should be called when no redirectUri is provided. Defaults to false.
 * @param state - Optional state parameter that may contain a redirect URL
 * @returns true if redirect was successful or disconnect was called, false if redirect failed
 */
export const safeRedirectOrDisconnect = (
  redirectUri: string | undefined | null,
  setError: (error: string) => void,
  disconnect: () => void,
  granterId?: string,
  shouldDisconnect: boolean = false,
  state?: string,
): boolean => {
  if (redirectUri) {
    const redirectSuccess = redirectToDapp(redirectUri, granterId, state);
    if (!redirectSuccess) {
      setError(
        "Redirect blocked: The URI contains potentially malicious content. Please contact the application developer.",
      );
      return false;
    }
    return true;
  } else if (shouldDisconnect) {
    disconnect();
    return true;
  }
  return true;
};
