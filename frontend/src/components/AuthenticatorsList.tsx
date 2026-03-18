import React, { useMemo } from "react";
import { User } from "@stytch/vanilla-js";
import type { Authenticator } from "@burnt-labs/account-management";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import {
  useAuthTypes,
  useSortedAuthenticators,
} from "../auth/hooks/useAuthTypes";
import { AuthenticatorItem } from "./AuthenticatorItem";
import { AuthenticatorsLoadingSkeleton } from "./AuthenticatorsLoadingSkeleton";
import { extractUserIdFromAuthenticator } from "../auth/utils/authenticator-helpers";

interface AuthenticatorsListProps {
  authenticators: Authenticator[];
  currentAuthenticatorIndex: number;
  isMainnet: boolean;
  onRemoveAuthenticator: (authenticator: Authenticator) => void;
  user: User | null;
}

export const AuthenticatorsList: React.FC<AuthenticatorsListProps> = ({
  authenticators,
  currentAuthenticatorIndex,
  isMainnet,
  onRemoveAuthenticator,
  user,
}) => {
  // Memoize userIds extraction to avoid recalculation on every render
  const userIds = useMemo(() => {
    console.log("[AuthenticatorsList] Authenticators:", authenticators);
    const extracted = authenticators
      .map((authenticator) => {
        const userId = extractUserIdFromAuthenticator(
          authenticator.authenticator,
          authenticator.type,
        );
        console.log("[AuthenticatorsList] Extracted userId:", {
          authenticator: authenticator.authenticator,
          type: authenticator.type,
          userId,
        });
        return userId;
      })
      .filter((userId): userId is string => userId !== null);
    console.log("[AuthenticatorsList] Final userIds:", extracted);
    return extracted;
  }, [authenticators]);

  // Fetch auth types with processed map
  const { authTypesMap, error, isLoading } = useAuthTypes(userIds);

  // Get sorted authenticators
  const sortedAuthenticators = useSortedAuthenticators(
    authenticators,
    currentAuthenticatorIndex,
  );

  // Handle error state
  if (error) {
    console.error("Failed to fetch authenticator types:", error);
    // Continue rendering with fallback labels
  }

  // Handle empty state
  if (!authenticators || authenticators.length === 0) {
    return (
      <div className="ui-flex ui-items-center ui-justify-center ui-px-4 ui-py-6 ui-text-secondary-text">
        No authenticators configured
      </div>
    );
  }

  // Show skeleton while loading auth types for JWT authenticators
  // Only show skeleton if we have JWT authenticators that need type resolution
  const hasJwtAuthenticators = authenticators.some(
    (auth) => auth.type === AUTHENTICATOR_TYPE.JWT,
  );
  if (isLoading && hasJwtAuthenticators) {
    return <AuthenticatorsLoadingSkeleton />;
  }

  return (
    <div className="ui-flex ui-flex-col ui-gap-4">
      {sortedAuthenticators.map((authenticator) => {
        const userId = extractUserIdFromAuthenticator(
          authenticator.authenticator,
          authenticator.type,
        );
        const authType = userId ? authTypesMap.get(userId) : undefined;

        return (
          <AuthenticatorItem
            key={authenticator.id}
            authenticator={authenticator}
            currentAuthenticatorIndex={currentAuthenticatorIndex}
            isMainnet={isMainnet}
            onRemove={onRemoveAuthenticator}
            user={user}
            authType={authType}
            authenticators={authenticators}
          />
        );
      })}
    </div>
  );
};
