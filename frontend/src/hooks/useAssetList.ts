import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import type {
  AssetList,
  FormattedAssetAmount,
  Asset,
  PriceData,
} from "../types/assets";
import {
  COINGECKO_API_URL,
  getAssetEndpoint,
  networkConfig,
} from "../config";

/**
 * Fetches the asset list from the chain registry
 * @returns The asset list and query info
 */
export const fetchAssetList = async (): Promise<AssetList> => {
  const response = await axios.get(getAssetEndpoint());
  if (response.status !== 200) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.data;
};

/**
 * Hook to fetch the asset list from the chain registry
 * @returns The asset list and query info
 */
export const useAssetListQuery = () => {
  return useQuery({
    queryKey: ["assetList", networkConfig.chainId],
    queryFn: () => fetchAssetList(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * Fetches price data for assets
 * @param assets - Array of assets to fetch prices for
 * @returns Object with asset base denoms as keys and PriceData as values
 */
export const fetchPrices = async (
  assets: Asset[],
): Promise<Record<string, PriceData>> => {
  const coingeckoIds = assets
    .filter((asset) => asset.coingecko_id)
    .map((asset) => asset.coingecko_id)
    .join(",");

  // mock data for now, assuming that we may eventually use coingecko ids
  if (!coingeckoIds) {
    return {
      "ibc/F082B65C88E4B6D5EF1DB243CDA1D331D002759E938A0F5CD3FFDC5D53B3E349": {
        price: 1,
        last_updated: new Date().toISOString(),
        source: "placeholder",
      },
      uxion: {
        price: 50,
        last_updated: new Date().toISOString(),
        source: "placeholder",
      },
    };
  }

  try {
    const response = await axios.get(
      `${COINGECKO_API_URL}?ids=${coingeckoIds}&vs_currencies=usd`,
    );

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = response.data;
    const prices: Record<string, PriceData> = {};

    assets.forEach((asset) => {
      if (asset.coingecko_id && data[asset.coingecko_id]) {
        prices[asset.base] = {
          price: data[asset.coingecko_id].usd,
          last_updated: new Date().toISOString(),
          source: "coingecko",
        };
      }
    });

    return prices;
  } catch (error) {
    console.error("Error fetching prices:", error);
    throw error;
  }
};

/**
 * Hook to fetch and cache price data for assets
 * @param assets - Array of assets to fetch prices for
 * @returns Object with asset base denoms as keys and PriceData as values, along with query info
 */
export const usePrices = (assets: Asset[]) => {
  return useQuery({
    queryKey: ["prices", assets.map((a) => a.coingecko_id).filter(Boolean)],
    queryFn: () => fetchPrices(assets),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};

/**
 * Hook to fetch and format the asset list
 * @returns The asset list and helper functions to work with the assets
 */

export const useAssetList = () => {
  const { data: assetList, ...queryInfo } = useAssetListQuery();
  const { data: priceData } = usePrices(assetList?.assets ?? []);

  const assets = useMemo(() => {
    if (!assetList || !assetList.assets) return null;

    // helper to find matching denom including IBC handling
    const getAssetByDenom = (denom: string): Asset | undefined => {
      return assetList.assets.find((asset) => {
        // check base denom
        if (asset.base === denom) return true;

        // check denom units and aliases
        if (
          asset.denom_units.some(
            (unit) =>
              unit.denom === denom || (unit.aliases || []).includes(denom),
          )
        )
          return true;

        // check IBC trace if present
        if (
          asset.traces?.some((trace) => {
            if (trace.type === "ibc") {
              return trace.chain.path === denom;
            }
            return false;
          })
        )
          return true;

        return false;
      });
    };

    const getAssetBySymbol = (symbol: string): Asset | undefined =>
      assetList.assets.find((asset) => asset.symbol === symbol);

    const getExponent = (asset: Asset, targetDenom?: string): number => {
      if (targetDenom) {
        const denomUnit = asset.denom_units.find(
          (unit) => unit.denom === targetDenom,
        );
        if (denomUnit) return denomUnit.exponent;
      }

      const displayUnit = asset.denom_units.find(
        (unit) => unit.denom === asset.display,
      );
      return displayUnit?.exponent || 6;
    };

    const formatAsset = (
      amount: string | number,
      denom: string,
      options?: {
        includeSymbol?: boolean;
        decimals?: number;
        displayDenom?: string;
        includeDollarValue?: boolean;
      },
    ): FormattedAssetAmount | null => {
      const asset = getAssetByDenom(denom);

      if (!asset) return null;

      const exponent = getExponent(asset, options?.displayDenom);
      const value = Number(amount) / Math.pow(10, exponent);
      const displayAmount = value.toFixed(options?.decimals ?? exponent);

      const price = priceData?.[asset.base]?.price ?? 0;
      const dollarValue = value * price;

      return {
        value,
        display: options?.includeSymbol
          ? `${displayAmount} ${asset.symbol}`
          : displayAmount,
        symbol: asset.symbol,
        baseAmount: amount.toString(),
        displayAmount,
        asset,
        decimals: exponent,
        dollarValue: options?.includeDollarValue ? dollarValue : undefined,
        price,
        imageUrl: getAssetImageUrl(asset) || "",
      };
    };

    const convertToBaseAmount = (
      amount: string | number,
      denom: string,
      fromDenom?: string,
    ): string => {
      const asset = getAssetByDenom(denom);
      if (!asset) return amount.toString();

      const exponent = getExponent(asset, fromDenom);
      return (Number(amount) * Math.pow(10, exponent)).toString();
    };

    const processBalances = (balances: Coin[]): FormattedAssetAmount[] => {
      return balances
        .map((balance) => {
          const formatted = formatAsset(balance.amount, balance.denom, {
            includeSymbol: true,
            includeDollarValue: true,
          });
          return formatted;
        })
        .filter((balance): balance is FormattedAssetAmount => balance !== null);
    };

    const getAssetImageUrl = (asset: Asset): string | undefined => {
      // Prefer SVG over PNG
      return (
        asset.logo_URIs?.svg ||
        asset.logo_URIs?.png ||
        asset.images?.[0]?.svg ||
        asset.images?.[0]?.png
      );
    };

    return {
      assets: assetList.assets,
      getAssetByDenom,
      getAssetBySymbol,
      formatAsset,
      convertToBaseAmount,
      processBalances,
      getAssetImageUrl,
      chainName: assetList.chain_name,
      priceData,
    };
  }, [assetList, priceData]);

  return {
    ...queryInfo,
    data: assets,
  };
};
