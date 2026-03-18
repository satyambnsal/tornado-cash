import { useEffect, useState } from "react";
import { getHumanReadablePubkey } from "../utils";
import { loadChainConfig } from "../config/chain";
import type { ChainInfo } from "../types/chain";
import { isUrlSafe } from "@burnt-labs/account-management";
import {
  OAUTH_CALLBACK_URL,
  STYTCH_PROXY_URL,
  ABSTRAXION_API_URL,
  CHAIN_ID,
} from "../config";

/**
 * Wallet error structure
 * - MetaMask errors have a numeric code (4001 for user rejection)
 * - Keplr/OKX errors have descriptive messages
 */
interface WalletError {
  code?: number | string;
  message?: string;
}

/**
 * Type guard to check if an error is a WalletError
 */
function isWalletError(error: unknown): error is WalletError {
  return (
    typeof error === "object" &&
    error !== null &&
    ("code" in error || "message" in error)
  );
}

type CallbackType =
  | "oauth"
  | "external-oauth"
  | "keplr"
  | "okx"
  | "metamask"
  | null;

// Parse JWT without verification (for extracting claims)
function parseJwt(token: string): Record<string, unknown> {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );
  return JSON.parse(jsonPayload);
}

interface OAuthContext {
  originalRedirectUri: string;
  originalState: string | null;
  codeVerifier: string;
  // IDP info from the initiating request
  idpTokenEndpoint: string;
  idpClientId: string;
  // Stytch Trusted Auth Token profile ID for this IDP
  trustedAuthProfileId: string;
}

export function Callback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("Processing...");
  const [callbackType, setCallbackType] = useState<CallbackType>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const stytchTokenType = urlParams.get("stytch_token_type");
        const walletType = urlParams.get("wallet") as
          | "keplr"
          | "okx"
          | "metamask"
          | null;

        // External OAuth flow params (from external IDP like demo app)
        const code = urlParams.get("code");
        const state = urlParams.get("state");

        console.log("[Callback] Received params:", {
          token: token ? "present" : "missing",
          code: code ? "present" : "missing",
          state: state ? "present" : "missing",
          stytchTokenType,
          walletType,
        });

        // Handle external OAuth callback (from demo app IDP)
        if (code) {
          setCallbackType("external-oauth");
          await handleExternalOAuthCallback(code, state);
          return;
        }

        // Handle OAuth callback (Google/Apple popup flow)
        if (token) {
          setCallbackType("oauth");
          handleOAuthCallback(token, stytchTokenType);
          return;
        }

        // Handle wallet connection
        if (walletType) {
          setCallbackType(walletType);
          await handleWalletConnection(walletType);
          return;
        }

        // No valid callback type
        setStatus("error");
        setMessage(
          "Invalid callback - no token, code, or wallet type specified",
        );
      } catch (err) {
        console.error("[Callback] Error:", err);
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Unknown error");
      }
    };

    handleCallback();
  }, []);

  // Handle external OAuth callback from IDP (e.g., demo app)
  const handleExternalOAuthCallback = async (
    code: string,
    idpState: string | null,
  ) => {
    console.log("[Callback] Handling external OAuth callback");

    // Validate state
    const savedState = sessionStorage.getItem("oauth_state");
    if (idpState !== savedState) {
      setStatus("error");
      setMessage("State mismatch - possible CSRF attack");
      return;
    }

    // Get stored context
    const contextStr = sessionStorage.getItem("oauth_context");
    if (!contextStr) {
      setStatus("error");
      setMessage("OAuth session expired");
      return;
    }

    const context: OAuthContext = JSON.parse(contextStr);

    // Validate required IDP info
    if (!context.idpTokenEndpoint || !context.idpClientId) {
      setStatus("error");
      setMessage("Invalid OAuth context - missing IDP configuration");
      return;
    }

    try {
      // Exchange code for tokens
      setMessage("Verifying authentication...");
      const tokens = await exchangeCodeForTokens(
        code,
        context.codeVerifier,
        context,
      );

      // Create XION account
      setMessage("Creating your XION account...");
      const { address, email } = await createXionAccountFromExternalToken(
        tokens.id_token,
        context.trustedAuthProfileId,
      );

      // Clean up
      sessionStorage.removeItem("oauth_context");
      sessionStorage.removeItem("oauth_state");

      // If there's an original redirect URI, redirect back with account info
      if (
        context.originalRedirectUri &&
        isUrlSafe(context.originalRedirectUri)
      ) {
        setStatus("success");
        setMessage("Connected! Redirecting...");

        const redirectUrl = new URL(context.originalRedirectUri);
        redirectUrl.searchParams.set("xion_address", address);
        if (context.originalState) {
          redirectUrl.searchParams.set("state", context.originalState);
        }
        if (email) {
          redirectUrl.searchParams.set("email", email);
        }

        // Redirect after a short delay to show success
        setTimeout(() => {
          window.location.href = redirectUrl.toString();
        }, 1500);
      } else {
        // No redirect URI - just show success
        setStatus("success");
        setMessage(`XION account created: ${address}`);
      }
    } catch (e) {
      console.error("[Callback] External OAuth error:", e);
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Authentication failed");
    }
  };

  // Exchange authorization code for tokens from external IDP
  const exchangeCodeForTokens = async (
    authCode: string,
    codeVerifier: string,
    context: OAuthContext,
  ) => {
    const response = await fetch(context.idpTokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: OAUTH_CALLBACK_URL,
        client_id: context.idpClientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error_description ||
          errorData.error ||
          "Token exchange failed",
      );
    }

    return response.json();
  };

  // Create XION account from external IDP token via Trusted Auth Tokens
  const createXionAccountFromExternalToken = async (
    idToken: string,
    trustedAuthProfileId: string,
  ): Promise<{ address: string; email: string | null }> => {
    // Parse the ID token to get user info
    const claims = parseJwt(idToken);
    console.log("[Callback] ID token claims:", claims);
    const email = (claims.email as string) || null;

    console.log("[Callback] Attesting external token with Stytch...");
    const attestResponse = await fetch(`${STYTCH_PROXY_URL}/sessions/attest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile_id: trustedAuthProfileId,
        token: idToken,
        session_duration_minutes: 60 * 24 * 30, // 30 days
      }),
    });

    if (!attestResponse.ok) {
      const errorData = await attestResponse.json().catch(() => ({}));
      console.error("[Callback] Attest failed:", errorData);
      throw new Error(
        errorData.error_message ||
          errorData.error ||
          "Failed to attest external token",
      );
    }

    const attestData = await attestResponse.json();
    console.log("[Callback] External token attested successfully");

    // Now create the XION account using the Stytch session
    console.log("[Callback] Creating XION account with Stytch session...");
    const res = await fetch(
      `${ABSTRAXION_API_URL}/api/v2/accounts/create/jwt`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          session_jwt: attestData.session_jwt,
          session_token: attestData.session_token,
        }),
      },
    );

    const body = await res.json();
    if (!res.ok) {
      throw new Error(
        body.error?.message || body.error || "Failed to create account",
      );
    }

    console.log("[Callback] XION account created:", body.account_address);
    return { address: body.account_address, email };
  };

  const handleOAuthCallback = (
    token: string,
    stytchTokenType: string | null,
  ) => {
    // Redirect-within-popup: OAuth happened as a redirect inside the popup window.
    // Restore the original dashboard URL params and pass the token via hash.
    const savedParams = sessionStorage.getItem("popup_oauth_params");
    if (savedParams) {
      console.log(
        "[Callback] Redirect-within-popup: restoring params and passing token",
      );
      sessionStorage.removeItem("popup_oauth_params");
      const redirectUrl = new URL(window.location.origin);
      redirectUrl.search = savedParams;
      redirectUrl.hash = `oauth_token=${encodeURIComponent(token)}&token_type=${encodeURIComponent(stytchTokenType || "oauth")}`;
      setStatus("success");
      setMessage("Authentication successful! Redirecting...");
      setTimeout(() => {
        window.location.href = redirectUrl.toString();
      }, 500);
      return;
    }

    // Check if this was opened as a popup (has opener)
    if (window.opener) {
      console.log("[Callback] Sending OAuth token to opener (popup flow)");
      window.opener.postMessage(
        {
          type: "OAUTH_SUCCESS",
          token,
          stytchTokenType,
        },
        window.location.origin,
      );

      setStatus("success");
      setMessage(
        "Authentication successful! This window will close automatically.",
      );

      // Close the popup after a short delay
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      // Main window flow - redirect to root with token in hash
      console.log(
        "[Callback] Redirecting to main app with OAuth token (main window flow)",
      );
      setStatus("success");
      setMessage("Authentication successful! Redirecting...");

      // Redirect to root with token in URL hash (more secure than query params)
      const redirectUrl = new URL(window.location.origin);
      redirectUrl.hash = `oauth_token=${encodeURIComponent(token)}&token_type=${encodeURIComponent(stytchTokenType || "oauth")}`;

      setTimeout(() => {
        window.location.href = redirectUrl.toString();
      }, 500);
    }
  };

  const handleWalletConnection = async (
    walletType: "keplr" | "okx" | "metamask",
  ) => {
    setMessage(`Connecting to ${walletType.toUpperCase()} wallet...`);

    try {
      // Load chain info
      const networks = await loadChainConfig();
      const network = CHAIN_ID.includes("mainnet")
        ? networks.mainnet
        : networks.testnet;

      let result: { type: string; data: Record<string, unknown> };

      switch (walletType) {
        case "keplr":
          result = await connectKeplr(network);
          break;
        case "okx":
          result = await connectOkx(network);
          break;
        case "metamask":
          result = await connectMetamask();
          break;
        default:
          throw new Error(`Unknown wallet type: ${walletType}`);
      }

      if (window.opener) {
        console.log(
          "[Callback] Sending wallet connection result to opener:",
          result,
        );
        window.opener.postMessage(result, window.location.origin);

        setStatus("success");
        setMessage("Wallet connected! This window will close automatically.");

        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        setStatus("error");
        setMessage(
          "No opener window found. Please close this window and try again.",
        );
      }
    } catch (error) {
      console.error("[Callback] Wallet connection error:", error);

      // Check if this is a user cancellation/rejection
      const userCancelled =
        isWalletError(error) &&
        (error.code === 4001 || // MetaMask user rejection
          error.message?.includes("Request rejected") || // Keplr/OKX
          error.message?.includes("User denied")); // Alternative Keplr message

      if (userCancelled) {
        console.log(
          `[Callback] User cancelled ${walletType} connection - closing silently`,
        );
        // Don't send error to parent - just close popup
        // This allows user to stay on login screen and try again
        setMessage("Connection cancelled");
        setTimeout(() => {
          window.close();
        }, 500);
        return;
      }

      // Real error (wallet not installed, network error, etc.) - notify parent
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "WALLET_ERROR",
            walletType,
            error: error instanceof Error ? error.message : "Connection failed",
          },
          window.location.origin,
        );
      }

      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Wallet connection failed",
      );

      setTimeout(() => {
        window.close();
      }, 3000);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        background: "hsl(0, 0%, 7%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <style>{`
        body {
          background: hsl(0, 0%, 7%) !important;
          margin: 0;
        }
      `}</style>

      <div
        style={{
          textAlign: "center",
          padding: "2rem",
        }}
      >
        {status === "loading" && (
          <>
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "3px solid rgba(255,255,255,0.3)",
                borderTopColor: "white",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 1rem",
              }}
            />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}

        {status === "success" && (
          <div
            style={{
              fontSize: "2rem",
              marginBottom: "1rem",
            }}
          >
            ✓
          </div>
        )}

        {status === "error" && (
          <div
            style={{
              fontSize: "2rem",
              marginBottom: "1rem",
              color: "#ff6b6b",
            }}
          >
            ✗
          </div>
        )}

        <p style={{ margin: 0, opacity: 0.9 }}>{message}</p>

        {callbackType && (
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.875rem",
              opacity: 0.6,
              textTransform: "capitalize",
            }}
          >
            {callbackType === "oauth"
              ? "OAuth"
              : callbackType === "external-oauth"
                ? "External Identity"
                : callbackType}{" "}
            Authentication
          </p>
        )}
      </div>
    </div>
  );
}

// Wallet connection functions
async function connectKeplr(
  network: ChainInfo,
): Promise<{ type: string; data: Record<string, unknown> }> {
  if (!window.keplr) {
    throw new Error(
      "Keplr wallet extension not found. Please install it first.",
    );
  }

  try {
    await window.keplr.experimentalSuggestChain(network);
  } catch (e) {
    console.log("[Callback] Chain already exists or suggest failed:", e);
  }

  await window.keplr.enable(network.chainId);
  const key = await window.keplr.getKey(network.chainId);
  const authenticator = getHumanReadablePubkey(key.pubKey);

  return {
    type: "WALLET_SUCCESS",
    data: {
      walletType: "keplr",
      authenticator,
      address: key.bech32Address,
      name: key.name,
    },
  };
}

async function connectOkx(
  network: ChainInfo,
): Promise<{ type: string; data: Record<string, unknown> }> {
  if (!window.okxwallet?.keplr) {
    throw new Error("OKX wallet extension not found. Please install it first.");
  }

  const keplr = window.okxwallet.keplr;

  try {
    await keplr.experimentalSuggestChain(network);
  } catch (e) {
    console.log("[Callback] Chain already exists or suggest failed:", e);
  }

  await keplr.enable(network.chainId);
  const okxAccount = await keplr.getKey(network.chainId);
  const authenticator = getHumanReadablePubkey(okxAccount.pubKey);

  return {
    type: "WALLET_SUCCESS",
    data: {
      walletType: "okx",
      authenticator,
      address: okxAccount.bech32Address,
      name: okxAccount.name,
    },
  };
}

async function connectMetamask(): Promise<{ type: string; data: Record<string, unknown> }> {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask wallet extension not found. Please install it first.",
    );
  }

  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found in MetaMask");
  }

  const primaryAccount = accounts[0];

  return {
    type: "WALLET_SUCCESS",
    data: {
      walletType: "metamask",
      authenticator: primaryAccount,
      address: primaryAccount,
    },
  };
}
