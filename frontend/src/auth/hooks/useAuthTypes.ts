import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAuthenticatorTypes } from "../lib/auth-types";
import type { Authenticator } from "@burnt-labs/account-management";

export const useAuthTypes = (userIds: string[]) => {
  type AuthTypesRecord = Record<string, string[]>;
  const emptyAuthTypes: AuthTypesRecord = {};

  const query = useQuery<AuthTypesRecord>({
    queryKey: ["auth-types", userIds],
    queryFn: () =>
      getAuthenticatorTypes(userIds).then((data) => data ?? emptyAuthTypes),
    enabled:
      userIds.length > 0 && userIds.every((id) => id.startsWith("user-")), // Only enable for Stytch user IDs
  });

  // Create a map for efficient lookups with Apple ID special handling
  const authTypesMap = useMemo(() => {
    if (!query.data) return new Map<string, string>();

    return new Map(
      Object.entries(query.data).map(([userId, types]) => {
        // If there are two types and the second one is Apple, use the second one.
        // handles apple id "hide my email" case
        if (types.length === 2 && types[1] === "Apple") {
          return [userId, types[1]];
        }
        return [userId, types?.[0] || ""];
      }),
    );
  }, [query.data]);

  return {
    ...query,
    authTypesMap,
  };
};

// Utility function for sorting authenticators
export const useSortedAuthenticators = (
  authenticators: Authenticator[],
  currentAuthenticatorIndex: number,
) => {
  return useMemo(() => {
    if (!authenticators || authenticators.length === 0) return [];

    return [...authenticators].sort((a, b) => {
      const aIsActive = a.authenticatorIndex === currentAuthenticatorIndex;
      const bIsActive = b.authenticatorIndex === currentAuthenticatorIndex;

      // If one is active and the other isn't, active comes first
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // If both are active or both are inactive, maintain original order
      return 0;
    });
  }, [authenticators, currentAuthenticatorIndex]);
};
