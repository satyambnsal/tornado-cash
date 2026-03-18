import { OAuthProviders } from "@stytch/core/public";
import type { Authenticator } from "@burnt-labs/account-management";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import type { authenticatorTypes } from "../../types";
import {
  AccountWalletLogo,
  CosmosLogo,
  EmailIcon,
  EthereumLogo,
  PasskeyIcon,
  AppleLogoIcon,
  GoogleLogoIcon,
  GithubLogoIcon,
  XLogoIcon,
  ZKEmailIcon,
} from "../../components/ui";

/**
 * Returns the lowest missing or next index
 *
 * @returns {number} - Returns the lowest missing or next index.
 * @throws {Error} - If authenticators array is null or undefined.
 */
export function findLowestMissingOrNextIndex(
  authenticators?: Authenticator[],
): number {
  if (!authenticators) {
    throw new Error("Missing authenticators");
  }

  const indexSet = new Set(
    authenticators.map((authenticator) => authenticator.authenticatorIndex),
  );

  let i = 0;
  while (true) {
    if (!indexSet.has(i)) {
      return i;
    }
    i++;
  }
}

export const capitalizeFirstLetter = (string: string | undefined) => {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export const getAuthenticatorLabel = (type: authenticatorTypes): string => {
  const labels: Record<authenticatorTypes, string> = {
    SECP256K1: "Cosmos Wallet",
    ETHWALLET: "EVM Wallet",
    JWT: "Email",
    PASSKEY: "Passkey",
    ZKEMAIL: "ZKEmail",
  };
  return labels[type] || "";
};

const getJwtLogo = (subType: string) => {
  const normalizedType = subType.toLowerCase();

  switch (normalizedType) {
    case OAuthProviders.Google:
      return <GoogleLogoIcon />;
    case OAuthProviders.Apple:
      return <AppleLogoIcon />;
    case OAuthProviders.Github:
      return <GithubLogoIcon />;
    case OAuthProviders.Twitter:
      return <XLogoIcon />;
    case "email":
      return <EmailIcon className="ui-w-4 ui-h-4" />;
    default:
      return <EmailIcon className="ui-w-4 ui-h-4" />;
  }
};

export const getAuthenticatorLogo = (
  type: authenticatorTypes,
  jwtSubType?: string,
  // @ts-expect-error - Return type inference
): JSX.Element => {
  // @ts-expect-error - Logo map type
  const logoMap: Record<authenticatorTypes, JSX.Element> = {
    SECP256K1: <CosmosLogo className="ui-w-4 ui-h-4" />,
    ETHWALLET: <EthereumLogo className="ui-w-4 ui-h-4" />,
    JWT: jwtSubType ? (
      getJwtLogo(jwtSubType)
    ) : (
      <EmailIcon className="ui-w-4 ui-h-4" />
    ),
    PASSKEY: <PasskeyIcon />,
    ZKEMAIL: <ZKEmailIcon className="ui-w-4 ui-h-4" />,
  };

  return logoMap[type] || <AccountWalletLogo />;
};

export const extractUserIdFromAuthenticator = (
  authenticator: string,
  type: string,
): string | null => {
  // Only JWT authenticators have the format "identifier.userid"
  if (type === AUTHENTICATOR_TYPE.JWT) {
    const parts = authenticator.split(".");
    return parts[1] || null;
  }
  // For zk-email, the authenticator is the email address itself
  if (type === AUTHENTICATOR_TYPE.ZKEmail) {
    return authenticator;
  }
  return null;
};

export const isEmailAuthenticator = (
  type: string,
  jwtSubType?: string,
): boolean => {
  return (
    type === AUTHENTICATOR_TYPE.JWT && jwtSubType?.toLowerCase() === "email"
  );
};

export const getUserEmail = (
  user: { user_id: string; emails: Array<{ email: string }> } | null,
  userId: string | null,
): string => {
  if (!user || !userId || user.user_id !== userId) {
    return "";
  }
  return user.emails?.[0]?.email || "";
};
