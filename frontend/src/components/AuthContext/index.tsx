/**
 * AuthContext - React context for XION authentication state
 *
 * This context integrates with AuthStateManager as the single source of truth.
 * The context manages authentication state for this application.
 *
 * How it works:
 * 1. AuthStateManager is initialized on mount
 * 2. Context state is synced FROM AuthStateManager (not the other way around)
 * 3. Components can use this context for auth state
 */

import React, { createContext, ReactNode, useState, useEffect } from "react";
import { isMainnet } from "../../config";
import { ChainInfo } from "@burnt-labs/constants";
import { SelectedSmartAccount } from "../../types/wallet-account-types";
import axios from "axios";
import { getChainRegistryUrl, ABSTRAXION_API_URL } from "../../config";
import { useQueryParams } from "../../hooks/useQueryParams";
import { ContractContextProvider } from "../ContractContext";
import {
  AuthStateManager,
  ConnectionMethod,
} from "../../auth/AuthStateManager";
import type { AuthenticatorType } from "@burnt-labs/signers";

export interface AuthContextProps {
  connectionMethod: ConnectionMethod;
  setConnectionMethod: React.Dispatch<React.SetStateAction<ConnectionMethod>>;
  authenticatorType: AuthenticatorType | null;
  abstractAccount: SelectedSmartAccount | undefined;
  setAbstractAccount: React.Dispatch<SelectedSmartAccount>;
  abstraxionError: string;
  setAbstraxionError: React.Dispatch<React.SetStateAction<string>>;
  apiUrl: string;
  chainInfo: ChainInfo | null;
  isChainInfoLoading: boolean;
  isMainnet: boolean;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showApproval: boolean;
}

// Create a default context value to avoid undefined errors
const defaultContextValue: AuthContextProps = {
  connectionMethod: "none",
  setConnectionMethod: () => {},
  authenticatorType: null,
  abstractAccount: undefined,
  setAbstractAccount: () => {},
  abstraxionError: "",
  setAbstraxionError: () => {},
  apiUrl: "",
  chainInfo: null,
  isChainInfoLoading: true,
  isMainnet: false,
  isOpen: false,
  setIsOpen: () => {},
  showApproval: false,
};

export const AuthContext = createContext<AuthContextProps>(defaultContextValue);

export const AuthContextProvider = ({ children }: { children: ReactNode }) => {
  // Initialize AuthStateManager SYNCHRONOUSLY before reading state
  // This ensures localStorage values are loaded before initial render
  AuthStateManager.initialize();

  // Get initial state from AuthStateManager (now includes localStorage values)
  const initialState = AuthStateManager.getState();

  // Local state - will be synced with AuthStateManager
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(
    initialState.connectionMethod,
  );
  const [authenticatorType, setAuthenticatorType] =
    useState<AuthenticatorType | null>(initialState.authenticatorType);
  const [abstractAccount, setAbstractAccount] = useState<
    SelectedSmartAccount | undefined
  >(initialState.account);
  const [abstraxionError, setAbstraxionError] = useState(
    initialState.error || "",
  );
  const [isOpen, setIsOpen] = useState(false);
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [isChainInfoLoading, setIsChainInfoLoading] = useState(true);

  // Subscribe to AuthStateManager changes and sync to context
  useEffect(() => {
    const unsubscribe = AuthStateManager.subscribe((state, prevState) => {
      // Sync connectionMethod
      if (state.connectionMethod !== prevState.connectionMethod) {
        setConnectionMethod(state.connectionMethod);
      }

      // Sync authenticatorType
      if (state.authenticatorType !== prevState.authenticatorType) {
        setAuthenticatorType(state.authenticatorType);
      }

      // Sync account
      if (state.account !== prevState.account) {
        setAbstractAccount(state.account);
      }

      // Sync error
      if (state.error !== prevState.error) {
        setAbstraxionError(state.error || "");
      }
    });

    return unsubscribe;
  }, []);

  // When context setters are called, also update AuthStateManager
  // This maintains backward compatibility with components that set state directly
  const wrappedSetConnectionMethod: React.Dispatch<
    React.SetStateAction<ConnectionMethod>
  > = (action) => {
    setConnectionMethod((prev) => {
      const newValue = typeof action === "function" ? action(prev) : action;
      // Note: We don't update AuthStateManager here because it should be
      // updated through startLogin/completeLogin/logout methods.
      // This setter is kept for backward compatibility but the authoritative
      // state is in AuthStateManager.
      return newValue;
    });
  };

  const wrappedSetAbstractAccount: React.Dispatch<SelectedSmartAccount> = (
    account,
  ) => {
    setAbstractAccount(account);
    // Sync to AuthStateManager if this is a new/different account
    // This is needed for backward compatibility with components like AbstraxionWallets
    // that set the account via context setter
    if (account && account.id) {
      const currentAccount = AuthStateManager.getAccount();
      // Only update if account is different to prevent circular updates
      if (
        !currentAccount ||
        currentAccount.id !== account.id ||
        currentAccount.currentAuthenticatorIndex !==
          account.currentAuthenticatorIndex
      ) {
        AuthStateManager.completeLogin(account);
      }
    }
  };

  const wrappedSetAbstraxionError: React.Dispatch<
    React.SetStateAction<string>
  > = (action) => {
    setAbstraxionError((prev) => {
      const newValue = typeof action === "function" ? action(prev) : action;
      if (newValue) {
        AuthStateManager.setError(newValue);
      } else {
        AuthStateManager.clearError();
      }
      return newValue;
    });
  };

  const { grantee } = useQueryParams([
    "grantee",
  ]);

  // True whenever a grantee session-key address is present in the URL.
  // This covers full-grant flows (treasury/contracts/stake/bank) AND
  // connect-only / direct-signing flows where no on-chain grants are needed
  // but the user still needs to see the approval/identity confirmation screen.
  const showApproval = Boolean(grantee);

  const apiUrl = ABSTRAXION_API_URL;

  useEffect(() => {
    const fetchChainInfo = async () => {
      try {
        const chainRegistryUrl = getChainRegistryUrl();

        const response = await axios.get(chainRegistryUrl);

        if (response.status === 200) {
          const chainData = response.data;
          if (typeof chainData !== "object" || chainData === null) {
            throw new Error("Invalid chain registry data");
          }

          const gasPriceStep = {
            low: Number(chainData.fees.fee_tokens[0].low_gas_price),
            average: Number(chainData.fees.fee_tokens[0].average_gas_price),
            high: Number(chainData.fees.fee_tokens[0].high_gas_price),
          };

          // Transform chain registry format to ChainInfo format
          const chainInfo: ChainInfo = {
            chainId: chainData.chain_id,
            chainName: chainData.chain_name,
            rpc: chainData.apis.rpc[0].address,
            rest: chainData.apis.rest[0].address,
            stakeCurrency: {
              coinDenom: "XION",
              coinMinimalDenom: chainData.staking.staking_tokens[0].denom,
              coinDecimals: 6,
              gasPriceStep,
            },
            bech32Config: chainData.bech32_config,
            currencies: [
              {
                coinDenom: "XION",
                coinMinimalDenom: chainData.fees.fee_tokens[0].denom,
                coinDecimals: 6,
                gasPriceStep,
              },
            ],
            feeCurrencies: [
              {
                coinDenom: "XION",
                coinMinimalDenom: chainData.fees.fee_tokens[0].denom,
                coinDecimals: 6,
                gasPriceStep,
              },
            ],
            bip44: {
              coinType: chainData.slip44,
            },
            features: ["ibc-transfer", "ibc-go", "cosmwasm"],
          };

          setChainInfo(chainInfo);
        }
      } catch (error) {
        console.error("Failed to fetch chain info", error);
        setAbstraxionError("Failed to load chain information");
      } finally {
        setIsChainInfoLoading(false);
      }
    };

    fetchChainInfo();
  }, []);

  const contextValue = {
    connectionMethod,
    setConnectionMethod: wrappedSetConnectionMethod,
    authenticatorType,
    abstractAccount,
    setAbstractAccount: wrappedSetAbstractAccount,
    abstraxionError,
    setAbstraxionError: wrappedSetAbstraxionError,
    apiUrl,
    chainInfo,
    isChainInfoLoading,
    isMainnet: isMainnet(),
    isOpen,
    setIsOpen,
    showApproval,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      <ContractContextProvider codeId={abstractAccount?.codeId}>
        {children}
      </ContractContextProvider>
    </AuthContext.Provider>
  );
};
