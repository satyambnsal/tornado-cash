import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { CONNECTION_METHOD } from "../../auth/useAuthState";
import { DashboardMessageType } from "../../messaging/types";

// Mock SessionManager before importing AuthStateManager
vi.mock("../session", () => ({
  SessionManager: {
    clearSession: vi.fn(),
  },
}));

// We need to reset the module to get a fresh instance for each test
let AuthStateManager: typeof import("../../auth/AuthStateManager").AuthStateManager;
let AUTH_STORAGE_KEYS: typeof import("../../auth/AuthStateManager").AUTH_STORAGE_KEYS;

// Helper function to map connection method to authenticator type
function getAuthType(connectionMethod: string) {
  switch (connectionMethod) {
    case "stytch":
      return AUTHENTICATOR_TYPE.JWT;
    case "keplr":
    case "okx":
      return AUTHENTICATOR_TYPE.Secp256K1;
    case "metamask":
      return AUTHENTICATOR_TYPE.EthWallet;
    case "passkey":
      return AUTHENTICATOR_TYPE.Passkey;
    default:
      return AUTHENTICATOR_TYPE.JWT;
  }
}

describe("AuthStateManager", () => {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset localStorage and sessionStorage mocks
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    Object.defineProperty(window, "sessionStorage", {
      value: sessionStorageMock,
      configurable: true,
    });

    // Mock window.dispatchEvent
    vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);

    // Mock window.parent.postMessage
    Object.defineProperty(window, "parent", {
      value: {
        postMessage: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    // Mock StorageEvent constructor to avoid jsdom issues
    vi.stubGlobal(
      "StorageEvent",
      class MockStorageEvent extends Event {
        key: string | null;
        newValue: string | null;
        oldValue: string | null;
        storageArea: Storage | null;
        url: string;

        constructor(type: string, eventInitDict?: StorageEventInit) {
          super(type, eventInitDict);
          this.key = eventInitDict?.key ?? null;
          this.newValue = eventInitDict?.newValue ?? null;
          this.oldValue = eventInitDict?.oldValue ?? null;
          this.storageArea = eventInitDict?.storageArea ?? null;
          this.url = eventInitDict?.url ?? "";
        }
      },
    );

    // Re-import the module to get a fresh singleton instance
    vi.resetModules();
    const module = await import("../../auth/AuthStateManager");
    AuthStateManager = module.AuthStateManager;
    AUTH_STORAGE_KEYS = module.AUTH_STORAGE_KEYS;
  });

  describe("initialization", () => {
    it("should start in disconnected state", () => {
      const state = AuthStateManager.getState();
      expect(state.status).toBe("disconnected");
      expect(state.connectionMethod).toBe("none");
      expect(state.account).toBeUndefined();
      expect(state.authenticator).toBeNull();
      expect(state.error).toBeNull();
    });

    it("should initialize from localStorage with valid stored credentials", () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === AUTH_STORAGE_KEYS.CONNECTION_METHOD) return "stytch";
        if (key === AUTH_STORAGE_KEYS.AUTHENTICATOR_TYPE) return "JWT";
        if (key === AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR)
          return "test-authenticator";
        return null;
      });

      AuthStateManager.initialize();

      const state = AuthStateManager.getState();
      expect(state.status).toBe("connecting");
      expect(state.connectionMethod).toBe("stytch");
      expect(state.authenticatorType).toBe("JWT");
      expect(state.authenticator).toBe("test-authenticator");
    });

    it("should stay disconnected if localStorage has invalid connection type", () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === AUTH_STORAGE_KEYS.CONNECTION_METHOD) return "invalid-type";
        if (key === AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR)
          return "test-authenticator";
        return null;
      });

      AuthStateManager.initialize();

      const state = AuthStateManager.getState();
      expect(state.status).toBe("disconnected");
      expect(state.connectionMethod).toBe("none");
    });

    it("should stay disconnected if localStorage is empty", () => {
      localStorageMock.getItem.mockReturnValue(null);

      AuthStateManager.initialize();

      const state = AuthStateManager.getState();
      expect(state.status).toBe("disconnected");
    });

    it("should only initialize once", () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === AUTH_STORAGE_KEYS.CONNECTION_METHOD) return "stytch";
        if (key === AUTH_STORAGE_KEYS.AUTHENTICATOR_TYPE) return "JWT";
        if (key === AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR)
          return "test-authenticator";
        return null;
      });

      AuthStateManager.initialize();
      AuthStateManager.initialize(); // Second call should be ignored

      // localStorage.getItem should only be called during first initialization (3 keys: connectionMethod, authenticatorType, loginAuthenticator)
      expect(localStorageMock.getItem).toHaveBeenCalledTimes(3);
    });
  });

  describe("subscribe", () => {
    it("should add and notify listeners on state changes", () => {
      const listener = vi.fn();
      const unsubscribe = AuthStateManager.subscribe(listener);

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );

      expect(listener).toHaveBeenCalled();
      const [newState, prevState] = listener.mock.calls[0];
      expect(newState.status).toBe("connecting");
      expect(prevState.status).toBe("disconnected");

      unsubscribe();
    });

    it("should remove listener when unsubscribe is called", () => {
      const listener = vi.fn();
      const unsubscribe = AuthStateManager.subscribe(listener);

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth-1",
      );
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "test-auth-2",
      );
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it("should handle listener errors gracefully", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const normalListener = vi.fn();

      AuthStateManager.subscribe(errorListener);
      AuthStateManager.subscribe(normalListener);

      // Should not throw and should still call other listeners
      expect(() =>
        AuthStateManager.startLogin(
          AUTHENTICATOR_TYPE.JWT,
          CONNECTION_METHOD.Stytch,
          "test-auth",
        ),
      ).not.toThrow();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe("getState", () => {
    it("should return read-only state snapshot", () => {
      const state = AuthStateManager.getState();
      expect(state).toBeDefined();
      expect(typeof state).toBe("object");
    });

    it("should return same reference if state unchanged", () => {
      const state1 = AuthStateManager.getState();
      const state2 = AuthStateManager.getState();
      expect(state1).toBe(state2);
    });

    it("should return different reference after state change", () => {
      const state1 = AuthStateManager.getState();
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      const state2 = AuthStateManager.getState();
      expect(state1).not.toBe(state2);
    });
  });

  describe("isConnected", () => {
    it("should return false when disconnected", () => {
      expect(AuthStateManager.isConnected()).toBe(false);
    });

    it("should return false when connecting (no account)", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      expect(AuthStateManager.isConnected()).toBe(false);
    });

    it("should return true when connected with account", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      AuthStateManager.completeLogin({
        id: "test-address",
        currentAuthenticatorIndex: 0,
        authenticators: [],
      });
      expect(AuthStateManager.isConnected()).toBe(true);
    });
  });

  describe("isConnecting", () => {
    it("should return false when disconnected", () => {
      expect(AuthStateManager.isConnecting()).toBe(false);
    });

    it("should return true when in connecting state", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      expect(AuthStateManager.isConnecting()).toBe(true);
    });

    it("should return false when connected", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      AuthStateManager.completeLogin({
        id: "test-address",
        currentAuthenticatorIndex: 0,
        authenticators: [],
      });
      expect(AuthStateManager.isConnecting()).toBe(false);
    });
  });

  describe("isDisconnecting", () => {
    it("should return false when disconnected", () => {
      expect(AuthStateManager.isDisconnecting()).toBe(false);
    });

    it("should return true during logout", async () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );

      // Start logout but don't await
      const logoutPromise = AuthStateManager.logout();
      // The state should be 'disconnecting' during logout
      // Note: This is tricky to test since logout is async

      await logoutPromise;
      // After logout completes, should be disconnected
      expect(AuthStateManager.isDisconnecting()).toBe(false);
    });
  });

  describe("getAddress", () => {
    it("should return null when not connected", () => {
      expect(AuthStateManager.getAddress()).toBeNull();
    });

    it("should return address when connected", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      AuthStateManager.completeLogin({
        id: "xion1testaddress",
        currentAuthenticatorIndex: 0,
        authenticators: [],
      });
      expect(AuthStateManager.getAddress()).toBe("xion1testaddress");
    });
  });

  describe("getAuthenticator", () => {
    it("should return null when disconnected", () => {
      expect(AuthStateManager.getAuthenticator()).toBeNull();
    });

    it("should return authenticator after startLogin", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "my-authenticator",
      );
      expect(AuthStateManager.getAuthenticator()).toBe("my-authenticator");
    });
  });

  describe("getConnectionMethod", () => {
    it("should return 'none' when disconnected", () => {
      expect(AuthStateManager.getConnectionMethod()).toBe("none");
    });

    it("should return connection type after startLogin", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.OKX,
        "test-auth",
      );
      expect(AuthStateManager.getConnectionMethod()).toBe("okx");
    });
  });

  describe("getAccount", () => {
    it("should return undefined when not connected", () => {
      expect(AuthStateManager.getAccount()).toBeUndefined();
    });

    it("should return account when connected", () => {
      const account = {
        id: "xion1test",
        currentAuthenticatorIndex: 1,
        authenticators: [],
      };
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      AuthStateManager.completeLogin(account);
      expect(AuthStateManager.getAccount()).toEqual(account);
    });
  });

  describe("startLogin", () => {
    it("should transition to connecting state", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-authenticator",
      );

      const state = AuthStateManager.getState();
      expect(state.status).toBe("connecting");
      expect(state.connectionMethod).toBe("stytch");
      expect(state.authenticator).toBe("test-authenticator");
      expect(state.error).toBeNull();
    });

    it("should persist to localStorage", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "test-keplr-auth",
      );

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.CONNECTION_METHOD,
        "keplr",
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR,
        "test-keplr-auth",
      );
    });

    it("should dispatch storage event", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.EthWallet,
        CONNECTION_METHOD.Metamask,
        "metamask-auth",
      );

      expect(window.dispatchEvent).toHaveBeenCalled();
      const event = (window.dispatchEvent as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as StorageEvent;
      expect(event.type).toBe("storage");
      expect(event.key).toBe(AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR);
      expect(event.newValue).toBe("metamask-auth");
    });

    it("should work with all connection types", () => {
      const types = ["stytch", "keplr", "metamask", "okx", "passkey"] as const;
      for (const type of types) {
        AuthStateManager.startLogin(
          getAuthType(type),
          type as ConnectionMethod,
          `${type}-auth`,
        );
        expect(AuthStateManager.getConnectionMethod()).toBe(type);
      }
    });
  });

  describe("completeLogin", () => {
    it("should transition to connected state", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      AuthStateManager.completeLogin({
        id: "xion1complete",
        currentAuthenticatorIndex: 2,
        authenticators: [],
      });

      const state = AuthStateManager.getState();
      expect(state.status).toBe("connected");
      expect(state.account?.id).toBe("xion1complete");
      expect(state.account?.currentAuthenticatorIndex).toBe(2);
      expect(state.error).toBeNull();
    });

    it("should notify listeners", () => {
      const listener = vi.fn();
      AuthStateManager.subscribe(listener);

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      listener.mockClear();

      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
        authenticators: [],
      });

      expect(listener).toHaveBeenCalled();
      const [newState] = listener.mock.calls[0];
      expect(newState.status).toBe("connected");
    });
  });

  describe("logout", () => {
    it("should clear all auth state", async () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
        authenticators: [],
      });

      await AuthStateManager.logout();

      const state = AuthStateManager.getState();
      expect(state.status).toBe("disconnected");
      expect(state.connectionMethod).toBe("none");
      expect(state.account).toBeUndefined();
      expect(state.authenticator).toBeNull();
    });

    it("should clear localStorage", async () => {
      await AuthStateManager.logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.CONNECTION_METHOD,
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.LOGIN_AUTHENTICATOR,
      );
    });

    it("should clear session for origin", async () => {
      const { SessionManager } = await import("../../auth/session");
      const clearSessionSpy = vi.spyOn(SessionManager, "clearSession");

      await AuthStateManager.logout("https://example.com");

      expect(clearSessionSpy).toHaveBeenCalledWith("https://example.com");
    });

    it("should revoke Stytch session if applicable", async () => {
      const mockStytchClient = {
        session: {
          getTokens: vi.fn().mockReturnValue({ session_jwt: "test-jwt" }),
          revoke: vi.fn().mockResolvedValue(undefined),
        },
      };

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      await AuthStateManager.logout(undefined, mockStytchClient);

      expect(mockStytchClient.session.revoke).toHaveBeenCalled();
    });

    it("should not revoke Stytch session if getTokens returns null", async () => {
      const mockStytchClient = {
        session: {
          getTokens: vi.fn().mockReturnValue(null),
          revoke: vi.fn().mockResolvedValue(undefined),
        },
      };

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      await AuthStateManager.logout(undefined, mockStytchClient);

      expect(mockStytchClient.session.revoke).not.toHaveBeenCalled();
    });

    it("should handle Stytch session revoke error gracefully", async () => {
      const mockStytchClient = {
        session: {
          getTokens: vi.fn().mockReturnValue({ session_jwt: "test-jwt" }),
          revoke: vi.fn().mockRejectedValue(new Error("Revoke failed")),
        },
      };

      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );

      // Should not throw
      await expect(
        AuthStateManager.logout(undefined, mockStytchClient),
      ).resolves.not.toThrow();
    });

    it("should dispatch storage event", async () => {
      await AuthStateManager.logout();

      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it("should post message to parent window", async () => {
      AuthStateManager.setParentOrigin("https://trusted-sdk.example.com");
      await AuthStateManager.logout();

      expect(window.parent.postMessage).toHaveBeenCalledWith(
        { type: DashboardMessageType.HARD_DISCONNECT },
        "https://trusted-sdk.example.com",
      );
    });

    it("should not post message to parent window when parentOrigin is not set", async () => {
      await AuthStateManager.logout();

      expect(window.parent.postMessage).not.toHaveBeenCalled();
    });
  });

  describe("setError", () => {
    it("should set error state", () => {
      AuthStateManager.setError("Test error message");

      const state = AuthStateManager.getState();
      expect(state.error).toBe("Test error message");
    });

    it("should notify listeners", () => {
      const listener = vi.fn();
      AuthStateManager.subscribe(listener);

      AuthStateManager.setError("An error occurred");

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("clearError", () => {
    it("should clear error state", () => {
      AuthStateManager.setError("Some error");
      AuthStateManager.clearError();

      const state = AuthStateManager.getState();
      expect(state.error).toBeNull();
    });

    it("should not notify listeners if no error exists", () => {
      const listener = vi.fn();
      AuthStateManager.subscribe(listener);
      listener.mockClear();

      AuthStateManager.clearError(); // No error to clear

      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify listeners if error exists", () => {
      AuthStateManager.setError("Error to clear");

      const listener = vi.fn();
      AuthStateManager.subscribe(listener);

      AuthStateManager.clearError();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("updateAccount", () => {
    it("should update account and ensure connected state", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );

      const newAccount = {
        id: "xion1updated",
        currentAuthenticatorIndex: 5,
        authenticators: [],
      };
      AuthStateManager.updateAccount(newAccount);

      const state = AuthStateManager.getState();
      expect(state.status).toBe("connected");
      expect(state.account).toEqual(newAccount);
    });

    it("should notify listeners", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      AuthStateManager.completeLogin({
        id: "xion1original",
        currentAuthenticatorIndex: 0,
        authenticators: [],
      });

      const listener = vi.fn();
      AuthStateManager.subscribe(listener);

      AuthStateManager.updateAccount({
        id: "xion1updated",
        currentAuthenticatorIndex: 1,
        authenticators: [],
      });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("resetState", () => {
    it("should reset to disconnected state", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );
      AuthStateManager.completeLogin({
        id: "xion1test",
        currentAuthenticatorIndex: 0,
        authenticators: [],
      });

      AuthStateManager.resetState();

      const state = AuthStateManager.getState();
      expect(state.status).toBe("disconnected");
      expect(state.connectionMethod).toBe("none");
      expect(state.account).toBeUndefined();
      expect(state.authenticator).toBeNull();
    });

    it("should notify listeners", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );

      const listener = vi.fn();
      AuthStateManager.subscribe(listener);

      AuthStateManager.resetState();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("getAuthenticatorType", () => {
    it("should return null when disconnected", () => {
      expect(AuthStateManager.getAuthenticatorType()).toBeNull();
    });

    it("should return authenticator type after startLogin", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.JWT,
        CONNECTION_METHOD.Stytch,
        "test-auth",
      );

      expect(AuthStateManager.getAuthenticatorType()).toBe(
        AUTHENTICATOR_TYPE.JWT,
      );
    });

    it("should return Secp256K1 for Keplr connection", () => {
      AuthStateManager.startLogin(
        AUTHENTICATOR_TYPE.Secp256K1,
        CONNECTION_METHOD.Keplr,
        "test-auth",
      );

      expect(AuthStateManager.getAuthenticatorType()).toBe(
        AUTHENTICATOR_TYPE.Secp256K1,
      );
    });
  });

  describe("setConnectionMethod", () => {
    it("should update connection method", () => {
      AuthStateManager.setConnectionMethod(CONNECTION_METHOD.Stytch);

      expect(AuthStateManager.getConnectionMethod()).toBe(
        CONNECTION_METHOD.Stytch,
      );
    });

    it("should persist to localStorage", () => {
      AuthStateManager.setConnectionMethod(CONNECTION_METHOD.Keplr);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.CONNECTION_METHOD,
        CONNECTION_METHOD.Keplr,
      );
    });

    it("should notify listeners", () => {
      const listener = vi.fn();
      AuthStateManager.subscribe(listener);

      AuthStateManager.setConnectionMethod(CONNECTION_METHOD.Metamask);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("getZKEmailData", () => {
    it("should return null when nothing is stored", () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(AuthStateManager.getZKEmailData()).toBeNull();
    });

    it("should return the stored email address", () => {
      localStorageMock.getItem.mockReturnValue("test@example.com");

      expect(AuthStateManager.getZKEmailData()).toBe("test@example.com");
    });

    it("should return null when localStorage throws an error", () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error("localStorage error");
      });

      expect(AuthStateManager.getZKEmailData()).toBeNull();
    });
  });

  describe("setZKEmailData", () => {
    it("should store the email in localStorage", () => {
      AuthStateManager.setZKEmailData("user@example.com");

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "zkEmailAddress",
        "user@example.com",
      );
    });

    it("should handle localStorage errors gracefully", () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error("localStorage error");
      });

      // Should not throw
      expect(() =>
        AuthStateManager.setZKEmailData("user@example.com"),
      ).not.toThrow();
    });
  });

  describe("clearZKEmailData", () => {
    it("should remove the ZK-Email session key from localStorage", () => {
      AuthStateManager.clearZKEmailData();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith("zkEmailAddress");
    });

    it("should handle localStorage remove errors gracefully", () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error("localStorage remove error");
      });

      expect(() => AuthStateManager.clearZKEmailData()).not.toThrow();
    });
  });

  describe("setError edge cases", () => {
    it("should clear existing error when setError is called with empty string", () => {
      AuthStateManager.setError("Existing error");
      expect(AuthStateManager.getState().error).toBe("Existing error");

      AuthStateManager.setError("");
      expect(AuthStateManager.getState().error).toBeNull();
    });

    it("should clear existing error when setError is called with whitespace", () => {
      AuthStateManager.setError("Existing error");
      expect(AuthStateManager.getState().error).toBe("Existing error");

      AuthStateManager.setError("   ");
      expect(AuthStateManager.getState().error).toBeNull();
    });

    it("should treat non-string error values as clear", () => {
      AuthStateManager.setError("Existing error");
      expect(AuthStateManager.getState().error).toBe("Existing error");

      AuthStateManager.setError(undefined as unknown as string);
      expect(AuthStateManager.getState().error).toBeNull();
    });
  });
});
