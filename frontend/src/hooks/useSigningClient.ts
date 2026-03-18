import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useStytch } from "@stytch/react";
import { AAClient, GasPrice } from "@burnt-labs/signers";
import { AuthContext, AuthContextProps } from "../components/AuthContext";
import { testnetChainInfo } from "@burnt-labs/constants";
import { formatGasPrice, getGasCalculation } from "../utils/fees";
import { STYTCH_PROXY_URL } from "../config";
import { CONNECTION_METHOD } from "../auth/useAuthState";
import { getConnectionAdapter } from "../connectionAdapters";
import type { JWTAdapter } from "../connectionAdapters/adapters/JWTAdapter";
import type { Secp256k1Adapter } from "../connectionAdapters/adapters/Secp256k1Adapter";
import type { EthWalletAdapter } from "../connectionAdapters/adapters/EthWalletAdapter";
import type { PasskeyAdapter } from "../connectionAdapters/adapters/PasskeyAdapter";
import type { ZKEmailAdapter } from "../connectionAdapters/adapters/ZKEmailAdapter";
import { AuthStateManager } from "../auth/AuthStateManager";

export const useSigningClient = () => {
  const {
    connectionMethod,
    authenticatorType,
    abstractAccount,
    chainInfo,
    isChainInfoLoading,
  } = useContext(AuthContext) as AuthContextProps;

  const stytch = useStytch();

  const [abstractClient, setAbstractClient] = useState<AAClient | undefined>(
    undefined,
  );

  // track Keplr state changes
  const [keplrState, setKeplrState] = useState(window.keplr ? true : false);

  useEffect(() => {
    const handleKeplrChange = () => {
      setKeplrState(window.keplr ? true : false);
    };

    window.addEventListener("keplr_keystorechange", handleKeplrChange);
    return () => {
      window.removeEventListener("keplr_keystorechange", handleKeplrChange);
    };
  }, []);

  const getSigner = useCallback(async () => {
    if (
      isChainInfoLoading ||
      !chainInfo ||
      !abstractAccount ||
      !authenticatorType
    ) {
      return;
    }

    // Handle "none" connection method
    if (connectionMethod === CONNECTION_METHOD.None) {
      console.warn("No connection method set");
      return;
    }

    try {
      // Get the appropriate adapter for this connection
      const adapter = getConnectionAdapter(authenticatorType, connectionMethod);

      // Enable the connection (this may trigger wallet popups)
      await adapter.enable(chainInfo.chainId);

      // Get the signer from the adapter
      let signer;

      // Each adapter's getSigner has different parameters based on its needs
      if (connectionMethod === CONNECTION_METHOD.Stytch) {
        // Read token fresh inside callback — reading at render time can
        // capture stale/undefined values before Stytch syncs the session
        const sessionToken = stytch.session.getTokens()?.session_token;
        if (!sessionToken) {
          console.warn("[useSigningClient] Stytch session token not yet available");
          return;
        }
        // JWT adapter needs session token and API URL
        signer = (adapter as JWTAdapter).getSigner(
          abstractAccount.id,
          abstractAccount.currentAuthenticatorIndex,
          sessionToken,
          STYTCH_PROXY_URL,
        );
      } else if (
        connectionMethod === CONNECTION_METHOD.Keplr ||
        connectionMethod === CONNECTION_METHOD.OKX
      ) {
        // Secp256k1 adapters need chainId
        signer = await (adapter as Secp256k1Adapter).getSigner(
          chainInfo.chainId,
          abstractAccount.id,
          abstractAccount.currentAuthenticatorIndex,
        );
      } else if (connectionMethod === CONNECTION_METHOD.Metamask) {
        // Eth adapters don't need chainId
        signer = (adapter as EthWalletAdapter).getSigner(
          abstractAccount.id,
          abstractAccount.currentAuthenticatorIndex,
        );
      } else if (connectionMethod === CONNECTION_METHOD.Passkey) {
        // Passkey adapter
        signer = (adapter as PasskeyAdapter).getSigner(
          abstractAccount.id,
          abstractAccount.currentAuthenticatorIndex,
        );
      } else if (connectionMethod === CONNECTION_METHOD.ZKEmail) {
        // ZK-Email: proofs are generated at sign time via zk-email utils (same flow as authenticator).
        // Email from session (set at login) is passed so the signer can request proof when user signs.
        const email = AuthStateManager.getZKEmailData();
        if (!email) {
          console.warn(
            "[useSigningClient] ZK-Email: no email in session; signer not created. Sign in with zk-email to sign transactions.",
          );
          return;
        }
        signer = (adapter as ZKEmailAdapter).getSigner(
          abstractAccount.id,
          abstractAccount.currentAuthenticatorIndex,
          email,
        );
      } else {
        console.warn(`Unsupported connection method: ${connectionMethod}`);
        return;
      }

      if (!signer) {
        console.warn("No signer returned from adapter");
        return;
      }

      const abstractClient = await AAClient.connectWithSigner(
        chainInfo.rpc || testnetChainInfo.rpc,
        signer,
        {
          gasPrice: formatGasPrice(chainInfo) as unknown as GasPrice,
        },
      );

      setAbstractClient(abstractClient);
    } catch (error) {
      console.error("Failed to create signer:", error);
    }
  }, [
    stytch,
    abstractAccount,
    authenticatorType,
    connectionMethod,
    chainInfo,
    isChainInfoLoading,
    keplrState,
  ]);

  useEffect(() => {
    if (abstractAccount && !isChainInfoLoading) {
      getSigner();
    }
  }, [abstractAccount, isChainInfoLoading, keplrState, getSigner]);

  const memoizedClient = useMemo(
    () => ({
      client: abstractClient,
      getGasCalculation: (simmedGas: number) =>
        chainInfo ? getGasCalculation(simmedGas, chainInfo) : undefined,
    }),
    [abstractClient, chainInfo],
  );

  return memoizedClient;
};
