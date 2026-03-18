/**
 * ExternalOAuthFlow - Initiates OAuth flow with external Identity Provider
 *
 * This component handles ONLY the redirect to the external IDP.
 * The callback is handled by Callback.tsx at /oauth/callback
 *
 * Flow:
 * 1. Third-party app (or user) initiates connection to XION via /external-auth
 * 2. This component redirects to the external Identity Provider (demo app)
 * 3. User authenticates with IDP and consents
 * 4. IDP redirects back to /oauth/callback with authorization code
 * 5. Callback.tsx handles token exchange and account creation
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Banner, Dialog, DialogContent, Button } from "../ui";
import { DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import SpinnerV2 from "../ui/icons/SpinnerV2";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { OAUTH_CALLBACK_URL } from "../../config";

type FlowState = "loading" | "redirecting" | "error";

interface OAuthContext {
  originalRedirectUri: string;
  originalState: string | null;
  codeVerifier: string;
  // IDP info stored for callback to use
  idpTokenEndpoint: string;
  idpClientId: string;
}

// PKCE helpers
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function LoginExternalAuth() {
  const [searchParams] = useSearchParams();
  const flowStartedRef = useRef(false);

  // IDP configuration from query params (required)
  const idpAuthEndpoint = searchParams.get("idp_auth_url");
  const idpTokenEndpoint = searchParams.get("idp_token_url");
  const idpClientId = searchParams.get("client_id");

  // Params from the original requesting app (where to redirect after success)
  const originalRedirectUri = searchParams.get("redirect_uri");
  const originalState = searchParams.get("state");

  const [flowState, setFlowState] = useState<FlowState>("loading");
  const [error, setError] = useState<string | null>(null);

  // Start OAuth flow - redirect to IDP
  const startOAuthFlow = useCallback(async () => {
    // Prevent double-execution in React strict mode
    if (flowStartedRef.current) {
      console.log("[ExternalOAuthFlow] Flow already started, skipping");
      return;
    }
    flowStartedRef.current = true;

    // Validate required params
    if (!idpAuthEndpoint || !idpTokenEndpoint || !idpClientId) {
      setError(
        "Missing required IDP configuration. Required params: idp_auth_url, idp_token_url, client_id",
      );
      setFlowState("error");
      return;
    }

    setFlowState("redirecting");

    try {
      // Generate PKCE values
      const codeVerifier = generateRandomString(32);
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateRandomString(16);

      // Store context for when we return from IDP (used by Callback.tsx)
      const context: OAuthContext = {
        originalRedirectUri: originalRedirectUri || "",
        originalState: originalState,
        codeVerifier,
        idpTokenEndpoint,
        idpClientId,
      };
      sessionStorage.setItem("oauth_context", JSON.stringify(context));
      sessionStorage.setItem("oauth_state", state);

      // Build authorization URL to external IDP
      const authUrl = new URL(idpAuthEndpoint);
      authUrl.searchParams.set("client_id", idpClientId);
      authUrl.searchParams.set("redirect_uri", OAUTH_CALLBACK_URL);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");

      console.log(
        "[ExternalOAuthFlow] Redirecting to IDP:",
        authUrl.toString(),
      );

      // Redirect to IDP
      window.location.href = authUrl.toString();
    } catch (e) {
      console.error("[ExternalOAuthFlow] Failed to start OAuth flow:", e);
      setError("Failed to start authentication");
      setFlowState("error");
    }
  }, [
    idpAuthEndpoint,
    idpTokenEndpoint,
    idpClientId,
    originalRedirectUri,
    originalState,
  ]);

  // Start the OAuth flow on mount
  useEffect(() => {
    startOAuthFlow();
  }, [startOAuthFlow]);

  // Render based on flow state
  const renderContent = () => {
    switch (flowState) {
      case "loading":
      case "redirecting":
        return (
          <>
            <DialogHeader>
              <DialogTitle>
                <VisuallyHidden.Root>Connecting</VisuallyHidden.Root>
              </DialogTitle>
            </DialogHeader>
            <div className="ui-flex ui-flex-col ui-items-center ui-justify-center ui-py-16 ui-gap-4">
              <SpinnerV2 size="lg" color="black" />
              <p className="ui-text-muted-foreground ui-text-body">
                Redirecting to identity provider...
              </p>
            </div>
          </>
        );

      case "error":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Connection Failed</DialogTitle>
            </DialogHeader>
            <p className="ui-text-muted-foreground ui-text-body ui-py-4">
              {error || "Something went wrong. Please try again."}
            </p>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => window.history.back()}
              >
                Go Back
              </Button>
              <Button
                onClick={() => {
                  flowStartedRef.current = false;
                  startOAuthFlow();
                }}
              >
                Try Again
              </Button>
            </DialogFooter>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="ui-flex ui-w-full ui-h-svh ui-items-center ui-justify-center ui-bg-background">
      <Banner className="ui-fixed ui-top-0 ui-left-0 ui-z-[10001]" />
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent>{renderContent()}</DialogContent>
      </Dialog>
    </div>
  );
}
