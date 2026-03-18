/**
 * Session Management & JWT Utilities
 *
 * This module handles:
 * 1. JWT decoding and claim extraction (supporting legacy formats)
 * 2. Session storage management (per-origin, with timeouts)
 *
 * Sessions are stored in iframe's sessionStorage for security isolation.
 * sessionStorage is automatically cleared when the tab/window closes
 * and is isolated per browsing context.
 *
 * Sessions are keyed by origin to prevent cross-origin session sharing.
 */

import type { StytchLikeClient } from "./AuthStateManager";

// ============================================================================
// JWT Types and Utilities
// ============================================================================

/**
 * XION-specific claims extracted from JWT or session
 */
export interface XionClaims {
  address: string | null;
  authenticatorIndex: number;
}

/**
 * Decoded JWT payload structure
 */
export interface DecodedJWT {
  exp: number;
  iat: number;
  aud?: string | string[];
  sub?: string;
  [key: string]: unknown;
}

/**
 * Decode a JWT without verification (for reading claims only)
 * Note: This is for reading claims, not for security validation
 *
 * @param jwt - The JWT string to decode
 * @returns Decoded payload object
 * @throws Error if JWT format is invalid
 */
export function decodeJWT(jwt: string): DecodedJWT {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format: expected 3 parts");
    }

    // Decode the payload (middle part)
    const payload = parts[1];
    // Handle URL-safe base64
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error(
      "Failed to decode JWT: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
  }
}

/**
 * Recursive record type for claim extraction from JWT payloads and session objects.
 * Allows deep optional chaining without unsafe `any`.
 */
interface ClaimSource {
  [key: string]: ClaimSource | undefined;
}

/**
 * Claim extraction paths in priority order
 * Each path is a function that attempts to extract claims from a source
 *
 * Handles all legacy JWT formats:
 * 1. Modern: https://xion.burnt.com/claims
 * 2. Legacy Stytch: https://stytch.com/session.custom_claims.https://xion.burnt.com/claims
 * 3. Old Stytch: https://stytch.com/session.custom_claims
 * 4. Session object: custom_claims.https://xion.burnt.com/claims
 * 5. Nested session: stytch_session.session.custom_claims
 * 6. Direct claims: abstract_account_address at root
 */
const CLAIM_PATHS: Array<(source: ClaimSource) => ClaimSource | undefined> = [
  // 1. Modern: direct xion claims at root
  (source) => source["https://xion.burnt.com/claims"],

  // 2. Legacy: Stytch session wrapper with xion claims
  (source) =>
    source["https://stytch.com/session"]?.custom_claims?.[
      "https://xion.burnt.com/claims"
    ],

  // 3. Old: Stytch session wrapper with direct claims
  (source) => source["https://stytch.com/session"]?.custom_claims,

  // 4. Session object: custom_claims with xion namespace
  (source) => source?.custom_claims?.["https://xion.burnt.com/claims"],

  // 5. Nested session: stytch_session wrapper
  (source) =>
    source?.stytch_session?.session?.custom_claims?.[
      "https://xion.burnt.com/claims"
    ],

  // 6. Fallback: direct properties at root level
  (source) => source,
];

/**
 * Extract XION claims from any source (JWT decoded payload or session object)
 * Tries all known claim locations in priority order
 *
 * @param source - Decoded JWT payload or session object
 * @returns XionClaims with address and authenticatorIndex
 */
export function extractXionClaims(source: unknown): XionClaims {
  if (!source || typeof source !== "object") {
    return { address: null, authenticatorIndex: 0 };
  }

  const claimSource = source as ClaimSource;

  for (const getClaims of CLAIM_PATHS) {
    try {
      const claims = getClaims(claimSource);
      if (
        claims &&
        typeof claims === "object" &&
        "abstract_account_address" in claims
      ) {
        return {
          address: String(claims.abstract_account_address),
          authenticatorIndex: Number(claims.current_authenticator_index ?? 0),
        };
      }
    } catch {
      // Continue to next path if this one fails
    }
  }

  return { address: null, authenticatorIndex: 0 };
}

/**
 * Extract abstract account address from JWT string
 *
 * @param jwt - JWT string
 * @returns Address or null if not found
 */
export function getAddressFromJWT(jwt: string): string | null {
  try {
    const decoded = decodeJWT(jwt);
    return extractXionClaims(decoded).address;
  } catch (error) {
    console.warn("[session] Failed to extract address from JWT:", error);
    return null;
  }
}

/**
 * Extract authenticator index from JWT string
 *
 * @param jwt - JWT string
 * @returns Authenticator index (defaults to 0 if not found)
 */
export function getAuthenticatorIndexFromJWT(jwt: string): number {
  try {
    const decoded = decodeJWT(jwt);
    return extractXionClaims(decoded).authenticatorIndex;
  } catch (error) {
    console.warn(
      "[session] Failed to extract authenticator index from JWT:",
      error,
    );
    return 0;
  }
}

/**
 * Extract address from session object (OAuth response)
 *
 * @param session - Stytch session object
 * @returns Address or null if not found
 */
export function getAddressFromSession(session: unknown): string | null {
  if (!session) return null;
  return extractXionClaims(session).address;
}

/**
 * Extract authenticator index from session object (OAuth response)
 *
 * @param session - Stytch session object
 * @returns Authenticator index (defaults to 0 if not found)
 */
export function getAuthenticatorIndexFromSession(session: unknown): number {
  if (!session) return 0;
  return extractXionClaims(session).authenticatorIndex;
}

/**
 * Extract login authenticator identifier from JWT (aud.sub format)
 * This is used as the unique identifier for the authenticator
 *
 * @param jwt - JWT string
 * @returns Authenticator identifier in "aud.sub" format, or null if not found
 */
export function getLoginAuthenticatorFromJWT(jwt: string): string | null {
  try {
    const decoded = decodeJWT(jwt);
    const { aud, sub } = decoded;

    if (aud && sub) {
      const audience = Array.isArray(aud) ? aud[0] : aud;
      return `${audience}.${sub}`;
    }

    return null;
  } catch (error) {
    console.warn(
      "[session] Failed to extract login authenticator from JWT:",
      error,
    );
    return null;
  }
}

/**
 * Check if JWT is expired
 *
 * @param jwt - JWT string
 * @param bufferMs - Buffer time in milliseconds (default 60 seconds)
 * @returns true if expired (or will expire within buffer time)
 */
export function isJWTExpired(jwt: string, bufferMs: number = 60000): boolean {
  try {
    const decoded = decodeJWT(jwt);
    if (!decoded.exp) {
      // No expiration claim - treat as expired for safety
      return true;
    }
    // exp is in seconds, Date.now() is in milliseconds
    return decoded.exp * 1000 < Date.now() + bufferMs;
  } catch {
    // If we can't decode, treat as expired
    return true;
  }
}

/**
 * Get JWT expiration timestamp
 *
 * @param jwt - JWT string
 * @returns Expiration timestamp in milliseconds, or null if not found
 */
export function getJWTExpiration(jwt: string): number | null {
  try {
    const decoded = decodeJWT(jwt);
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Session Storage Management
// ============================================================================

const STORAGE_KEY_PREFIX = "xion_session";

/**
 * Per-origin session data
 */
interface OriginSessionData {
  jwt: string;
  token?: string;
  address?: string;
  authenticatorIndex?: number;
  lastActivity: number;
  createdAt: number;
}

/**
 * Session manager for handling JWT storage and validation
 * All data is scoped per-origin for security isolation
 */
export class SessionManager {
  // Session timeout: 30 minutes of inactivity
  private static readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  // Maximum session lifetime: 24 hours
  private static readonly MAX_SESSION_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get storage key for a specific origin
   */
  private static getStorageKey(origin: string): string {
    return `${STORAGE_KEY_PREFIX}_${origin}`;
  }

  /**
   * Get session data for a specific origin
   */
  static getSessionData(
    origin: string,
  ): { address: string; authenticatorIndex: number } | null {
    try {
      const data = sessionStorage.getItem(this.getStorageKey(origin));
      if (!data) return null;

      const parsed: OriginSessionData = JSON.parse(data);
      const now = Date.now();

      // Check inactivity timeout
      if (now - parsed.lastActivity > this.INACTIVITY_TIMEOUT) {
        console.warn("[SessionManager] Session expired due to inactivity");
        this.clearSession(origin);
        return null;
      }

      // Check maximum session lifetime
      if (now - parsed.createdAt > this.MAX_SESSION_LIFETIME) {
        console.warn(
          "[SessionManager] Session expired due to maximum lifetime",
        );
        this.clearSession(origin);
        return null;
      }

      if (!parsed.address) {
        return null;
      }

      return {
        address: parsed.address,
        authenticatorIndex: parsed.authenticatorIndex || 0,
      };
    } catch (error) {
      console.error("Error reading session data from sessionStorage:", error);
      return null;
    }
  }

  /**
   * Get the stored session JWT for a specific origin
   * Validates session timeout and updates last activity
   */
  static getSession(origin: string): string | null {
    try {
      const data = sessionStorage.getItem(this.getStorageKey(origin));
      if (!data) return null;

      const parsed: OriginSessionData = JSON.parse(data);
      const now = Date.now();

      // Check inactivity timeout
      if (now - parsed.lastActivity > this.INACTIVITY_TIMEOUT) {
        console.warn("[SessionManager] Session expired due to inactivity");
        this.clearSession(origin);
        return null;
      }

      // Check maximum session lifetime
      if (now - parsed.createdAt > this.MAX_SESSION_LIFETIME) {
        console.warn(
          "[SessionManager] Session expired due to maximum lifetime",
        );
        this.clearSession(origin);
        return null;
      }

      // Update last activity timestamp
      parsed.lastActivity = now;
      sessionStorage.setItem(
        this.getStorageKey(origin),
        JSON.stringify(parsed),
      );

      return parsed.jwt;
    } catch (error) {
      console.error("Error reading session from sessionStorage:", error);
      return null;
    }
  }

  /**
   * Get the stored session token for a specific origin
   */
  static getSessionToken(origin: string): string | null {
    try {
      const data = sessionStorage.getItem(this.getStorageKey(origin));
      if (!data) return null;

      const parsed: OriginSessionData = JSON.parse(data);
      return parsed.token || null;
    } catch (error) {
      console.error("Error reading session token from sessionStorage:", error);
      return null;
    }
  }

  /**
   * Store session JWT and token for a specific origin
   */
  static setSession(
    origin: string,
    jwt: string,
    sessionToken?: string,
    address?: string,
    authenticatorIndex?: number,
  ): void {
    try {
      const now = Date.now();
      const data: OriginSessionData = {
        jwt,
        token: sessionToken,
        address,
        authenticatorIndex,
        lastActivity: now,
        createdAt: now,
      };
      sessionStorage.setItem(this.getStorageKey(origin), JSON.stringify(data));
    } catch (error) {
      console.error("Error storing session in sessionStorage:", error);
    }
  }

  /**
   * Clear stored session for a specific origin
   */
  static clearSession(origin: string): void {
    try {
      sessionStorage.removeItem(this.getStorageKey(origin));
    } catch (error) {
      console.error("Error clearing session from sessionStorage:", error);
    }
  }

  /**
   * Clear all sessions (for all origins)
   */
  static clearAllSessions(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    } catch (error) {
      console.error("Error clearing all sessions from sessionStorage:", error);
    }
  }

  /**
   * Check if we have a valid (non-expired) session for a specific origin
   */
  static hasValidSession(origin: string): boolean {
    const jwt = this.getSession(origin);
    if (!jwt) {
      return false;
    }

    // Use centralized JWT expiry check
    return !isJWTExpired(jwt);
  }

  /**
   * Validate session with Stytch
   * Returns true if session is valid, false otherwise
   */
  static async validateSessionWithStytch(stytchClient: StytchLikeClient | null | undefined): Promise<boolean> {
    if (!stytchClient) {
      return false;
    }

    try {
      const result = await stytchClient.session?.authenticate?.();
      return !!result && result.status_code === 200;
    } catch (error) {
      console.error("Error validating session with Stytch:", error);
      return false;
    }
  }
}
