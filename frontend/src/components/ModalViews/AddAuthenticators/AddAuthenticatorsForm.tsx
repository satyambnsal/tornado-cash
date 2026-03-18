import {
  Dispatch,
  SetStateAction,
  useContext,
  useState,
  useEffect,
} from "react";
import { create } from "@github/webauthn-json/browser-ponyfill";
import { assertIsDeliverTxSuccess } from "@cosmjs/stargate";
import { MsgExecuteContractEncodeObject } from "@cosmjs/cosmwasm-stargate";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmailIcon,
  KeplrLogo,
  MetamaskLogo,
  PasskeyIcon,
  AppleLogoIcon,
  ZKEmailIcon,
} from "../../ui";
import { AuthContext, AuthContextProps } from "../../AuthContext";
import { useSigningClient } from "../../../hooks";
import { useContractFeatures } from "../../../hooks/useContractFeatures";
import { findLowestMissingOrNextIndex } from "../../../auth/utils/authenticator-helpers";
import { AAAlgo, AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { registeredCredentials, saveRegistration } from "../../../auth/passkey";
import { Loading } from "../../Loading";
import type {
  AddAuthenticator,
  AddJwtAuthenticator,
  AddZKEmailAuthenticator,
} from "@burnt-labs/signers";
import type { Authenticator } from "@burnt-labs/account-management";
import { validateFeeGrant } from "@burnt-labs/account-management";
import { AddEmail } from "./AddEmail";
import { AddZKEmail } from "./AddZKEmail";
import { ZKEmailAuthenticatorStatus } from "./ZKEmailAuthenticatorStatus";
import { useZKEmailSigningStatus } from "../../../hooks/useZKEmailSigningStatus";
import { decodeJwt, JWTPayload } from "jose";
import { cn } from "../../../utils/classname-util";
import AnimatedCheckmark from "../../ui/icons/AnimatedCheck";
import { FeatureKey } from "../../../types";
import { useStytch, useStytchSession } from "@stytch/react";
import {
  createJwtAuthenticatorIdentifier,
  validateNewAuthenticator,
} from "../../../utils/authenticator-utils";
import {
  CHAIN_ID,
  FEE_GRANTER_ADDRESS,
  XION_API_URL,
  FEATURE_FLAGS,
  ZK_EMAIL_RECEIVER_EMAIL_ID,
} from "../../../config";
import {
  setZKEmailSigningAbortController,
  setZKEmailSigningStatus,
} from "../../../auth/zk-email/zk-email-signing-status";
import {
  CONNECTION_METHOD,
  type ConnectionMethod,
} from "../../../auth/useAuthState";
import { useZKEmailTurnstileProvider } from "../../../hooks/useZKEmailTurnstileProvider";

interface AuthenticatorStateData {
  id: string;
  type: string;
  authenticator: string;
  authenticatorIndex: number;
  version?: string;
  __typename?: string;
}

export function AddAuthenticatorsForm({
  setIsOpen,
  pendingOAuthJwt,
}: {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  pendingOAuthJwt?: { oAuthToken: string; provider: string } | null;
}) {
  // Component specific state
  const [selectedAuthenticator, setSelectedAuthenticator] =
    useState<ConnectionMethod>(CONNECTION_METHOD.None);

  // General UI state
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [isAddingZKEmail, setIsAddingZKEmail] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [zKEmailError, setZKEmailError] = useState<string | null>(null);

  // Context state
  const {
    abstractAccount,
    setAbstractAccount,
    chainInfo,
    apiUrl,
    isMainnet,
    connectionMethod,
  } = useContext(AuthContext) as AuthContextProps;
  const isUsingZKEmail = connectionMethod === CONNECTION_METHOD.ZKEmail;
  const zkEmailSigningStatus = useZKEmailSigningStatus(isUsingZKEmail);
  const { renderTurnstile } = useZKEmailTurnstileProvider(isUsingZKEmail);

  // When modal is open with zk-email, set abort controller so closing modal stops polling
  useEffect(() => {
    if (connectionMethod !== CONNECTION_METHOD.ZKEmail) return;
    setZKEmailSigningStatus(null);
    const controller = new AbortController();
    setZKEmailSigningAbortController(controller);
    return () => {
      controller.abort();
      setZKEmailSigningAbortController(null);
      setZKEmailSigningStatus(null);
    };
  }, [connectionMethod]);

  // Hooks
  const { client, getGasCalculation } = useSigningClient();

  const stytchClient = useStytch();
  const { session } = useStytchSession();

  // Check if both passkey and zk-email features are enabled for the account's contract code ID
  const { hasFeatures: isPasskeySupported, isLoadingFeatures } =
    useContractFeatures({
      requestedFeatures: [FeatureKey.PASSKEY],
    });
  const { hasFeatures: isZKEmailSupported } = useContractFeatures({
    requestedFeatures: [FeatureKey.ZKEMAIL],
  });

  // Only show passkey option if both the feature flag is enabled and the account contract supports it
  const isPasskeyAuthenticatorAvailable =
    FEATURE_FLAGS.passkey && isPasskeySupported && !isLoadingFeatures;
  // Only show zk-email if feature flag is on and the account contract supports it (testnet or mainnet with flag)
  const isZKEmailAuthenticatorAvailable =
    FEATURE_FLAGS.zkemail &&
    isZKEmailSupported &&
    !isLoadingFeatures;

  // Functions
  function handleSwitch(authenticator: ConnectionMethod) {
    setErrorMessage("");
    setSelectedAuthenticator(authenticator);
  }

  async function handleSelection() {
    setErrorMessage("");
    switch (selectedAuthenticator) {
      case CONNECTION_METHOD.None:
        break;
      case CONNECTION_METHOD.Keplr:
        await addKeplrAuthenticator();
        break;
      case CONNECTION_METHOD.Metamask:
        await addEthAuthenticator();
        break;
      case CONNECTION_METHOD.OKX:
        await addOkxAuthenticator();
        break;
      case CONNECTION_METHOD.Passkey:
        await addPasskeyAuthenticator();
        break;
      case CONNECTION_METHOD.Stytch:
        setIsAddingEmail(true);
        break;
      case CONNECTION_METHOD.ZKEmail:
        setIsAddingZKEmail(true);
        break;
      case CONNECTION_METHOD.Apple:
        await handleAddAppleAuthenticator();
        break;
      default:
        break;
    }
  }

  function postAddFunction() {
    setIsSuccess(true);
    setIsLoading(false);
    setIsAddingEmail(false);
    setIsAddingZKEmail(false);
  }

  async function handleAddAuthenticator(
    msg: AddAuthenticator | AddJwtAuthenticator | Record<string, unknown>,
    authenticatorStateData: AuthenticatorStateData,
  ): Promise<void> {
    if (!client) {
      throw new Error("No client");
    }

    if (!abstractAccount) {
      throw new Error("No abstract account");
    }

    const addMsg: MsgExecuteContractEncodeObject = {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.fromPartial({
        sender: abstractAccount.id,
        contract: abstractAccount.id,
        msg: new Uint8Array(Buffer.from(JSON.stringify(msg))),
        funds: [],
      }),
    };

    // Check if fee grant exists
    const feeGranterAddress = FEE_GRANTER_ADDRESS;
    const feeGrantResult = await validateFeeGrant(
      chainInfo?.rest || XION_API_URL,
      feeGranterAddress,
      abstractAccount.id,
      [
        "/cosmos.authz.v1beta1.MsgGrant",
        "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
        "/cosmwasm.wasm.v1.MsgExecuteContract",
        "/cosmwasm.wasm.v1.MsgMigrateContract",
      ],
      abstractAccount.id,
    );

    const simmedGas = await client.simulate(
      abstractAccount.id,
      [addMsg],
      "add-authenticator",
    );
    const fee = getGasCalculation(simmedGas);

    let stdFee = fee || ("auto" as const);
    if (fee && feeGrantResult.valid) {
      stdFee = { ...fee, granter: feeGranterAddress };
    }
    const deliverTxResponse = await client.signAndBroadcast(
      abstractAccount.id,
      [addMsg],
      stdFee,
    );

    assertIsDeliverTxSuccess(deliverTxResponse);

    setAbstractAccount({
      ...abstractAccount,
      authenticators: [
        ...abstractAccount.authenticators,
        authenticatorStateData as Authenticator,
      ],
      currentAuthenticatorIndex: abstractAccount.currentAuthenticatorIndex,
    });

    postAddFunction();
    return;
  }

  async function addJwtAuthenticator(otp: string, methodId: string) {
    try {
      const accountIndex = findLowestMissingOrNextIndex(
        abstractAccount?.authenticators,
      );

      if (!abstractAccount) {
        throw new Error("No abstract account");
      }

      const hashSignBytes = new Uint8Array(
        Buffer.from(abstractAccount.id, "utf-8"),
      );
      const hashedMessage = Buffer.from(hashSignBytes).toString("base64");
      const session_custom_claims = {
        transaction_hash: hashedMessage,
      };

      const authResponse = await fetch(
        `${apiUrl}/api/v1/sessions/authenticate-no-session`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            otp,
            methodId,
            session_custom_claims,
          }),
        },
      );
      const authResponseData = await authResponse.json();
      if (!authResponse.ok) {
        setOtpError("Error Verifying OTP Code");
        return;
      }

      const { aud, sub } = decodeJwt(
        authResponseData.data.session_jwt,
      ) as JWTPayload;

      if (!sub) {
        setOtpError("Invalid JWT: missing subject");
        return;
      }

      if (!aud) {
        setOtpError("Invalid JWT: missing audience");
        return;
      }

      // Create authenticator identifier and validate
      const authenticatorIdentifier = createJwtAuthenticatorIdentifier(
        aud,
        sub,
      );
      const validation = validateNewAuthenticator(
        abstractAccount.authenticators,
        authenticatorIdentifier,
        AUTHENTICATOR_TYPE.JWT,
      );

      if (!validation.isValid) {
        setOtpError(validation.errorMessage || "Cannot add this authenticator");
        return;
      }

      const formattedAud = Array.isArray(aud) ? aud[0] : aud;

      const signature = Buffer.from(
        authResponseData.data.session_jwt,
        "utf-8",
      ).toString("base64");

      const msg: AddJwtAuthenticator = {
        add_auth_method: {
          add_authenticator: {
            Jwt: {
              id: accountIndex,
              aud: formattedAud,
              sub,
              token: signature,
            },
          },
        },
      };

      const authenticatorStateData = {
        id: `${abstractAccount.id}-${accountIndex}`,
        type: AUTHENTICATOR_TYPE.JWT,
        authenticator: authenticatorIdentifier,
        authenticatorIndex: accountIndex,
        version: "1",
        __typename: "Authenticator",
      };
      await handleAddAuthenticator(msg, authenticatorStateData);
    } catch (error) {
      console.warn(error);
      setErrorMessage("Something went wrong trying to add authenticator");
    } finally {
      setIsLoading(false);
    }
  }

  async function addZeroKnowledgeEmailAuthenticator(signature: string, emailSalt: string) {
    try {
      setIsLoading(true);
      setZKEmailError(null);

      if (!abstractAccount) {
        setZKEmailError("No abstract account");
        setIsLoading(false);
        throw new Error("No abstract account");
      }

      const validation = validateNewAuthenticator(
        abstractAccount.authenticators,
        emailSalt,
        AUTHENTICATOR_TYPE.ZKEmail,
      );

      if (!validation.isValid) {
        setZKEmailError(
          validation.errorMessage || "Cannot add this authenticator",
        );
        setIsLoading(false);
        throw new Error(
          validation.errorMessage || "Cannot add this authenticator",
        );
      }

      if (!ZK_EMAIL_RECEIVER_EMAIL_ID) {
        setZKEmailError(
          "ZK-Email configuration error: allowed email host not set",
        );
        setIsLoading(false);
        throw new Error(
          "ZK_EMAIL_RECEIVER_EMAIL_ID is not configured. Please set VITE_ZK_EMAIL_RECEIVER_EMAIL_ID in your environment.",
        );
      }
      const allowedEmailHost = ZK_EMAIL_RECEIVER_EMAIL_ID;

      const accountIndex = findLowestMissingOrNextIndex(
        abstractAccount.authenticators,
      );

      const msg: AddZKEmailAuthenticator = {
        add_auth_method: {
          add_authenticator: {
            ZKEmail: {
              id: accountIndex,
              signature: signature,
              email_salt: emailSalt,
              allowed_email_hosts: [allowedEmailHost],
            },
          },
        },
      };

      const authenticatorStateData = {
        id: `${abstractAccount.id}-${accountIndex}`,
        type: AUTHENTICATOR_TYPE.ZKEmail,
        authenticator: emailSalt,
        authenticatorIndex: accountIndex,
        version: "1",
        __typename: "Authenticator",
      };

      await handleAddAuthenticator(msg, authenticatorStateData);
    } catch (error) {
      console.warn(error);
      setZKEmailError("Something went wrong trying to add authenticator");
    } finally {
      setIsLoading(false);
    }
  }

  async function addKeplrAuthenticator() {
    try {
      setIsLoading(true);

      if (!window.keplr) {
        return alert("Please install Keplr extension and try again");
      }

      if (!abstractAccount) {
        return alert("No abstract account found.");
      }

      const chain_id = chainInfo?.chainId || CHAIN_ID;

      // Suggest the chain to Keplr if not already added
      if (chainInfo) {
        try {
          await window.keplr.experimentalSuggestChain(chainInfo);
        } catch (suggestError) {
          console.log(
            "[AddAuthenticatorsForm] Chain already exists or suggest failed:",
            suggestError,
          );
        }
      }

      // Enable Keplr for this chain and get account
      await window.keplr.enable(chain_id);
      const keplrKey = await window.keplr.getKey(chain_id);

      const encoder = new TextEncoder();
      const signArbMessage = Buffer.from(encoder.encode(abstractAccount?.id));

      const signArbRes = await window.keplr.signArbitrary(
        chain_id,
        keplrKey.bech32Address,
        new Uint8Array(signArbMessage),
      );

      // Check for duplicate Keplr authenticator
      const validation = validateNewAuthenticator(
        abstractAccount.authenticators,
        signArbRes.pub_key.value,
        AAAlgo.secp256k1,
      );

      if (!validation.isValid) {
        setErrorMessage(
          validation.errorMessage || "This wallet is already added",
        );
        return;
      }

      const accountIndex = findLowestMissingOrNextIndex(
        abstractAccount?.authenticators,
      );

      const msg = {
        add_auth_method: {
          add_authenticator: {
            Secp256K1: {
              id: accountIndex,
              pubkey: signArbRes.pub_key.value,
              signature: signArbRes.signature,
            },
          },
        },
      };

      const authenticatorStateData = {
        id: `${abstractAccount.id}-${accountIndex}`,
        type: AAAlgo.secp256k1,
        authenticator: signArbRes.pub_key.value,
        authenticatorIndex: accountIndex,
        version: "1",
        __typename: "Authenticator",
      };

      await handleAddAuthenticator(msg, authenticatorStateData);
    } catch (error) {
      console.warn(error);
      setErrorMessage("Something went wrong trying to add authenticator");
    } finally {
      setIsLoading(false);
    }
  }

  async function addOkxAuthenticator() {
    try {
      setIsLoading(true);

      if (!window.okxwallet) {
        return alert("Install OKX Wallet");
      }

      if (!window.okxwallet.keplr) {
        return alert("OKX Wallet Keplr integration not available");
      }

      if (!abstractAccount) {
        return alert("No abstract account found.");
      }

      const chain_id = chainInfo?.chainId || CHAIN_ID;
      const encoder = new TextEncoder();
      const signArbMessage = Buffer.from(encoder.encode(abstractAccount?.id));

      await window.okxwallet.keplr.enable(chain_id);
      const okxAccount = await window.okxwallet.keplr.getKey(chain_id);
      const signArbRes = await window.okxwallet.keplr.signArbitrary(
        chain_id,
        okxAccount.bech32Address,
        new Uint8Array(signArbMessage),
      );

      // Check for duplicate OKX authenticator
      const validation = validateNewAuthenticator(
        abstractAccount.authenticators,
        signArbRes.pub_key.value,
        AAAlgo.secp256k1,
      );

      if (!validation.isValid) {
        setErrorMessage(
          validation.errorMessage || "This wallet is already added",
        );
        return;
      }

      const accountIndex = findLowestMissingOrNextIndex(
        abstractAccount?.authenticators,
      );

      const msg = {
        add_auth_method: {
          add_authenticator: {
            Secp256K1: {
              id: accountIndex,
              pubkey: signArbRes.pub_key.value,
              signature: signArbRes.signature,
            },
          },
        },
      };

      const authenticatorStateData = {
        id: `${abstractAccount.id}-${accountIndex}`,
        type: AAAlgo.secp256k1,
        authenticator: okxAccount.bech32Address,
        authenticatorIndex: accountIndex,
        version: "1",
        __typename: "Authenticator",
      };

      await handleAddAuthenticator(msg, authenticatorStateData);
    } catch (error) {
      console.warn(error);
      setErrorMessage("Something went wrong trying to add authenticator");
    } finally {
      setIsLoading(false);
    }
  }

  async function addEthAuthenticator() {
    try {
      setIsLoading(true);

      if (!window.ethereum) {
        return alert("Please install wallet extension");
      }

      if (!abstractAccount) {
        return alert("No abstract account found.");
      }

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const primaryAccount = accounts[0];

      const challenge = `0x${Buffer.from(abstractAccount?.id, "utf8").toString("hex")}`;

      const ethSignature = (await window.ethereum.request({
        method: "personal_sign",
        params: [challenge, primaryAccount],
      })) as string;

      const base64Signature = Buffer.from(
        ethSignature.slice(2),
        "hex",
      ).toString("base64");

      // Check for duplicate Ethereum wallet authenticator
      const validation = validateNewAuthenticator(
        abstractAccount.authenticators,
        primaryAccount,
        AAAlgo.ETHWALLET,
      );

      if (!validation.isValid) {
        setErrorMessage(
          validation.errorMessage || "This wallet is already added",
        );
        return;
      }

      const accountIndex = findLowestMissingOrNextIndex(
        abstractAccount?.authenticators,
      );

      const msg = {
        add_auth_method: {
          add_authenticator: {
            EthWallet: {
              id: accountIndex,
              address: primaryAccount,
              signature: base64Signature,
            },
          },
        },
      };

      const authenticatorStateData = {
        id: `${abstractAccount.id}-${accountIndex}`,
        type: AAAlgo.ETHWALLET,
        authenticator: primaryAccount,
        authenticatorIndex: accountIndex,
        version: "1",
        __typename: "Authenticator",
      };

      await handleAddAuthenticator(msg, authenticatorStateData);
    } catch (error) {
      console.warn(error);
      setErrorMessage("Something went wrong trying to add authenticator");
    } finally {
      setIsLoading(false);
    }
  }

  async function addPasskeyAuthenticator() {
    try {
      setIsLoading(true);

      if (!abstractAccount) {
        throw new Error("No abstract account");
      }

      const challenge = Buffer.from(abstractAccount?.id);
      let RP_URL = window.location.href;
      // Contract throws if there is a trailing "/" in the RP url
      if (RP_URL.endsWith("/")) {
        RP_URL = RP_URL.slice(0, -1);
      }

      const options: CredentialCreationOptions = {
        publicKey: {
          rp: {
            name: RP_URL,
          },
          user: {
            name: abstractAccount.id,
            displayName: abstractAccount.id,
            id: new Uint8Array(challenge),
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 }, // ES256
            // { type: "public-key", alg: -257 }, // RS256
            // { type: "public-key", alg: -8 }, // EdDSA
          ],
          challenge,
          authenticatorSelection: { userVerification: "preferred" },
          timeout: 300000, // 5 minutes,
          excludeCredentials: registeredCredentials(abstractAccount.id),
        },
      };

      const publicKeyCredential = await create(options);
      if (publicKeyCredential === null) {
        console.log("null credential");
        return;
      }
      // stringify the credential
      const publicKeyCredentialJSON = JSON.stringify(publicKeyCredential);

      // base64 encode it
      const base64EncodedCredential = Buffer.from(
        publicKeyCredentialJSON,
      ).toString("base64");

      // Check for duplicate Passkey authenticator
      const validation = validateNewAuthenticator(
        abstractAccount.authenticators,
        base64EncodedCredential,
        AAAlgo.Passkey,
      );

      if (!validation.isValid) {
        setErrorMessage(
          validation.errorMessage || "This passkey is already added",
        );
        return;
      }

      const accountIndex = findLowestMissingOrNextIndex(
        abstractAccount?.authenticators,
      );

      const msg = {
        add_auth_method: {
          add_authenticator: {
            Passkey: {
              id: accountIndex,
              url: RP_URL,
              credential: base64EncodedCredential,
            },
          },
        },
      };

      const authenticatorStateData = {
        id: `${abstractAccount.id}-${accountIndex}`,
        type: AAAlgo.Passkey,
        authenticator: base64EncodedCredential,
        authenticatorIndex: accountIndex,
      };

      await handleAddAuthenticator(msg, authenticatorStateData);
      saveRegistration(abstractAccount.id, publicKeyCredential);
    } catch (error) {
      console.warn(error);
      if (error instanceof DOMException) {
        if (
          error.message.includes(
            "The user attempted to register an authenticator that contains one of the credentials already registered with the relying party.",
          )
        ) {
          setErrorMessage("Authenticator already registered");
        }
      } else {
        console.error("An unexpected error occurred:", error);
        setErrorMessage("Something went wrong trying to add authenticator");
      }
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Start of OAuth JWT handling
   */

  /* OAuth JWT functions */
  async function addOAuthJwtAuthenticator(oauth_token: string) {
    setIsLoading(true);
    if (!abstractAccount) {
      setIsLoading(false);
      return;
    }

    if (!oauth_token) {
      setIsLoading(false);
      return;
    }
    sessionStorage.removeItem("captured_oauth_add");
    sessionStorage.removeItem("oauth_provider");
    sessionStorage.removeItem("oauth_add_mode");

    try {
      const accountIndex = findLowestMissingOrNextIndex(
        abstractAccount?.authenticators,
      );

      const hashSignBytes = new Uint8Array(
        Buffer.from(abstractAccount.id, "utf-8"),
      );
      const hashedMessage = Buffer.from(hashSignBytes).toString("base64");
      const session_custom_claims = {
        transaction_hash: hashedMessage,
      };

      const authResponse = await fetch(
        `${apiUrl}/api/v1/sessions/authenticate-oauth-no-session`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            token: oauth_token,
            session_custom_claims,
          }),
        },
      );
      const authResponseData = await authResponse.json();

      const { aud, sub } = decodeJwt(
        authResponseData.data.session_jwt,
      ) as JWTPayload;

      if (!aud) {
        setOtpError("Invalid JWT: missing audience");
        return;
      }

      if (!sub) {
        setOtpError("Invalid JWT: missing subject");
        return;
      }

      // Create authenticator identifier and validate
      const authenticatorIdentifier = createJwtAuthenticatorIdentifier(
        aud,
        sub,
      );

      const validation = validateNewAuthenticator(
        abstractAccount.authenticators,
        authenticatorIdentifier,
        AUTHENTICATOR_TYPE.JWT,
      );

      if (!validation.isValid) {
        setOtpError(validation.errorMessage || "Cannot add this authenticator");
        return;
      }

      const formattedAud = Array.isArray(aud) ? aud[0] : aud;

      const signature = Buffer.from(
        authResponseData.data.session_jwt,
        "utf-8",
      ).toString("base64");

      const msg: AddJwtAuthenticator = {
        add_auth_method: {
          add_authenticator: {
            Jwt: {
              id: accountIndex,
              aud: formattedAud,
              sub,
              token: signature,
            },
          },
        },
      };

      const authenticatorStateData = {
        id: `${abstractAccount.id}-${accountIndex}`,
        type: AUTHENTICATOR_TYPE.JWT,
        authenticator: authenticatorIdentifier,
        authenticatorIndex: accountIndex,
        version: "1",
        __typename: "Authenticator",
      };
      await handleAddAuthenticator(msg, authenticatorStateData);
    } catch (error) {
      console.warn(error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleAddAppleAuthenticator = async () => {
    setIsLoading(true);
    try {
      // Check if user is logged in
      if (!session || !stytchClient.session.getTokens()?.session_token) {
        return;
      }

      const origin = window.location.origin;
      const redirectUrl = `${origin}/`;

      // Store add mode information for when we return from OAuth
      sessionStorage.setItem("oauth_add_mode", "true");
      sessionStorage.setItem("oauth_provider", "apple");

      // Use Stytch SDK to initiate OAuth flow
      await stytchClient.oauth.apple.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (error) {
      console.error("Error starting Apple OAuth flow:", error);
      setErrorMessage(
        "There was an error starting the Apple OAuth flow.\n" + error,
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* OAuth JWT useEffect(s) */
  useEffect(() => {
    if (pendingOAuthJwt && client) {
      addOAuthJwtAuthenticator(pendingOAuthJwt.oAuthToken);
    }
  }, [pendingOAuthJwt, client]);

  if (isLoading) {
    if (connectionMethod === CONNECTION_METHOD.ZKEmail) {
      return (
        <div className="ui-flex ui-flex-col ui-gap-10 ui-items-center ui-w-full">
          <Loading
            header="Adding Authenticator"
            message={
              zkEmailSigningStatus
                ? "Signing with your email. Don't leave the page or close the window."
                : "Preparing... Don't leave the page or close the window."
            }
          />
          {zkEmailSigningStatus && (
            <ZKEmailAuthenticatorStatus
              phase={zkEmailSigningStatus.phase}
              message={zkEmailSigningStatus.message}
              detail={zkEmailSigningStatus.detail}
              className="ui-w-full"
            />
          )}
          {renderTurnstile()}
        </div>
      );
    }

    return (
      <Loading
        header="Adding Authenticator"
        message="We are adding an authenticator to your account. Don't leave the page or close the window. This will take a few seconds..."
      />
    );
  }

  if (isAddingEmail) {
    return (
      <AddEmail
        onSubmit={addJwtAuthenticator}
        error={otpError}
        onError={setOtpError}
        onClose={() => setIsOpen(false)}
      />
    );
  }

  if (isAddingZKEmail) {
    return (
      <AddZKEmail
        onSubmit={addZeroKnowledgeEmailAuthenticator}
        error={zKEmailError}
        onError={setZKEmailError}
        onClose={() => setIsOpen(false)}
        abstractAccount={abstractAccount!}
      />
    );
  }

  return (
    <div className="ui-flex ui-flex-col ui-gap-10 ui-items-center">
      <DialogHeader>
        {isSuccess ? (
          <>
            <DialogTitle>Success!</DialogTitle>
            <DialogDescription>
              Successfully added authenticator to account.
            </DialogDescription>
          </>
        ) : errorMessage ? (
          <>
            <DialogTitle>Add Authenticators</DialogTitle>
            <DialogDescription className="ui-text-disabled-text">
              {errorMessage}
            </DialogDescription>
          </>
        ) : (
          <>
            <DialogTitle>Add Authenticators</DialogTitle>
            <DialogDescription>
              Enhance your account&apos;s security by adding authenticators.
              Select from the following options.
            </DialogDescription>
          </>
        )}
      </DialogHeader>
      {!isSuccess ? (
        <>
          {/* <Button
            className="!ui-no-underline !ui-text-sm !ui-p-0 ui-max-w-max"
            onClick={() => setIsOpen(false)}
            structure="naked"
          >
            SKIP FOR NOW
          </Button> */}
          <div className="ui-grid ui-grid-cols-3 ui-gap-4 ui-w-fit ui-justify-center ui-mx-auto">
            <Button
              className={cn("ui-w-16 ui-h-16", {
                "!ui-border-cta": selectedAuthenticator === CONNECTION_METHOD.Stytch,
              })}
              onClick={() => handleSwitch(CONNECTION_METHOD.Stytch)}
              variant="secondary"
              size="icon-large"
            >
              <EmailIcon className="ui-w-[30px] ui-h-[24px]" />
            </Button>
            {(!isMainnet || FEATURE_FLAGS.keplr) ? (
              <Button
                className={cn(
                  { "!ui-border-cta": selectedAuthenticator === CONNECTION_METHOD.Keplr },
                  "ui-w-16 ui-h-16",
                )}
                onClick={() => handleSwitch(CONNECTION_METHOD.Keplr)}
                variant="secondary"
                size="icon-large"
              >
                <KeplrLogo className="ui-w-[26px] ui-h-[26px]" />
              </Button>
            ) : null}
            {(!isMainnet || FEATURE_FLAGS.metamask) ? (
              <Button
                className={cn(
                  { "!ui-border-cta": selectedAuthenticator === CONNECTION_METHOD.Metamask },
                  "ui-w-16 ui-h-16",
                )}
                disabled={isMainnet && !FEATURE_FLAGS.metamask}
                onClick={() => handleSwitch(CONNECTION_METHOD.Metamask)}
                variant="secondary"
                size="icon-large"
              >
                <MetamaskLogo className="ui-w-[34px] ui-h-[34px]" />
              </Button>
            ) : null}
            {(!isMainnet || FEATURE_FLAGS.okx) ? (
              <Button
                className={cn(
                  { "!ui-border-cta": selectedAuthenticator === CONNECTION_METHOD.OKX },
                  "ui-w-16 ui-h-16",
                )}
                disabled={isMainnet && !FEATURE_FLAGS.okx}
                onClick={() => handleSwitch(CONNECTION_METHOD.OKX)}
                variant="secondary"
                size="icon-large"
              >
                <img
                  src="/okxWallet.png"
                  height={36}
                  width={36}
                  alt="OKX Logo"
                  className="ui-brightness-0"
                />
              </Button>
            ) : null}
            {isPasskeyAuthenticatorAvailable ? (
              <Button
                className={cn(
                  { "!ui-border-cta": selectedAuthenticator === CONNECTION_METHOD.Passkey },
                  "ui-w-16 ui-h-16 ui-relative",
                )}
                disabled={!isPasskeyAuthenticatorAvailable}
                onClick={() => handleSwitch(CONNECTION_METHOD.Passkey)}
                variant="secondary"
                size="icon-large"
              >
                <span className="ui-absolute ui-top-0 ui-right-0 ui-bg-neutral-500/50 ui-text-white ui-text-[10px] ui-leading-none ui-font-bold ui-px-1 ui-py-0.5 ui-rounded-[7px] ui-rounded-br-none ui-rounded-tl-none">
                  BETA
                </span>
                <PasskeyIcon className="ui-w-12" />
              </Button>
            ) : null}
            {FEATURE_FLAGS.apple ? (
              <Button
                className={cn(
                  { "!ui-border-cta": selectedAuthenticator === CONNECTION_METHOD.Apple },
                  "ui-w-16 ui-h-16",
                )}
                disabled={!FEATURE_FLAGS.apple}
                onClick={() => handleSwitch(CONNECTION_METHOD.Apple)}
                variant="secondary"
                size="icon-large"
              >
                <AppleLogoIcon className="ui-w-[34px] ui-h-[34px]" />
              </Button>
            ) : null}
            {isZKEmailAuthenticatorAvailable ? (
              <Button
                className={cn(
                  { "!ui-border-cta": selectedAuthenticator === CONNECTION_METHOD.ZKEmail },
                  "ui-w-16 ui-h-16 ui-relative",
                )}
                disabled={!isZKEmailAuthenticatorAvailable}
                onClick={() => handleSwitch(CONNECTION_METHOD.ZKEmail)}
                variant="secondary"
                size="icon-large"
              >
                <span className="ui-absolute ui-top-0 ui-right-0 ui-bg-neutral-500/50 ui-text-white ui-text-[10px] ui-leading-none ui-font-bold ui-px-1 ui-py-0.5 ui-rounded-[7px] ui-rounded-br-none ui-rounded-tl-none">
                  BETA
                </span>
                <ZKEmailIcon className="ui-w-8 ui-h-8" />
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
      {isSuccess ? (
        <div className="ui-flex ui-flex-col ui-gap-10 ui-w-full ui-items-center">
          <AnimatedCheckmark />
          <Button className="ui-w-full" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </div>
      ) : (
        <Button
          className="ui-w-full"
          disabled={selectedAuthenticator === CONNECTION_METHOD.None}
          onClick={handleSelection}
        >
          SET UP AUTHENTICATOR
        </Button>
      )}
    </div>
  );
}
