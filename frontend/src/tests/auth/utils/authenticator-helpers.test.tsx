import { describe, expect, it } from "vitest";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import {
  findLowestMissingOrNextIndex,
  capitalizeFirstLetter,
  getAuthenticatorLabel,
  getAuthenticatorLogo,
  extractUserIdFromAuthenticator,
  isEmailAuthenticator,
  getUserEmail,
} from "../../../auth/utils/authenticator-helpers";
import type { AuthenticatorNodes } from "../../../types";

describe("authenticator-helpers", () => {
  describe("findLowestMissingOrNextIndex", () => {
    it("should throw error if authenticators is undefined", () => {
      expect(() => findLowestMissingOrNextIndex(undefined)).toThrow(
        "Missing authenticators",
      );
    });

    it("should return 0 for empty array", () => {
      expect(findLowestMissingOrNextIndex([])).toBe(0);
    });

    it("should return 0 if index 0 is missing", () => {
      const authenticators: AuthenticatorNodes[] = [
        {
          id: "test-1",
          authenticator: "auth1",
          authenticatorIndex: 1,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
        {
          id: "test-2",
          authenticator: "auth2",
          authenticatorIndex: 2,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
      ];
      expect(findLowestMissingOrNextIndex(authenticators)).toBe(0);
    });

    it("should return next index if all indices are sequential", () => {
      const authenticators: AuthenticatorNodes[] = [
        {
          id: "test-0",
          authenticator: "auth0",
          authenticatorIndex: 0,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
        {
          id: "test-1",
          authenticator: "auth1",
          authenticatorIndex: 1,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
        {
          id: "test-2",
          authenticator: "auth2",
          authenticatorIndex: 2,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
      ];
      expect(findLowestMissingOrNextIndex(authenticators)).toBe(3);
    });

    it("should return lowest missing index in a gap", () => {
      const authenticators: AuthenticatorNodes[] = [
        {
          id: "test-0",
          authenticator: "auth0",
          authenticatorIndex: 0,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
        {
          id: "test-2",
          authenticator: "auth2",
          authenticatorIndex: 2,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
        {
          id: "test-3",
          authenticator: "auth3",
          authenticatorIndex: 3,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
      ];
      expect(findLowestMissingOrNextIndex(authenticators)).toBe(1);
    });

    it("should handle single authenticator", () => {
      const authenticators: AuthenticatorNodes[] = [
        {
          id: "test-0",
          authenticator: "auth0",
          authenticatorIndex: 0,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
      ];
      expect(findLowestMissingOrNextIndex(authenticators)).toBe(1);
    });

    it("should handle non-sequential starting index", () => {
      const authenticators: AuthenticatorNodes[] = [
        {
          id: "test-5",
          authenticator: "auth5",
          authenticatorIndex: 5,
          type: AUTHENTICATOR_TYPE.JWT,
          version: "1",
          __typename: "Authenticator",
        },
      ];
      expect(findLowestMissingOrNextIndex(authenticators)).toBe(0);
    });
  });

  describe("capitalizeFirstLetter", () => {
    it("should capitalize first letter of a string", () => {
      expect(capitalizeFirstLetter("hello")).toBe("Hello");
    });

    it("should return empty string for undefined", () => {
      expect(capitalizeFirstLetter(undefined)).toBe("");
    });

    it("should return empty string for empty string", () => {
      expect(capitalizeFirstLetter("")).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(capitalizeFirstLetter(undefined)).toBe("");
    });

    it("should return empty string for empty string", () => {
      expect(capitalizeFirstLetter("")).toBe("");
    });

    it("should handle single character", () => {
      expect(capitalizeFirstLetter("a")).toBe("A");
    });

    it("should not change already capitalized string", () => {
      expect(capitalizeFirstLetter("Hello")).toBe("Hello");
    });

    it("should handle strings starting with numbers", () => {
      expect(capitalizeFirstLetter("123abc")).toBe("123abc");
    });
  });

  describe("getAuthenticatorLabel", () => {
    it("should return 'Cosmos Wallet' for SECP256K1", () => {
      expect(getAuthenticatorLabel("SECP256K1")).toBe("Cosmos Wallet");
    });

    it("should return 'EVM Wallet' for ETHWALLET", () => {
      expect(getAuthenticatorLabel("ETHWALLET")).toBe("EVM Wallet");
    });

    it("should return 'Email' for AUTHENTICATOR_TYPE.JWT", () => {
      expect(getAuthenticatorLabel("JWT")).toBe("Email");
    });

    it("should return 'Passkey' for PASSKEY", () => {
      expect(getAuthenticatorLabel("PASSKEY")).toBe("Passkey");
    });

    it("should return empty string for unknown type", () => {
      // @ts-expect-error - Testing unknown type
      expect(getAuthenticatorLabel("UNKNOWN")).toBe("");
    });
  });

  describe("getAuthenticatorLogo", () => {
    it("should return CosmosLogo for SECP256K1", () => {
      const logo = getAuthenticatorLogo("SECP256K1");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("CosmosLogo");
    });

    it("should return EthereumLogo for ETHWALLET", () => {
      const logo = getAuthenticatorLogo("ETHWALLET");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("EthereumLogo");
    });

    it("should return PasskeyIcon for PASSKEY", () => {
      const logo = getAuthenticatorLogo("PASSKEY");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("PasskeyIcon");
    });

    it("should return EmailIcon for AUTHENTICATOR_TYPE.JWT without subtype", () => {
      const logo = getAuthenticatorLogo("JWT");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("EmailIcon");
    });

    it("should return EmailIcon for AUTHENTICATOR_TYPE.JWT with email subtype", () => {
      const logo = getAuthenticatorLogo("JWT", "email");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("EmailIcon");
    });

    it("should return GoogleLogoIcon for AUTHENTICATOR_TYPE.JWT with google subtype", () => {
      const logo = getAuthenticatorLogo("JWT", "google");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("GoogleLogoIcon");
    });

    it("should return AppleLogoIcon for AUTHENTICATOR_TYPE.JWT with apple subtype", () => {
      const logo = getAuthenticatorLogo("JWT", "apple");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("AppleLogoIcon");
    });

    it("should return GithubLogoIcon for AUTHENTICATOR_TYPE.JWT with github subtype", () => {
      const logo = getAuthenticatorLogo("JWT", "github");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("GithubLogoIcon");
    });

    it("should return XLogoIcon for AUTHENTICATOR_TYPE.JWT with twitter subtype", () => {
      const logo = getAuthenticatorLogo("JWT", "twitter");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("XLogoIcon");
    });

    it("should return EmailIcon for AUTHENTICATOR_TYPE.JWT with unknown subtype", () => {
      const logo = getAuthenticatorLogo("JWT", "unknown_provider");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("EmailIcon");
    });

    it("should return AccountWalletLogo for unknown type", () => {
      // @ts-expect-error - Testing unknown type
      const logo = getAuthenticatorLogo("UNKNOWN");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("AccountWalletLogo");
    });

    it("should return ZKEmailIcon for ZKEMAIL", () => {
      const logo = getAuthenticatorLogo("ZKEMAIL");
      expect(logo).toBeDefined();
      expect(logo.type.name).toBe("ZKEmailIcon");
    });
  });

  describe("extractUserIdFromAuthenticator", () => {
    it("should extract userId from AUTHENTICATOR_TYPE.JWT authenticator", () => {
      expect(extractUserIdFromAuthenticator("identifier.user123", "JWT")).toBe(
        "user123",
      );
    });

    it("should extract userId from AUTHENTICATOR_TYPE.JWT authenticator (case variation)", () => {
      expect(extractUserIdFromAuthenticator("identifier.user456", "JWT")).toBe(
        "user456",
      );
    });

    it("should return null for non-AUTHENTICATOR_TYPE.JWT type", () => {
      expect(
        extractUserIdFromAuthenticator("some.authenticator", "SECP256K1"),
      ).toBeNull();
    });

    it("should return null if authenticator has no dot separator", () => {
      expect(
        extractUserIdFromAuthenticator("nodotauthenticator", "JWT"),
      ).toBeNull();
    });

    it("should return null for ETHWALLET type", () => {
      expect(
        extractUserIdFromAuthenticator("identifier.userid", "ETHWALLET"),
      ).toBeNull();
    });

    it("should return null for PASSKEY type", () => {
      expect(
        extractUserIdFromAuthenticator("identifier.userid", "PASSKEY"),
      ).toBeNull();
    });

    it("should return authenticator string for ZKEmail type", () => {
      expect(
        extractUserIdFromAuthenticator("user@example.com", "ZKEmail"),
      ).toBe("user@example.com");
    });

    it("should handle authenticator with multiple dots", () => {
      expect(extractUserIdFromAuthenticator("part1.part2.part3", "JWT")).toBe(
        "part2",
      );
    });
  });

  describe("isEmailAuthenticator", () => {
    it("should return true for AUTHENTICATOR_TYPE.JWT type with email subtype", () => {
      expect(isEmailAuthenticator("JWT", "email")).toBe(true);
    });

    it("should return true for AUTHENTICATOR_TYPE.JWT type with Email subtype (case insensitive)", () => {
      expect(isEmailAuthenticator("JWT", "Email")).toBe(true);
    });

    it("should return true for AUTHENTICATOR_TYPE.JWT type with EMAIL subtype (uppercase)", () => {
      expect(isEmailAuthenticator("JWT", "EMAIL")).toBe(true);
    });

    it("should return false for AUTHENTICATOR_TYPE.JWT type with google subtype", () => {
      expect(isEmailAuthenticator("JWT", "google")).toBe(false);
    });

    it("should return false for non-AUTHENTICATOR_TYPE.JWT type", () => {
      expect(isEmailAuthenticator("SECP256K1", "email")).toBe(false);
    });

    it("should return false for AUTHENTICATOR_TYPE.JWT type without subtype", () => {
      expect(isEmailAuthenticator("JWT")).toBe(false);
    });

    it("should return false for AUTHENTICATOR_TYPE.JWT type with undefined subtype", () => {
      expect(isEmailAuthenticator("JWT", undefined)).toBe(false);
    });
  });

  describe("getUserEmail", () => {
    it("should return email when user and userId match", () => {
      const user = {
        user_id: "user123",
        emails: [{ email: "test@example.com" }],
      };
      expect(getUserEmail(user, "user123")).toBe("test@example.com");
    });

    it("should return empty string when user is null", () => {
      expect(getUserEmail(null, "user123")).toBe("");
    });

    it("should return empty string when userId is null", () => {
      const user = {
        user_id: "user123",
        emails: [{ email: "test@example.com" }],
      };
      expect(getUserEmail(user, null)).toBe("");
    });

    it("should return empty string when user_id does not match userId", () => {
      const user = {
        user_id: "user123",
        emails: [{ email: "test@example.com" }],
      };
      expect(getUserEmail(user, "different_user")).toBe("");
    });

    it("should return empty string when user has no emails", () => {
      const user = {
        user_id: "user123",
        emails: [],
      };
      expect(getUserEmail(user, "user123")).toBe("");
    });

    it("should return first email when user has multiple emails", () => {
      const user = {
        user_id: "user123",
        emails: [
          { email: "first@example.com" },
          { email: "second@example.com" },
        ],
      };
      expect(getUserEmail(user, "user123")).toBe("first@example.com");
    });

    it("should return empty string when emails is undefined", () => {
      const user = {
        user_id: "user123",
        emails: undefined as unknown as Array<{ email: string }>,
      };
      expect(getUserEmail(user, "user123")).toBe("");
    });
  });
});
