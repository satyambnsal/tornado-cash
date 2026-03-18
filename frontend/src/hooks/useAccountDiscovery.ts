/**
 * Smart account discovery hook using xion.js composite strategy
 *
 * Uses a retry strategy instead of aggressive polling:
 * - Initial fetch on mount
 * - Smart retry with exponential backoff (1s, 2s, 4s = ~7s total)
 * - Only retries on network/500 errors, not 400/404
 * - Stops automatically when account is found
 * - Manual retry available via returned retry() function
 */

import { QueryKey, useQuery } from "@tanstack/react-query";
import { useSmartAccount } from "./useSmartAccount";
import {
  accountStrategy,
  type SmartAccountWithCodeId,
} from "../utils/query-smart-accounts";
import { detectAuthenticatorType } from "@burnt-labs/signers";
import { useContext, useEffect, useState } from "react";
import { AuthContext, AuthContextProps } from "../components/AuthContext";

// Retry config - exponential backoff
const MAX_RETRIES = 3; // 1s, 2s, 4s = ~7s total
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 4000; // 4 seconds

export const useAccountDiscovery = (
  waitToFetch: boolean = false,
  handleSuccess?: () => void,
): {
  data: SmartAccountWithCodeId[];
  loading: boolean;
  error: unknown;
  isSuccess: boolean;
  retry: () => void;
} => {
  const { loginAuthenticator, loginAuthenticatorType } = useSmartAccount();
  const [shouldFetch, setShouldFetch] = useState(!waitToFetch);
  const { abstractAccount } = useContext(AuthContext) as AuthContextProps;
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset shouldFetch when loginAuthenticator changes
  useEffect(() => {
    if (loginAuthenticator && !waitToFetch) {
      setShouldFetch(true);
    }
  }, [loginAuthenticator, waitToFetch]);

  // Update shouldFetch when waitToFetch changes
  useEffect(() => {
    setShouldFetch(!waitToFetch);
  }, [waitToFetch]);

  // Use global query key to prevent duplicate requests across multiple component instances
  const queryKey: QueryKey = ["smartAccounts", "global", loginAuthenticator];
  const query = useQuery<
    SmartAccountWithCodeId[],
    unknown,
    SmartAccountWithCodeId[]
  >({
    queryKey,
    queryFn: async () => {
      console.log("[useAccountDiscovery] Starting account discovery");

      // Use stored authenticator type from AuthStateManager (set during login)
      // This avoids the need for complex pattern matching to detect type from string
      // All connection types (stytch, passkey, keplr, metamask, okx) now have known types
      let authenticatorType = loginAuthenticatorType;

      // Fallback to detection only in rare edge cases where type wasn't stored
      if (!authenticatorType && loginAuthenticator) {
        console.warn(
          "[useAccountDiscovery] Authenticator type not stored, falling back to detection",
        );
        authenticatorType = detectAuthenticatorType(loginAuthenticator);
      }

      if (!authenticatorType || !loginAuthenticator) {
        console.warn(
          "[useAccountDiscovery] Could not determine authenticator type",
        );
        return [];
      }

      // Query using xion.js composite strategy directly.
      // Cast authenticatorType: our @burnt-labs/signers includes ZKEmail; account-management's
      // nested signers type does not yet, but the runtime supports it.
      const result = await accountStrategy.fetchSmartAccounts(
        loginAuthenticator,
        authenticatorType,
      );

      console.log(`[useAccountDiscovery] Found ${result.length} account(s)`);
      return result;
    },
    // Retry strategy instead of continuous polling
    enabled: shouldFetch && Boolean(loginAuthenticator),
    retry: (failureCount, error) => {
      // Don't retry on client errors (400/404) - these won't succeed on retry
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (
          errorMsg.includes("400") ||
          errorMsg.includes("404") ||
          errorMsg.includes("bad request")
        ) {
          console.log(
            "[useAccountDiscovery] Client error detected, stopping retries",
          );
          return false;
        }
      }

      // Retry up to MAX_RETRIES times on network/server errors
      const shouldRetry = failureCount < MAX_RETRIES;
      if (shouldRetry) {
        console.log(
          `[useAccountDiscovery] Retry ${failureCount + 1}/${MAX_RETRIES}`,
        );
      }
      return shouldRetry;
    },
    retryDelay: (attemptIndex) => {
      const delay = Math.min(
        INITIAL_RETRY_DELAY * 2 ** attemptIndex,
        MAX_RETRY_DELAY,
      );
      console.log(`[useAccountDiscovery] Next retry in ${delay}ms`);
      return delay;
    },
    // No automatic refetching - only retry on failures or manual refetch
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    const { data } = query;

    if (abstractAccount) {
      // Account is selected, stop any retries
      setShouldFetch(false);
      setIsSuccess(true);
      handleSuccess?.();
    } else if (data && data.length > 0) {
      // Accounts found, mark as success
      setIsSuccess(true);
      handleSuccess?.();
    }
  }, [query.data, abstractAccount, handleSuccess]);

  return {
    data: query.data || [],
    loading: query.isLoading,
    error: query.error,
    isSuccess,
    retry: query.refetch,
  };
};
