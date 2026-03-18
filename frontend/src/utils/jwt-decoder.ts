/**
 * Utility functions for decoding JWT tokens and extracting custom claims
 */

/**
 * Decodes a JWT without verifying the signature
 * @param jwt - The JWT string to decode
 * @returns The decoded payload or null if invalid
 */
export function decodeJwt(jwt: string): Record<string, unknown> | null {
  try {
    // JWT structure: header.payload.signature
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      console.error("Invalid JWT format");
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];

    // Add padding if necessary
    const paddedPayload = payload + "=".repeat((4 - (payload.length % 4)) % 4);

    // Decode base64url
    const decoded = atob(paddedPayload.replace(/-/g, "+").replace(/_/g, "/"));

    return JSON.parse(decoded);
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
}

/**
 * Extracts abstract account information from JWT custom claims
 * @param jwt - The JWT string containing custom claims
 * @returns Object with abstract account address and transaction hash, or null
 */
export function extractAbstractAccountFromJwt(jwt: string): {
  address: string | null;
  txHash: string | null;
} | null {
  const payload = decodeJwt(jwt);

  if (!payload) {
    return null;
  }

  return {
    address: (payload.abstract_account_address as string) || null,
    txHash: (payload.abstract_account_transaction_hash as string) || null,
  };
}

/**
 * Extracts all custom claims from a JWT
 * @param jwt - The JWT string
 * @returns Object containing all custom claims
 */
export function extractCustomClaims(jwt: string): Record<string, unknown> {
  const payload = decodeJwt(jwt);

  if (!payload) {
    return {};
  }

  // Standard JWT claims to exclude
  const standardClaims = [
    "iss",
    "sub",
    "aud",
    "exp",
    "nbf",
    "iat",
    "jti",
    // Stytch-specific standard claims
    "session_id",
    "user_id",
    "email",
    "phone_number",
    "name",
  ];

  // Filter out standard claims to get only custom ones
  const customClaims: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!standardClaims.includes(key)) {
      customClaims[key] = value;
    }
  }

  return customClaims;
}
