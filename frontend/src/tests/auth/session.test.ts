import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeJWT,
  extractXionClaims,
  getAddressFromJWT,
  getAuthenticatorIndexFromJWT,
  getAddressFromSession,
  getAuthenticatorIndexFromSession,
  getLoginAuthenticatorFromJWT,
  isJWTExpired,
  getJWTExpiration,
  SessionManager,
} from "../../auth/session";

// Helper to create a valid base64-encoded JWT payload
function createMockJWT(payload: object, exp?: number): string {
  const header = { alg: "RS256", typ: "JWT" };
  const payloadWithExp = {
    ...payload,
    exp: exp ?? Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
  };

  const encodeBase64 = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return `${encodeBase64(header)}.${encodeBase64(payloadWithExp)}.signature`;
}

describe("JWT Utilities", () => {
  describe("decodeJWT", () => {
    it("should decode a valid JWT", () => {
      const payload = { sub: "user123", aud: "my-app" };
      const jwt = createMockJWT(payload);

      const decoded = decodeJWT(jwt);

      expect(decoded.sub).toBe("user123");
      expect(decoded.aud).toBe("my-app");
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it("should throw error for invalid JWT format (not 3 parts)", () => {
      expect(() => decodeJWT("invalid.jwt")).toThrow(
        "Invalid JWT format: expected 3 parts",
      );
      expect(() => decodeJWT("just-a-string")).toThrow(
        "Invalid JWT format: expected 3 parts",
      );
    });

    it("should handle non-Error throws during decoding", () => {
      const originalAtob = global.atob;
      global.atob = vi.fn(() => {
        throw "String error";
      });

      expect(() => decodeJWT("header.payload.signature")).toThrow(
        "Failed to decode JWT: Unknown error",
      );

      global.atob = originalAtob;
    });

    it("should throw error for invalid base64", () => {
      expect(() => decodeJWT("a.!!!invalid!!!.c")).toThrow(
        "Failed to decode JWT",
      );
    });

    it("should handle URL-safe base64 characters", () => {
      // Create a JWT with URL-safe base64 characters
      const payload = { data: "test+/data" };
      const jwt = createMockJWT(payload);

      const decoded = decodeJWT(jwt);
      expect(decoded).toBeDefined();
    });
  });

  describe("extractXionClaims", () => {
    it("should extract claims from modern format (direct xion claims)", () => {
      const source = {
        "https://xion.burnt.com/claims": {
          abstract_account_address: "xion1modern",
          current_authenticator_index: 3,
        },
      };

      const claims = extractXionClaims(source);
      expect(claims.address).toBe("xion1modern");
      expect(claims.authenticatorIndex).toBe(3);
    });

    it("should extract claims from legacy Stytch format", () => {
      const source = {
        "https://stytch.com/session": {
          custom_claims: {
            "https://xion.burnt.com/claims": {
              abstract_account_address: "xion1legacy",
              current_authenticator_index: 2,
            },
          },
        },
      };

      const claims = extractXionClaims(source);
      expect(claims.address).toBe("xion1legacy");
      expect(claims.authenticatorIndex).toBe(2);
    });

    it("should extract claims from old Stytch format (direct custom_claims)", () => {
      const source = {
        "https://stytch.com/session": {
          custom_claims: {
            abstract_account_address: "xion1old",
            current_authenticator_index: 1,
          },
        },
      };

      const claims = extractXionClaims(source);
      expect(claims.address).toBe("xion1old");
      expect(claims.authenticatorIndex).toBe(1);
    });

    it("should extract claims from session object format", () => {
      const source = {
        custom_claims: {
          "https://xion.burnt.com/claims": {
            abstract_account_address: "xion1session",
            current_authenticator_index: 4,
          },
        },
      };

      const claims = extractXionClaims(source);
      expect(claims.address).toBe("xion1session");
      expect(claims.authenticatorIndex).toBe(4);
    });

    it("should extract claims from nested stytch_session format", () => {
      const source = {
        stytch_session: {
          session: {
            custom_claims: {
              "https://xion.burnt.com/claims": {
                abstract_account_address: "xion1nested",
                current_authenticator_index: 5,
              },
            },
          },
        },
      };

      const claims = extractXionClaims(source);
      expect(claims.address).toBe("xion1nested");
      expect(claims.authenticatorIndex).toBe(5);
    });

    it("should extract claims from root level (fallback)", () => {
      const source = {
        abstract_account_address: "xion1root",
        current_authenticator_index: 6,
      };

      const claims = extractXionClaims(source);
      expect(claims.address).toBe("xion1root");
      expect(claims.authenticatorIndex).toBe(6);
    });

    it("should return defaults for null/undefined source", () => {
      expect(extractXionClaims(null)).toEqual({
        address: null,
        authenticatorIndex: 0,
      });
      expect(extractXionClaims(undefined)).toEqual({
        address: null,
        authenticatorIndex: 0,
      });
    });

    it("should return defaults for non-object source", () => {
      expect(extractXionClaims("string")).toEqual({
        address: null,
        authenticatorIndex: 0,
      });
      expect(extractXionClaims(123)).toEqual({
        address: null,
        authenticatorIndex: 0,
      });
    });

    it("should return defaults when no claims found", () => {
      const source = { someOtherData: "value" };
      const claims = extractXionClaims(source);
      expect(claims.address).toBeNull();
      expect(claims.authenticatorIndex).toBe(0);
    });

    it("should default authenticator index to 0 if not present", () => {
      const source = {
        "https://xion.burnt.com/claims": {
          abstract_account_address: "xion1noindex",
        },
      };

      const claims = extractXionClaims(source);
      expect(claims.address).toBe("xion1noindex");
      expect(claims.authenticatorIndex).toBe(0);
    });
  });

  describe("getAddressFromJWT", () => {
    it("should extract address from JWT", () => {
      const jwt = createMockJWT({
        "https://xion.burnt.com/claims": {
          abstract_account_address: "xion1fromjwt",
          current_authenticator_index: 0,
        },
      });

      expect(getAddressFromJWT(jwt)).toBe("xion1fromjwt");
    });

    it("should return null for invalid JWT", () => {
      expect(getAddressFromJWT("invalid-jwt")).toBeNull();
    });

    it("should return null for JWT without address", () => {
      const jwt = createMockJWT({ sub: "user" });
      expect(getAddressFromJWT(jwt)).toBeNull();
    });
  });

  describe("getAuthenticatorIndexFromJWT", () => {
    it("should extract authenticator index from JWT", () => {
      const jwt = createMockJWT({
        "https://xion.burnt.com/claims": {
          abstract_account_address: "xion1test",
          current_authenticator_index: 7,
        },
      });

      expect(getAuthenticatorIndexFromJWT(jwt)).toBe(7);
    });

    it("should return 0 for invalid JWT", () => {
      expect(getAuthenticatorIndexFromJWT("invalid-jwt")).toBe(0);
    });

    it("should return 0 for JWT without index", () => {
      const jwt = createMockJWT({ sub: "user" });
      expect(getAuthenticatorIndexFromJWT(jwt)).toBe(0);
    });
  });

  describe("getAddressFromSession", () => {
    it("should extract address from session object", () => {
      const session = {
        "https://xion.burnt.com/claims": {
          abstract_account_address: "xion1session",
        },
      };

      expect(getAddressFromSession(session)).toBe("xion1session");
    });

    it("should return null for null session", () => {
      expect(getAddressFromSession(null)).toBeNull();
    });
  });

  describe("getAuthenticatorIndexFromSession", () => {
    it("should extract index from session object", () => {
      const session = {
        "https://xion.burnt.com/claims": {
          abstract_account_address: "xion1test",
          current_authenticator_index: 3,
        },
      };

      expect(getAuthenticatorIndexFromSession(session)).toBe(3);
    });

    it("should return 0 for null session", () => {
      expect(getAuthenticatorIndexFromSession(null)).toBe(0);
    });
  });

  describe("getLoginAuthenticatorFromJWT", () => {
    it("should return aud.sub format", () => {
      const jwt = createMockJWT({
        aud: "my-app",
        sub: "user123",
      });

      expect(getLoginAuthenticatorFromJWT(jwt)).toBe("my-app.user123");
    });

    it("should handle array aud (use first element)", () => {
      const jwt = createMockJWT({
        aud: ["app1", "app2"],
        sub: "user456",
      });

      expect(getLoginAuthenticatorFromJWT(jwt)).toBe("app1.user456");
    });

    it("should return null for invalid JWT", () => {
      expect(getLoginAuthenticatorFromJWT("invalid")).toBeNull();
    });

    it("should return null if aud is missing", () => {
      const jwt = createMockJWT({ sub: "user" });
      expect(getLoginAuthenticatorFromJWT(jwt)).toBeNull();
    });

    it("should return null if sub is missing", () => {
      const jwt = createMockJWT({ aud: "app" });
      expect(getLoginAuthenticatorFromJWT(jwt)).toBeNull();
    });
  });

  describe("isJWTExpired", () => {
    it("should return false for non-expired JWT", () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const jwt = createMockJWT({}, futureExp);

      expect(isJWTExpired(jwt)).toBe(false);
    });

    it("should return true for expired JWT", () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const jwt = createMockJWT({}, pastExp);

      expect(isJWTExpired(jwt)).toBe(true);
    });

    it("should respect buffer time", () => {
      // Expires in 30 seconds
      const soonExp = Math.floor(Date.now() / 1000) + 30;
      const jwt = createMockJWT({}, soonExp);

      // With 60 second buffer (default), should be "expired"
      expect(isJWTExpired(jwt, 60000)).toBe(true);

      // With 10 second buffer, should not be expired yet
      expect(isJWTExpired(jwt, 10000)).toBe(false);
    });

    it("should return true for invalid JWT", () => {
      expect(isJWTExpired("invalid")).toBe(true);
    });

    it("should return true if no exp claim", () => {
      // Create JWT without exp
      const header = { alg: "RS256" };
      const payload = { sub: "user" };
      const encode = (obj: object) => btoa(JSON.stringify(obj));
      const jwt = `${encode(header)}.${encode(payload)}.sig`;

      expect(isJWTExpired(jwt)).toBe(true);
    });
  });

  describe("getJWTExpiration", () => {
    it("should return expiration timestamp in milliseconds", () => {
      const expSeconds = Math.floor(Date.now() / 1000) + 3600;
      const jwt = createMockJWT({}, expSeconds);

      expect(getJWTExpiration(jwt)).toBe(expSeconds * 1000);
    });

    it("should return null for invalid JWT", () => {
      expect(getJWTExpiration("invalid")).toBeNull();
    });

    it("should return null if no exp claim", () => {
      const header = { alg: "RS256" };
      const payload = { sub: "user" };
      const encode = (obj: object) => btoa(JSON.stringify(obj));
      const jwt = `${encode(header)}.${encode(payload)}.sig`;

      expect(getJWTExpiration(jwt)).toBeNull();
    });
  });
});

describe("SessionManager", () => {
  let mockSessionStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    length: number;
    key: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockSessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });
  });

  const testOrigin = "https://example.com";
  const storageKey = `xion_session_${testOrigin}`;

  describe("getSessionData", () => {
    it("should return null if no session exists", () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      expect(SessionManager.getSessionData(testOrigin)).toBeNull();
    });

    it("should return session data if valid", () => {
      const now = Date.now();
      const sessionData = {
        jwt: "test-jwt",
        address: "xion1test",
        authenticatorIndex: 2,
        lastActivity: now - 1000, // 1 second ago
        createdAt: now - 60000, // 1 minute ago
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = SessionManager.getSessionData(testOrigin);
      expect(result).toEqual({
        address: "xion1test",
        authenticatorIndex: 2,
      });
    });

    it("should return null and clear session if inactivity timeout exceeded", () => {
      const now = Date.now();
      const sessionData = {
        jwt: "test-jwt",
        address: "xion1test",
        authenticatorIndex: 0,
        lastActivity: now - 31 * 60 * 1000, // 31 minutes ago
        createdAt: now - 60 * 60 * 1000, // 1 hour ago
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = SessionManager.getSessionData(testOrigin);
      expect(result).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(storageKey);
    });

    it("should return null and clear session if max lifetime exceeded", () => {
      const now = Date.now();
      const sessionData = {
        jwt: "test-jwt",
        address: "xion1test",
        authenticatorIndex: 0,
        lastActivity: now - 1000, // 1 second ago (recent)
        createdAt: now - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = SessionManager.getSessionData(testOrigin);
      expect(result).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(storageKey);
    });

    it("should return null if address is missing", () => {
      const now = Date.now();
      const sessionData = {
        jwt: "test-jwt",
        lastActivity: now,
        createdAt: now,
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(SessionManager.getSessionData(testOrigin)).toBeNull();
    });

    it("should handle JSON parse errors", () => {
      mockSessionStorage.getItem.mockReturnValue("invalid-json");

      expect(SessionManager.getSessionData(testOrigin)).toBeNull();
    });

    it("should default authenticatorIndex to 0 when not present", () => {
      const now = Date.now();
      const sessionData = {
        jwt: "test-jwt",
        address: "xion1test",
        // authenticatorIndex is not set
        lastActivity: now,
        createdAt: now,
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = SessionManager.getSessionData(testOrigin);
      expect(result).toEqual({
        address: "xion1test",
        authenticatorIndex: 0,
      });
    });
  });

  describe("getSession", () => {
    it("should return null if no session exists", () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      expect(SessionManager.getSession(testOrigin)).toBeNull();
    });

    it("should return JWT and update lastActivity", () => {
      const now = Date.now();
      const sessionData = {
        jwt: "my-jwt-token",
        lastActivity: now - 1000,
        createdAt: now - 60000,
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = SessionManager.getSession(testOrigin);
      expect(result).toBe("my-jwt-token");

      // Should have updated the session with new lastActivity
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
    });

    it("should return null and clear if inactivity timeout exceeded", () => {
      const now = Date.now();
      const sessionData = {
        jwt: "test-jwt",
        lastActivity: now - 31 * 60 * 1000, // 31 minutes ago
        createdAt: now - 60 * 60 * 1000,
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(SessionManager.getSession(testOrigin)).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
    });

    it("should return null and clear if max lifetime exceeded", () => {
      const now = Date.now();
      const sessionData = {
        jwt: "test-jwt",
        lastActivity: now - 1000,
        createdAt: now - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(SessionManager.getSession(testOrigin)).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
    });

    it("should handle errors gracefully", () => {
      mockSessionStorage.getItem.mockReturnValue("not-json");

      expect(SessionManager.getSession(testOrigin)).toBeNull();
    });
  });

  describe("getSessionToken", () => {
    it("should return null if no session exists", () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      expect(SessionManager.getSessionToken(testOrigin)).toBeNull();
    });

    it("should return session token", () => {
      const sessionData = {
        jwt: "jwt",
        token: "my-session-token",
        lastActivity: Date.now(),
        createdAt: Date.now(),
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(SessionManager.getSessionToken(testOrigin)).toBe(
        "my-session-token",
      );
    });

    it("should return null if token is not set", () => {
      const sessionData = {
        jwt: "jwt",
        lastActivity: Date.now(),
        createdAt: Date.now(),
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(SessionManager.getSessionToken(testOrigin)).toBeNull();
    });

    it("should handle errors gracefully", () => {
      mockSessionStorage.getItem.mockReturnValue("invalid");

      expect(SessionManager.getSessionToken(testOrigin)).toBeNull();
    });
  });

  describe("setSession", () => {
    it("should store session data", () => {
      SessionManager.setSession(
        testOrigin,
        "jwt-value",
        "token-value",
        "xion1addr",
        3,
      );

      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      const [key, value] = mockSessionStorage.setItem.mock.calls[0];
      expect(key).toBe(storageKey);

      const stored = JSON.parse(value);
      expect(stored.jwt).toBe("jwt-value");
      expect(stored.token).toBe("token-value");
      expect(stored.address).toBe("xion1addr");
      expect(stored.authenticatorIndex).toBe(3);
      expect(stored.lastActivity).toBeDefined();
      expect(stored.createdAt).toBeDefined();
    });

    it("should work with optional parameters", () => {
      SessionManager.setSession(testOrigin, "jwt-only");

      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      const stored = JSON.parse(mockSessionStorage.setItem.mock.calls[0][1]);
      expect(stored.jwt).toBe("jwt-only");
      expect(stored.token).toBeUndefined();
    });

    it("should handle storage errors gracefully", () => {
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error("Storage full");
      });

      // Should not throw
      expect(() => SessionManager.setSession(testOrigin, "jwt")).not.toThrow();
    });
  });

  describe("clearSession", () => {
    it("should remove session from storage", () => {
      SessionManager.clearSession(testOrigin);

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(storageKey);
    });

    it("should handle errors gracefully", () => {
      mockSessionStorage.removeItem.mockImplementation(() => {
        throw new Error("Storage error");
      });

      expect(() => SessionManager.clearSession(testOrigin)).not.toThrow();
    });
  });

  describe("clearAllSessions", () => {
    it("should clear all xion_session keys", () => {
      mockSessionStorage.length = 4;
      mockSessionStorage.key.mockImplementation((i: number) => {
        const keys = [
          "xion_session_origin1",
          "other_key",
          "xion_session_origin2",
          "another_key",
        ];
        return keys[i];
      });

      SessionManager.clearAllSessions();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "xion_session_origin1",
      );
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "xion_session_origin2",
      );
      expect(mockSessionStorage.removeItem).toHaveBeenCalledTimes(2);
    });

    it("should handle errors gracefully", () => {
      mockSessionStorage.length = 1;
      mockSessionStorage.key.mockImplementation(() => {
        throw new Error("Error");
      });

      expect(() => SessionManager.clearAllSessions()).not.toThrow();
    });
  });

  describe("hasValidSession", () => {
    it("should return false if no session", () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      expect(SessionManager.hasValidSession(testOrigin)).toBe(false);
    });

    it("should return true for valid non-expired session", () => {
      const now = Date.now();
      const futureExp = Math.floor(now / 1000) + 3600;
      const jwt = createMockJWT({}, futureExp);

      const sessionData = {
        jwt,
        lastActivity: now,
        createdAt: now,
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(SessionManager.hasValidSession(testOrigin)).toBe(true);
    });

    it("should return false for expired JWT", () => {
      const now = Date.now();
      const pastExp = Math.floor(now / 1000) - 3600;
      const jwt = createMockJWT({}, pastExp);

      const sessionData = {
        jwt,
        lastActivity: now,
        createdAt: now,
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(SessionManager.hasValidSession(testOrigin)).toBe(false);
    });
  });

  describe("validateSessionWithStytch", () => {
    it("should return false if no stytchClient", async () => {
      expect(await SessionManager.validateSessionWithStytch(null)).toBe(false);
      expect(await SessionManager.validateSessionWithStytch(undefined)).toBe(
        false,
      );
    });

    it("should return true for successful authentication", async () => {
      const mockClient = {
        session: {
          authenticate: vi.fn().mockResolvedValue({ status_code: 200 }),
        },
      };

      expect(await SessionManager.validateSessionWithStytch(mockClient)).toBe(
        true,
      );
    });

    it("should return false for failed authentication", async () => {
      const mockClient = {
        session: {
          authenticate: vi.fn().mockResolvedValue({ status_code: 400 }),
        },
      };

      expect(await SessionManager.validateSessionWithStytch(mockClient)).toBe(
        false,
      );
    });

    it("should return false on error", async () => {
      const mockClient = {
        session: {
          authenticate: vi.fn().mockRejectedValue(new Error("Auth failed")),
        },
      };

      expect(await SessionManager.validateSessionWithStytch(mockClient)).toBe(
        false,
      );
    });
  });
});
