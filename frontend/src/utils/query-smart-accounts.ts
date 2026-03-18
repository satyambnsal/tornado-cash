/**
 * Smart account discovery utilities using xion.js
 *
 * Similar to query-treasury-contract.ts, this provides a simple interface
 * to query smart accounts using xion.js composite strategy
 */

import { createCompositeAccountStrategy } from "@burnt-labs/account-management";
import { NUMIA_URL, NUMIA_TOKEN, ABSTRAXION_API_URL } from "../config";

// Re-export types for convenience
export type { SmartAccountWithCodeId } from "@burnt-labs/account-management";

// Create composite strategy once at module level (singleton pattern)
// Uses xion.js implementation with Numia → AAApi → Empty fallback chain
const accountStrategy = createCompositeAccountStrategy({
  // Primary: Numia indexer (fast, comprehensive)
  indexer: {
    type: "numia" as const,
    url: NUMIA_URL,
    authToken: NUMIA_TOKEN,
  },
  // Fallback 1: AA-API (canonical source of truth)
  // Uses ABSTRAXION_API_URL which reads from VITE_ABSTRAXION_API_URL env var
  aaApi: {
    baseURL: ABSTRAXION_API_URL,
    version: "v1",
  },
  // Fallback 2: Empty (returns [] for new account creation)
  // Automatically included by createCompositeAccountStrategy
});

/**
 * Export the account strategy for direct use in hooks
 */
export { accountStrategy };
