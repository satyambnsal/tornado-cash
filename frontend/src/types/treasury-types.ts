// Re-export treasury types from xion.js for consistency
// xion.js defines these types to match the contract specification
export type {
  TreasuryParams,
  GrantConfigByTypeUrl,
  PermissionDescription,
  Any,
} from "@burnt-labs/account-management";

// Dashboard-specific types (not in xion.js)
import type { MsgGrant } from "cosmjs-types/cosmos/authz/v1beta1/tx";

export type GrantConfigTypeUrlsResponse = string[];

export interface FormattedDescriptions {
  parsedDescription: string;
  dappDescription: string;
}

export interface GeneratedAuthzGrantMessage {
  typeUrl: string;
  value: MsgGrant;
}

// Helper type for parsed metadata (dashboard-specific usage)
export interface TreasuryParamsMetadata extends Record<string, unknown> {
  is_oauth2_app?: boolean;
}

// Helper function to parse metadata JSON string to object
// Use this if you need to work with metadata as an object in the UI
export function parseTreasuryMetadata(
  metadataJsonString: string,
): TreasuryParamsMetadata {
  try {
    if (metadataJsonString) {
      return JSON.parse(metadataJsonString) as TreasuryParamsMetadata;
    }
  } catch (error) {
    console.warn("Failed to parse treasury metadata:", error);
  }
  return {};
}
