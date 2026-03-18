/**
 * AbstraxionSignin - Login UI component for XION authentication
 *
 * This component has been updated to use AuthStateManager for login state management.
 * Key changes:
 * - Uses startLogin, completeLogin, setOkxData from useAuthState
 * - No more direct localStorage.setItem calls - AuthStateManager handles it
 * - Cleaner flow: startLogin() when auth starts, completeLogin() when account is ready
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { stytchClient as stytchClientSingleton } from "../../hooks/useStytchClient";
import { get } from "@github/webauthn-json/browser-ponyfill";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  KeplrLogo,
  MetamaskLogo,
  NavigationButton,
  PasskeyIcon,
  AppleLogoIcon,
  ZKEmailIcon,
} from "../ui";
import { AuthContext, AuthContextProps } from "../AuthContext";
import { getHumanReadablePubkey } from "../../utils";
import {
  convertToStandardBase64,
  registeredCredentials,
} from "../../auth/passkey";
import okxLogo from "../../assets/okx-logo.png";
import LoginOtpForm from "../LoginOtpForm";
import { GoogleLogoIcon } from "../ui/icons/GoogleLogo";
import { TikTokLogoIcon } from "../ui/icons/TikTokLogo";
import { ZKEmailLogin } from "./ZKEmailLogin";
import { ChevronRightIcon } from "../ui/icons/ChevronRight";
import SpinnerV2 from "../ui/icons/SpinnerV2";
import xionLogo from "../../assets/logo.png";
import { useAuthState, CONNECTION_METHOD } from "../../auth/useAuthState";
import { AuthStateManager } from "../../auth/AuthStateManager";
import { getLoginAuthenticatorFromJWT } from "../../auth/session";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import {
  FEATURE_FLAGS,
  getStytchPublicToken,
  isMainnet,
  STYTCH_PROXY_URL,
} from "../../config";
import { Separator } from "../ui/separator";
import { SecuredByXion } from "../ui/SecuredByXion";
import { useQueryParams } from "../../hooks/useQueryParams";

export const LoginScreen = () => {
  const stytchClient = stytchClientSingleton;
  const { mode } = useQueryParams(["mode"]);
  const isPopupMode = mode === "popup";

  const [email, setEmail] = useState("");
  const [methodId, setMethodId] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isOnOtpStep, setIsOnOtpStep] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isRedirectingToOAuth, setIsRedirectingToOAuth] = useState(false);
  const [showZKEmailLogin, setShowZKEmailLogin] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const tokenProcessed = useRef(false);

  // Use AuthStateManager via hook
  const { startLogin, setError: setAuthError } = useAuthState();

  // Keep context for backward compatibility
  const { setConnectionMethod, setAbstraxionError, chainInfo } = useContext(
    AuthContext,
  ) as AuthContextProps;

  // Detect if running in iframe mode - browser extensions don't work directly in iframes
  // but we can use popups to connect to wallets
  const isInIframe =
    typeof window !== "undefined" && window.self !== window.top;

  /**
   * Handles post-authentication account creation/lookup.
   * Called after successful Stytch authentication to create or retrieve the abstract account.
   */
  const handlePostAuthentication = useCallback(
    async (sessionJwt: string): Promise<boolean> => {
      try {
        console.log(
          "[AbstraxionSignin] Authentication successful, starting login flow...",
        );

        // Start login via AuthStateManager - this triggers the transition
        // to LoginWalletSelector which handles account creation/discovery
        const loginAuthenticator = getLoginAuthenticatorFromJWT(sessionJwt);
        if (loginAuthenticator) {
          startLogin(
            AUTHENTICATOR_TYPE.JWT,
            CONNECTION_METHOD.Stytch,
            loginAuthenticator,
          );
        }

        return true;
      } catch (error: unknown) {
        console.error("[AbstraxionSignin] Account creation failed:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown error";
        setAbstraxionError(`Account creation failed: ${errorMessage}`);
        setAuthError(`Account creation failed: ${errorMessage}`);
        return false;
      }
    },
    [setAbstraxionError, startLogin, setAuthError],
  );

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailError("");
    let newEmail = e.currentTarget.value.toLowerCase().trim();
    const chainId = chainInfo?.chainId || "";
    if (chainId && chainId === "xion-testnet-1") {
      newEmail = e.currentTarget.value.toLowerCase();
    }
    setEmail(newEmail);
  };

  const EMAIL_REGEX = /\S+@\S+\.\S+/;
  const validateEmail = () => {
    if (EMAIL_REGEX.test(email) || email === "") {
      setEmailError("");
    } else {
      setEmailError("Invalid Email Format");
    }
  };

  const loginWithGoogle = useCallback(async () => {
    setIsRedirectingToOAuth(true);

    const origin = window.location.origin;
    // Redirect to our callback page
    const redirectUrl = `${origin}/callback`;

    // Manually construct OAuth URL to open in popup instead of redirecting iframe
    const publicToken = getStytchPublicToken();
    const baseUrl = STYTCH_PROXY_URL || window.location.origin;
    const googleOAuthUrl =
      `${baseUrl}/public/oauth/google/start?` +
      `public_token=${publicToken}&` +
      `login_redirect_url=${encodeURIComponent(redirectUrl)}&` +
      `signup_redirect_url=${encodeURIComponent(redirectUrl)}&` +
      `prompt=select_account`;

    // Popup mode: redirect within this window instead of opening another popup
    if (isPopupMode) {
      sessionStorage.setItem("popup_oauth_params", window.location.search);
      window.location.href = googleOAuthUrl;
      return;
    }

    const popup = window.open(
      googleOAuthUrl,
      "Google Login",
      "width=500,height=600,popup=yes",
    );

    if (!popup) {
      console.error("[AbstraxionSignin] Popup was blocked");
      alert("Please allow popups for this site to sign in with Google");
      setIsRedirectingToOAuth(false);
      return;
    }

    // Listen for the OAuth callback message
    const cleanup = () => {
      window.removeEventListener("message", handleOAuthMessage);
      clearInterval(closedCheck);
    };

    const handleOAuthMessage = async (event: MessageEvent) => {
      // TODO: Lock down origin check (event.origin === window.location.origin).
      // Currently low-risk: popup is same-origin and Stytch validates the token server-side.
      if (event.data.type === "OAUTH_SUCCESS") {
        cleanup();

        try {
          if (!stytchClient || !stytchClient.oauth) {
            console.error(
              "[AbstraxionSignin] Stytch client not properly initialized",
            );
            setIsRedirectingToOAuth(false);
            return;
          }

          const response = await stytchClient.oauth.authenticate(
            event.data.token,
            {
              session_duration_minutes: 60 * 24 * 3,
            },
          );

          console.log(
            "[AbstraxionSignin] OAuth authenticate response:",
            response,
          );

          // Start login flow after successful authentication
          if (response.session_jwt) {
            await handlePostAuthentication(response.session_jwt);
          } else {
            console.error("[AbstraxionSignin] Missing session JWT in response");
          }
          setIsRedirectingToOAuth(false);
        } catch (error: unknown) {
          console.error(
            "[AbstraxionSignin] OAuth authentication error:",
            error,
          );
          setIsRedirectingToOAuth(false);
        }
      } else if (event.data.type === "OAUTH_ERROR") {
        console.error("[AbstraxionSignin] OAuth error:", event.data);
        cleanup();
        setIsRedirectingToOAuth(false);
      }
    };

    // Detect popup closed without completing auth
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        cleanup();
        setIsRedirectingToOAuth(false);
      }
    }, 500);

    window.addEventListener("message", handleOAuthMessage);
  }, [stytchClient, handlePostAuthentication, isPopupMode]);

  const loginWithApple = useCallback(async () => {
    setIsRedirectingToOAuth(true);

    const origin = window.location.origin;
    // Redirect to our callback page
    const redirectUrl = `${origin}/callback`;

    const publicToken = getStytchPublicToken();
    const baseUrl = STYTCH_PROXY_URL || window.location.origin;
    const appleOAuthUrl =
      `${baseUrl}/public/oauth/apple/start?` +
      `public_token=${publicToken}&` +
      `login_redirect_url=${encodeURIComponent(redirectUrl)}&` +
      `signup_redirect_url=${encodeURIComponent(redirectUrl)}`;

    // Popup mode: redirect within this window instead of opening another popup
    if (isPopupMode) {
      sessionStorage.setItem("popup_oauth_params", window.location.search);
      window.location.href = appleOAuthUrl;
      return;
    }

    const popup = window.open(
      appleOAuthUrl,
      "Apple Login",
      "width=500,height=600,popup=yes",
    );

    if (!popup) {
      console.error("[AbstraxionSignin] Popup was blocked");
      alert("Please allow popups for this site to sign in with Apple");
      setIsRedirectingToOAuth(false);
      return;
    }

    // Listen for the OAuth callback message
    const cleanup = () => {
      window.removeEventListener("message", handleOAuthMessage);
      clearInterval(closedCheck);
    };

    const handleOAuthMessage = async (event: MessageEvent) => {
      // TODO: Lock down origin check (event.origin === window.location.origin).
      // Currently low-risk: popup is same-origin and Stytch validates the token server-side.
      if (event.data.type === "OAUTH_SUCCESS") {
        cleanup();

        try {
          if (!stytchClient || !stytchClient.oauth) {
            console.error(
              "[AbstraxionSignin] Stytch client not properly initialized",
            );
            setIsRedirectingToOAuth(false);
            return;
          }

          const token = event.data.token;
          console.log(
            "[AbstraxionSignin] Received Apple OAuth token from popup",
          );

          // Authenticate with the token
          const response = await stytchClient.oauth.authenticate(token, {
            session_duration_minutes: 60 * 24 * 30,
          });

          console.log(
            "[AbstraxionSignin] Apple OAuth authenticate response:",
            response,
          );

          // Start login flow after successful authentication
          if (response.session_jwt) {
            await handlePostAuthentication(response.session_jwt);
          } else {
            console.error("[AbstraxionSignin] Missing session JWT in response");
          }
          setIsRedirectingToOAuth(false);
        } catch (error) {
          console.error(
            "[AbstraxionSignin] Apple OAuth authentication failed:",
            error,
          );
          setAbstraxionError("Apple authentication failed");
          setIsRedirectingToOAuth(false);
        }
      } else if (event.data.type === "OAUTH_ERROR") {
        console.error("[AbstraxionSignin] Apple OAuth error:", event.data);
        cleanup();
        setIsRedirectingToOAuth(false);
      }
    };

    // Detect popup closed without completing auth
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        cleanup();
        setIsRedirectingToOAuth(false);
      }
    }, 500);

    window.addEventListener("message", handleOAuthMessage);
  }, [stytchClient, setAbstraxionError, handlePostAuthentication, isPopupMode]);

  const loginWithTikTok = useCallback(async () => {
    setIsRedirectingToOAuth(true);

    const origin = window.location.origin;
    // Redirect to our callback page
    const redirectUrl = `${origin}/callback`;

    const publicToken = getStytchPublicToken();
    const baseUrl = STYTCH_PROXY_URL || window.location.origin;
    const tiktokOAuthUrl =
      `${baseUrl}/public/oauth/tiktok/start?` +
      `public_token=${publicToken}&` +
      `login_redirect_url=${encodeURIComponent(redirectUrl)}&` +
      `signup_redirect_url=${encodeURIComponent(redirectUrl)}`;

    // Popup mode: redirect within this window instead of opening another popup
    if (isPopupMode) {
      sessionStorage.setItem("popup_oauth_params", window.location.search);
      window.location.href = tiktokOAuthUrl;
      return;
    }

    const popup = window.open(
      tiktokOAuthUrl,
      "TikTok Login",
      "width=500,height=600,popup=yes",
    );

    if (!popup) {
      console.error("[AbstraxionSignin] Popup was blocked");
      alert("Please allow popups for this site to sign in with TikTok");
      setIsRedirectingToOAuth(false);
      return;
    }

    // Listen for the OAuth callback message
    const cleanup = () => {
      window.removeEventListener("message", handleOAuthMessage);
      clearInterval(closedCheck);
    };

    const handleOAuthMessage = async (event: MessageEvent) => {
      // TODO: Lock down origin check (event.origin === window.location.origin).
      // Currently low-risk: popup is same-origin and Stytch validates the token server-side.
      if (event.data.type === "OAUTH_SUCCESS") {
        cleanup();

        try {
          if (!stytchClient || !stytchClient.oauth) {
            console.error(
              "[AbstraxionSignin] Stytch client not properly initialized",
            );
            setIsRedirectingToOAuth(false);
            return;
          }

          const token = event.data.token;
          console.log(
            "[AbstraxionSignin] Received TikTok OAuth token from popup",
          );

          // Authenticate with the token
          const response = await stytchClient.oauth.authenticate(token, {
            session_duration_minutes: 60 * 24 * 30,
          });

          console.log(
            "[AbstraxionSignin] TikTok OAuth authenticate response:",
            response,
          );

          // Start login flow after successful authentication
          if (response.session_jwt) {
            await handlePostAuthentication(response.session_jwt);
          } else {
            console.error("[AbstraxionSignin] Missing session JWT in response");
          }
          setIsRedirectingToOAuth(false);
        } catch (error) {
          console.error(
            "[AbstraxionSignin] TikTok OAuth authentication failed:",
            error,
          );
          setAbstraxionError("TikTok authentication failed");
          setIsRedirectingToOAuth(false);
        }
      } else if (event.data.type === "OAUTH_ERROR") {
        console.error("[AbstraxionSignin] TikTok OAuth error:", event.data);
        cleanup();
        setIsRedirectingToOAuth(false);
      }
    };

    // Detect popup closed without completing auth
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        cleanup();
        setIsRedirectingToOAuth(false);
      }
    }, 500);

    window.addEventListener("message", handleOAuthMessage);
  }, [stytchClient, setAbstraxionError, handlePostAuthentication, isPopupMode]);

  const handleEmail = async () => {
    if (!email) {
      setEmailError("Please enter your email");
      return;
    }

    if (!stytchClient || !stytchClient.otps || !stytchClient.otps.email) {
      console.error(
        "[AbstraxionSignin] Stytch client not properly initialized",
      );
      setEmailError("Authentication service not available");
      return;
    }

    try {
      setIsSendingEmail(true);
      setConnectionMethod(CONNECTION_METHOD.Stytch);
      const emailRes = await stytchClient.otps.email.loginOrCreate(email, {
        login_template_id: "xion_otp",
        signup_template_id: "xion_otp_signup",
        expiration_minutes: 2,
      });
      setMethodId(emailRes.method_id);
      setIsOnOtpStep(true);
    } catch (error) {
      console.error("[AbstraxionSignin] Error sending email:", error);
      setEmailError("Error sending email");
      setConnectionMethod(CONNECTION_METHOD.None);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleOtp = async (otpCode: string) => {
    if (!stytchClient || !stytchClient.otps) {
      console.error(
        "[AbstraxionSignin] Stytch client not properly initialized",
      );
      setOtpError("Authentication service not available");
      return;
    }

    try {
      const response = await stytchClient.otps.authenticate(otpCode, methodId, {
        session_duration_minutes: 60 * 24 * 3,
      });

      console.log("[AbstraxionSignin] OTP authenticate response:", response);

      // Start login flow after successful authentication
      if (response.session_jwt) {
        await handlePostAuthentication(response.session_jwt);
      } else {
        console.error("[AbstraxionSignin] Missing session JWT in response");
      }
    } catch {
      setOtpError("Error Verifying OTP Code");
    }
  };

  async function handleKeplr() {
    console.log(
      "[AbstraxionSignin] handleKeplr called, isInIframe:",
      isInIframe,
    );

    // In iframe mode, use popup to connect to wallet
    if (isInIframe) {
      const origin = window.location.origin;
      const callbackUrl = `${origin}/callback?wallet=keplr`;
      const popup = window.open(
        callbackUrl,
        "Keplr Wallet",
        "width=500,height=600,popup=yes",
      );

      if (!popup) {
        alert("Please allow popups for this site to connect with Keplr");
        return;
      }

      // TODO: Lock down origin check (event.origin === window.location.origin).
      // Currently low-risk: popup is same-origin (Callback.tsx sends with window.location.origin).
      const handleWalletMessage = (event: MessageEvent) => {
        if (
          event.data.type === "WALLET_SUCCESS" &&
          event.data.data.walletType === "keplr"
        ) {
          window.removeEventListener("message", handleWalletMessage);
          const { authenticator, address, name } = event.data.data;
          console.log("[AbstraxionSignin] Keplr connected via popup:", {
            authenticator,
            address,
            name,
          });

          // Use AuthStateManager
          startLogin(
            AUTHENTICATOR_TYPE.Secp256K1,
            CONNECTION_METHOD.Keplr,
            authenticator,
          );

          // Also update context for backward compatibility
          setConnectionMethod(CONNECTION_METHOD.Keplr);
        } else if (
          event.data.type === "WALLET_ERROR" &&
          event.data.walletType === "keplr"
        ) {
          window.removeEventListener("message", handleWalletMessage);
          console.error("[AbstraxionSignin] Keplr error:", event.data.error);
          setAbstraxionError(event.data.error || "Keplr wallet connect error");
        }
      };

      window.addEventListener("message", handleWalletMessage);
      return;
    }

    // Direct connection (not in iframe)
    if (!window.keplr) {
      alert("Please install the Keplr wallet extension");
      return;
    }

    if (!chainInfo) {
      setAbstraxionError("No chain info available");
      return;
    }

    try {
      // Try to suggest the chain (Keplr might not have Xion configured)
      try {
        await window.keplr.experimentalSuggestChain(chainInfo);
        console.log("[AbstraxionSignin] Keplr chain suggested successfully");
      } catch (suggestError) {
        console.log(
          "[AbstraxionSignin] Chain already exists or suggest failed:",
          suggestError,
        );
        // Continue anyway - chain might already be added
      }

      await window.keplr.enable(chainInfo.chainId);
      const key = await window.keplr.getKey(chainInfo.chainId);
      const authenticator = getHumanReadablePubkey(key.pubKey);
      console.log("[AbstraxionSignin] Keplr account:", key);
      console.log("[AbstraxionSignin] Keplr authenticator:", authenticator);

      // Use AuthStateManager
      startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        authenticator,
      );

      // Also update context for backward compatibility
      setConnectionMethod(CONNECTION_METHOD.Keplr);
      console.log("[AbstraxionSignin] Keplr wallet connected");
    } catch (error) {
      console.error("[AbstraxionSignin] Keplr error:", error);
      setAbstraxionError("Keplr wallet connect error");
    }
  }

  async function handleOkx() {
    console.log("[AbstraxionSignin] handleOkx called, isInIframe:", isInIframe);

    // In iframe mode, use popup to connect to wallet
    if (isInIframe) {
      const origin = window.location.origin;
      const callbackUrl = `${origin}/callback?wallet=okx`;
      const popup = window.open(
        callbackUrl,
        "OKX Wallet",
        "width=500,height=600,popup=yes",
      );

      if (!popup) {
        alert("Please allow popups for this site to connect with OKX");
        return;
      }

      // TODO: Lock down origin check (event.origin === window.location.origin).
      // Currently low-risk: popup is same-origin (Callback.tsx sends with window.location.origin).
      const handleWalletMessage = (event: MessageEvent) => {
        if (
          event.data.type === "WALLET_SUCCESS" &&
          event.data.data.walletType === "okx"
        ) {
          window.removeEventListener("message", handleWalletMessage);
          const { authenticator, address, name } = event.data.data;
          console.log("[AbstraxionSignin] OKX connected via popup:", {
            authenticator,
            address,
            name,
          });

          // Use AuthStateManager
          startLogin(
            AUTHENTICATOR_TYPE.Secp256K1,
            CONNECTION_METHOD.OKX,
            authenticator,
          );

          // Also update context for backward compatibility
          setConnectionMethod(CONNECTION_METHOD.OKX);
        } else if (
          event.data.type === "WALLET_ERROR" &&
          event.data.walletType === "okx"
        ) {
          window.removeEventListener("message", handleWalletMessage);
          console.error("[AbstraxionSignin] OKX error:", event.data.error);
          setAbstraxionError(event.data.error || "OKX wallet connect error");
        }
      };

      window.addEventListener("message", handleWalletMessage);
      return;
    }

    // Direct connection (not in iframe)
    if (!window.okxwallet) {
      alert("Please install the OKX wallet extension");
      return;
    }
    try {
      if (!chainInfo) {
        throw new Error("No chain info available");
      }
      const keplr = window.okxwallet.keplr;
      if (!keplr) {
        throw new Error("OKX Keplr extension not found");
      }
      console.log(
        "[AbstraxionSignin] Enabling OKX wallet for chainId:",
        chainInfo.chainId,
      );

      // First, try to suggest the chain (OKX might not have Xion configured)
      try {
        await keplr.experimentalSuggestChain(chainInfo);
        console.log("[AbstraxionSignin] OKX chain suggested successfully");
      } catch (suggestError) {
        console.log(
          "[AbstraxionSignin] Chain already exists or suggest failed:",
          suggestError,
        );
        // Continue anyway - chain might already be added
      }

      await keplr.enable(chainInfo.chainId);
      const okxAccount = await keplr.getKey(chainInfo.chainId);
      const authenticator = getHumanReadablePubkey(okxAccount.pubKey);
      console.log("[AbstraxionSignin] OKX account:", okxAccount);
      console.log("[AbstraxionSignin] OKX authenticator:", authenticator);

      // Use AuthStateManager
      startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.OKX,
        authenticator,
      );

      // Also update context for backward compatibility
      setConnectionMethod(CONNECTION_METHOD.OKX);
      console.log("[AbstraxionSignin] OKX wallet connected");
    } catch (error) {
      console.error("[AbstraxionSignin] OKX error:", error);
      setAbstraxionError("OKX wallet connect error");
    }
  }

  async function handleMetamask() {
    console.log(
      "[AbstraxionSignin] handleMetamask called, isInIframe:",
      isInIframe,
    );

    // In iframe mode, use popup to connect to wallet
    if (isInIframe) {
      const origin = window.location.origin;
      const callbackUrl = `${origin}/callback?wallet=metamask`;
      const popup = window.open(
        callbackUrl,
        "MetaMask Wallet",
        "width=500,height=600,popup=yes",
      );

      if (!popup) {
        alert("Please allow popups for this site to connect with MetaMask");
        return;
      }

      // TODO: Lock down origin check (event.origin === window.location.origin).
      // Currently low-risk: popup is same-origin (Callback.tsx sends with window.location.origin).
      const handleWalletMessage = (event: MessageEvent) => {
        if (
          event.data.type === "WALLET_SUCCESS" &&
          event.data.data.walletType === "metamask"
        ) {
          window.removeEventListener("message", handleWalletMessage);
          const { authenticator } = event.data.data;
          console.log(
            "[AbstraxionSignin] MetaMask connected via popup:",
            authenticator,
          );

          // Use AuthStateManager
          startLogin(
            AUTHENTICATOR_TYPE.EthWallet,
            CONNECTION_METHOD.Metamask,
            authenticator,
          );

          // Also update context for backward compatibility
          setConnectionMethod(CONNECTION_METHOD.Metamask);
        } else if (
          event.data.type === "WALLET_ERROR" &&
          event.data.walletType === "metamask"
        ) {
          window.removeEventListener("message", handleWalletMessage);
          console.error("[AbstraxionSignin] MetaMask error:", event.data.error);
          setAbstraxionError(event.data.error || "MetaMask connect error");
        }
      };

      window.addEventListener("message", handleWalletMessage);
      return;
    }

    // Direct connection (not in iframe)
    if (!window.ethereum) {
      alert("Please install the Metamask wallet extension");
      return;
    }
    try {
      console.log("[AbstraxionSignin] Requesting Metamask accounts");
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as Array<string>;
      console.log("[AbstraxionSignin] Metamask accounts:", accounts);
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in Metamask");
      }
      const primaryAccount = accounts[0];

      // Use AuthStateManager
      startLogin(
        AUTHENTICATOR_TYPE.EthWallet,
        CONNECTION_METHOD.Metamask,
        primaryAccount,
      );

      // Also update context for backward compatibility
      setConnectionMethod(CONNECTION_METHOD.Metamask);
      console.log("[AbstraxionSignin] Metamask connected:", primaryAccount);
    } catch (error) {
      console.error("[AbstraxionSignin] Metamask error:", error);
      setAbstraxionError("Metamask connect error");
    }
  }

  const getPasskey = async () => {
    try {
      const options: CredentialRequestOptions = {
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: registeredCredentials(),
          userVerification: "preferred",
        },
      };

      const publicKeyCredential = await get(options);
      if (!publicKeyCredential) throw new Error("Error getting webauthn key");

      const credentialId = convertToStandardBase64(publicKeyCredential.id);

      // Use AuthStateManager
      startLogin(
        AUTHENTICATOR_TYPE.Passkey,
        CONNECTION_METHOD.Passkey,
        credentialId,
      );

      // Also update context for backward compatibility
      setConnectionMethod(CONNECTION_METHOD.Passkey);
    } catch (error) {
      console.log(error);
    }
  };

  function handleZKEmail(emailSalt: string, emailAddress: string) {
    console.log(
      "[AbstraxionSignin] zk-email login with email salt:",
      emailSalt,
    );

    // Set auth state FIRST so account discovery (indexer) is triggered immediately
    startLogin(
      AUTHENTICATOR_TYPE.ZKEmail,
      CONNECTION_METHOD.ZKEmail,
      emailSalt,
    );

    // Store the email address in localStorage for signing transactions later
    AuthStateManager.setZKEmailData(emailAddress);

    // Also update context for backward compatibility
    setConnectionMethod(CONNECTION_METHOD.ZKEmail);

    // Close the zk-email login view (auth modal stays open until account is loaded)
    setShowZKEmailLogin(false);
  }

  function handleZKEmailError(error: string) {
    if (error) {
      console.error("[AbstraxionSignin] zk-email error:", error);
    }
    setAbstraxionError(error);
    setAuthError(error);
  }

  useEffect(() => {
    const authenticateUser = async () => {
      // Check both query params (popup flow) and hash params (main window flow)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      const token = urlParams.get("token") || hashParams.get("oauth_token");
      // const tokenType = urlParams.get("stytch_token_type") || hashParams.get("token_type");

      if (token && !tokenProcessed.current) {
        tokenProcessed.current = true;
        try {
          if (!stytchClient || !stytchClient.oauth) {
            console.error(
              "[AbstraxionSignin] Stytch client not properly initialized",
            );
            setAbstraxionError("Authentication service not available");
            return;
          }

          const response = await stytchClient.oauth.authenticate(token, {
            session_duration_minutes: 60 * 24 * 3,
          });

          console.log(
            "[AbstraxionSignin] OAuth authenticate response:",
            response,
          );

          // Start login flow after successful authentication
          const sessionJwt = response.session_jwt || "";

          if (sessionJwt) {
            await handlePostAuthentication(sessionJwt);
          } else {
            console.error(
              "[AbstraxionSignin] Missing session credentials in response",
            );
          }
        } catch (error) {
          console.error(
            "[AbstraxionSignin] OAuth authentication error:",
            error,
          );
          setAbstraxionError("Social authentication failed");
        } finally {
          // Clean up OAuth params from both URL and hash
          urlParams.delete("token");
          urlParams.delete("stytch_token_type");

          const newUrl = urlParams.toString()
            ? `${window.location.origin}?${urlParams.toString()}`
            : window.location.origin;

          // Also clear hash
          window.history.replaceState(null, "", newUrl);
        }
      }
    };

    authenticateUser();
  }, []);

  if (isRedirectingToOAuth) {
    return (
      <div className="ui-animate-scale-in ui-flex ui-flex-col ui-items-center ui-py-28 ui-text-center">
        <SpinnerV2 size="lg" color="black" />
        <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">
          {isPopupMode ? "Redirecting" : "Verifying Login"}
        </h2>
        <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">
          {isPopupMode
            ? "Taking you to your authentication provider..."
            : "Please complete the login in the popup window."}
        </p>
        <img src={xionLogo} alt="XION Logo" width="90" height="32" className="ui-mx-auto ui-mt-10 ui-brightness-0" />
      </div>
    );
  }

  return (
    <>
      {showZKEmailLogin ? (
        <ZKEmailLogin
          onLogin={handleZKEmail}
          onCancel={() => setShowZKEmailLogin(false)}
          onError={handleZKEmailError}
        />
      ) : isOnOtpStep ? (
        <div className="ui-animate-scale-in ui-flex ui-flex-col ui-gap-6">
          <DialogHeader>
            <DialogTitle>Input 6 Digit Code</DialogTitle>
            <DialogDescription>
              Please check your email for the verification code
            </DialogDescription>
          </DialogHeader>
          <LoginOtpForm
            error={otpError}
            setError={setOtpError}
            handleOtp={handleOtp}
            handleResendCode={handleEmail}
          />
        </div>
      ) : (
        <div className="ui-animate-scale-in">
          <DialogHeader>
            <DialogTitle>Log in / Sign up</DialogTitle>
          </DialogHeader>
          <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full">
            <div className="ui-flex ui-flex-col ui-gap-4">
              <Input
                placeholder="Email"
                value={email}
                onChange={handleEmailChange}
                error={emailError}
                onBlur={validateEmail}
                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
              />
              <Button
                onClick={handleEmail}
                disabled={!!emailError || isSendingEmail}
                className={"ui-mt-1.5"}
              >
                {isSendingEmail ? (
                  <SpinnerV2 size="sm" color="black" />
                ) : (
                  "CONTINUE"
                )}
              </Button>
            </div>
            <div className="ui-flex ui-items-center ui-justify-center ui-gap-2.5">
              <Separator />
              <span className="ui-text-caption ui-text-secondary-text ui-shrink-0">OR</span>
              <Separator />
            </div>
            <div className="ui-flex ui-flex-col ui-gap-2.5">
              <NavigationButton
                icon={<GoogleLogoIcon />}
                onClick={loginWithGoogle}
              >
                Google
              </NavigationButton>
              {FEATURE_FLAGS.apple && (
                <NavigationButton
                  icon={<AppleLogoIcon />}
                  onClick={loginWithApple}
                >
                  Apple
                </NavigationButton>
              )}
              {FEATURE_FLAGS.tiktok && (
                <NavigationButton
                  icon={<TikTokLogoIcon />}
                  onClick={loginWithTikTok}
                >
                  TikTok
                </NavigationButton>
              )}
            </div>
            {(FEATURE_FLAGS.okx || FEATURE_FLAGS.metamask || FEATURE_FLAGS.zkemail) && (
              <div className="ui-flex ui-flex-col ui-items-center ui-gap-2.5">
                <button
                  className="ui-flex ui-items-center ui-gap-1.5 ui-text-caption ui-text-secondary-text ui-transition-colors hover:ui-text-text-primary"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  Advanced Options
                  <ChevronRightIcon
                    className={`ui-fill-current ui-transition-transform ui-duration-fast ${showAdvanced ? "-ui-rotate-90" : "ui-rotate-90"}`}
                  />
                </button>
                {showAdvanced && (
                  <div className="ui-flex ui-flex-wrap ui-justify-center ui-gap-2.5 ui-animate-fade-in">
                    {FEATURE_FLAGS.okx && (
                      <Button
                        variant="secondary"
                        size="icon-large"
                        onClick={handleOkx}
                      >
                        <img
                          src={okxLogo}
                          height={82}
                          width={50}
                          alt="OKX Logo"
                          className="ui-min-w-7 ui-brightness-0"
                        />
                      </Button>
                    )}
                    {FEATURE_FLAGS.keplr && (
                      <Button
                        variant="secondary"
                        size="icon-large"
                        onClick={handleKeplr}
                      >
                        <KeplrLogo className="ui-min-w-6 ui-min-h-6" />
                      </Button>
                    )}
                    {FEATURE_FLAGS.metamask && (
                      <Button
                        variant="secondary"
                        size="icon-large"
                        onClick={handleMetamask}
                      >
                        <MetamaskLogo className="ui-min-w-6 ui-min-h-6" />
                      </Button>
                    )}
                    {FEATURE_FLAGS.passkey && (
                      <Button
                        variant="secondary"
                        size="icon-large"
                        onClick={getPasskey}
                        className="ui-relative"
                      >
                        <span className="ui-absolute ui-top-0 ui-right-0 ui-bg-text-muted/50 ui-text-white ui-text-caption ui-leading-none ui-font-bold ui-px-1 ui-py-0.5 ui-rounded-[7px] ui-rounded-br-none ui-rounded-tl-none">
                          BETA
                        </span>
                        <PasskeyIcon className="ui-min-w-6 ui-min-h-6" />
                      </Button>
                    )}
                    {FEATURE_FLAGS.zkemail && (
                      <Button
                        variant="secondary"
                        size="icon-large"
                        onClick={() => setShowZKEmailLogin(true)}
                        className="ui-relative"
                      >
                        <span className="ui-absolute ui-top-0 ui-right-0 ui-bg-accent-trust/80 ui-text-white ui-text-caption ui-leading-none ui-font-bold ui-px-1 ui-py-0.5 ui-rounded-[7px] ui-rounded-br-none ui-rounded-tl-none">
                          BETA
                        </span>
                        <ZKEmailIcon className="ui-min-w-6 ui-min-h-6" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="ui-mt-auto ui-pt-6 ui-flex ui-flex-col ui-items-center ui-gap-2">
        <div className="ui-text-caption ui-text-center ui-max-w-[340px]">
          <span className="ui-text-secondary-text">
            By continuing, you agree to and acknowledge that you have read and
            understand the{" "}
          </span>
          <a
            href="https://burnt.com/terms-and-conditions"
            target="_blank"
            rel="noreferrer"
            className="ui-text-text-primary ui-underline ui-font-bold"
          >
            Disclaimer
          </a>
          <span className="ui-text-secondary-text">.</span>
        </div>
        <button
          type="button"
          onClick={() => setShowNetwork((v) => !v)}
          className="ui-transition-opacity ui-duration-fast hover:ui-opacity-70"
        >
          <SecuredByXion />
        </button>
        {showNetwork && (
          <span
            className={`ui-text-caption ui-font-medium ui-animate-fade-in ${isMainnet() ? "ui-text-mainnet" : "ui-text-testnet"}`}
          >
            {isMainnet() ? "Mainnet" : "Testnet"}
          </span>
        )}
      </div>
    </>
  );
};
