import { useQuery } from "@tanstack/react-query";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import axios from "axios";
import { getRestApiUrl, REST_ENDPOINTS, USDC_DENOM } from "../config";
import { useContext } from "react";
import { AuthContext } from "../components/AuthContext";

const fetchBalances = async (
  address: string,
  chainInfo: { rest: string } | null,
): Promise<Coin[]> => {
  if (!chainInfo) {
    return [
      { amount: "0", denom: "uxion" },
      { amount: "0", denom: USDC_DENOM },
    ];
  }

  try {
    const response = await axios.get(
      `${getRestApiUrl(chainInfo)}${REST_ENDPOINTS.balances}/${address}`,
    );
    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const balances = response.data.balances;

    // inject xion and usdc if not present
    if (!balances.some((balance: Coin) => balance.denom === "uxion")) {
      balances.push({ amount: "0", denom: "uxion" });
    }

    if (!balances.some((balance: Coin) => balance.denom === USDC_DENOM)) {
      balances.push({
        amount: "0",
        denom: USDC_DENOM,
      });
    }

    return balances;
  } catch (error) {
    console.error("Error fetching asset list:", error);
    throw error;
  }
};

/**
 * Hook to fetch and cache balance data for an address
 * @param address - The address to fetch balances for
 * @returns The balances and query info
 */
export const useBalances = (address: string) => {
  const { chainInfo, isChainInfoLoading } = useContext(AuthContext);

  return useQuery({
    queryKey: ["balances", address, chainInfo?.chainId],
    queryFn: () => fetchBalances(address, chainInfo),
    enabled: !isChainInfoLoading && !!address,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};
