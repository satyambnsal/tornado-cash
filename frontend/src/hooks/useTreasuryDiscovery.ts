/**
 * Treasury discovery hook using React Query
 * Wraps queryTreasuryContract utility for consistent pattern with useAccountDiscovery
 */

import { useQuery } from "@tanstack/react-query";
import {
  queryTreasuryContract,
  type TreasuryApiResponse,
} from "../utils/query-treasury-contract";

export const useTreasuryDiscovery = (treasuryAddress?: string) => {
  return useQuery<TreasuryApiResponse>({
    queryKey: ["treasury", treasuryAddress],
    queryFn: async () => {
      if (!treasuryAddress) {
        throw new Error("Missing required parameters for treasury query");
      }
      return await queryTreasuryContract(treasuryAddress);
    },
    enabled: Boolean(treasuryAddress),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Treasury data doesn't change frequently, cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
};
