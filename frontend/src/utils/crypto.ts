/**
 * Cryptographic utilities for Tornado Cash
 * Includes random generation and address conversion for zero-knowledge circuits
 */

/**
 * Generate a cryptographically secure random field element for BN254 curve
 * Used for generating nullifier and secret values
 * @returns BigInt with 248 bits of randomness (31 bytes)
 */
export function generateRandomFieldElement(): bigint {
  // Generate 31 bytes of randomness (248 bits) to fit in BN254 scalar field
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);

  // Convert bytes to BigInt
  return BigInt('0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(''));
}

/**
 * Convert a blockchain address to BigInt for use in zero-knowledge circuits
 * Must match the contract's address_to_uint256 function
 *
 * @param address - Address in hex (0x...) or bech32 format (xion...)
 * @returns Promise<string> - Address as BigInt string representation
 */
export async function addressToBigInt(address: string): Promise<string> {
  if (address.startsWith('0x')) {
    // Hex address - decode it directly
    const hex = address.slice(2);
    const padded = hex.padStart(64, '0'); // Pad to 64 hex chars (32 bytes)
    return BigInt('0x' + padded).toString();
  } else {
    // Bech32 address - hash it with SHA256
    // Note: In browser, we'll use SubtleCrypto API instead of Node's crypto
    return addressToBigIntBech32(address);
  }
}

/**
 * Convert bech32 address to BigInt using SHA256 hash
 * @param address - Bech32 address (e.g., xion1...)
 * @returns Promise<string> - Address as BigInt string
 */
async function addressToBigIntBech32(address: string): Promise<string> {
  // Convert address string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(address);

  // Hash with SHA256 using SubtleCrypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Take first 30 bytes (60 hex chars) to fit in BN254 field
  // Pad with 2 zero bytes at start
  const hex = Array.from(hashArray.slice(0, 30))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return BigInt('0x' + '0000' + hex).toString();
}

/**
 * Synchronous version of addressToBigInt for hex addresses
 * For bech32 addresses, throws an error - use addressToBigInt instead
 *
 * @param address - Address (should be hex format for sync operation)
 * @returns Address as BigInt string
 */
export function addressToBigIntSync(address: string): string {
  if (address.startsWith('0x')) {
    const hex = address.slice(2);
    const padded = hex.padStart(64, '0');
    return BigInt('0x' + padded).toString();
  } else {
    throw new Error('Bech32 address conversion requires async operation. Use addressToBigInt instead.');
  }
}

/**
 * Convert BigInt to Uint256 string format for contract
 * @param value - BigInt value
 * @returns String representation of the BigInt
 */
export function toUint256String(value: bigint): string {
  return value.toString();
}

/**
 * Validate that a string represents a valid BigInt
 * @param value - String to validate
 * @returns True if valid BigInt string
 */
export function isValidBigIntString(value: string): boolean {
  try {
    BigInt(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate random deposit credentials (nullifier and secret)
 * @returns Object with nullifier and secret as BigInt
 */
export function generateDepositCredentials(): {
  nullifier: bigint;
  secret: bigint;
} {
  return {
    nullifier: generateRandomFieldElement(),
    secret: generateRandomFieldElement(),
  };
}
