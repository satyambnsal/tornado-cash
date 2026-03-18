import {
  type GrantConfigByTypeUrl,
  type PermissionDescription,
  type TreasuryConfig,
  type TreasuryStrategy,
} from "@burnt-labs/account-management";
import { TREASURY_API_URL } from "../config";

export interface TreasuryApiResponse {
  permissionDescriptions: PermissionDescription[];
  grantConfigs: GrantConfigByTypeUrl[];
  params: {
    redirect_url: string;
    icon_url: string;
    metadata: string;
  };
}

/**
 * Creates a TreasuryStrategy from pre-fetched API data.
 * Used to pass already-fetched grantConfigs to generateTreasuryGrants()
 * without making additional RPC or indexer calls.
 */
export function createApiTreasuryStrategy(
  data: TreasuryApiResponse,
): TreasuryStrategy {
  return {
    async fetchTreasuryConfig(): Promise<TreasuryConfig> {
      return {
        grantConfigs: data.grantConfigs,
        params: data.params,
      };
    },
  };
}

/**
 * Queries the treasury worker API to get treasury permissions, parameters,
 * and raw grant configurations.
 *
 * @param contractAddress - The address for the deployed treasury contract instance
 * @returns The permission descriptions, treasury parameters, and raw grant configs
 */
export const queryTreasuryContract = async (
  contractAddress?: string,
): Promise<TreasuryApiResponse> => {
  if (!contractAddress) {
    throw new Error("Missing contract address");
  }

  const response = await fetch(
    `${TREASURY_API_URL}/treasury/${contractAddress}`,
  );

  if (!response.ok) {
    throw new Error(
      `Treasury query failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};
