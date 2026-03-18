import { useMemo } from "react";
import { useSmartAccount, useSigningClient } from ".";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { useBalances } from "./useBalances";
import { useAssetList } from "./useAssetList";
import { assertIsDeliverTxSuccess } from "@cosmjs/stargate/build/stargateclient";

export function useAccountBalance() {
  const { data: account } = useSmartAccount();
  const { client, getGasCalculation } = useSigningClient();
  const { data: balances, refetch: refetchBalances } = useBalances(
    account?.id || "",
  );
  const { data: assetList } = useAssetList();

  const { processedBalances, totalDollarValue } = useMemo(() => {
    if (!assetList || !balances)
      return { processedBalances: [], totalDollarValue: 0 };

    const processed = assetList.processBalances(balances);
    const total = processed.reduce(
      (sum, balance) => sum + (balance.dollarValue || 0),
      0,
    );
    return { processedBalances: processed, totalDollarValue: total };
  }, [assetList, balances]);

  async function getEstimatedSendFee(
    recipientAddress: string,
    sendAmount: string | number,
    denom: string,
  ) {
    if (!client || !account || !assetList) {
      return null;
    }

    const convertedSendAmount = assetList.convertToBaseAmount(
      sendAmount.toString(),
      denom,
    );

    const msg = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: MsgSend.fromPartial({
        fromAddress: account.id,
        toAddress: recipientAddress,
        amount: [{ denom, amount: convertedSendAmount }],
      }),
    };

    const simmedGas = await client.simulate(account.id, [msg], `xion-send`);

    const fee = getGasCalculation(simmedGas);
    return { fee, msg };
  }

  async function sendTokens(
    recipientAddress: string,
    sendAmount: number,
    denom: string,
    memo: string,
  ) {
    try {
      if (!account) {
        throw new Error("No account");
      }

      if (!client) {
        throw new Error("No signing client");
      }

      if (!assetList) {
        throw new Error("Asset list not available");
      }

      const asset = assetList.getAssetByDenom(denom);
      if (!asset) {
        throw new Error(`Asset not found for denom: ${denom}`);
      }

      const result = await getEstimatedSendFee(
        recipientAddress,
        sendAmount,
        denom,
      );

      if (!result || !result.fee) {
        throw new Error("Failed to estimate fee");
      }

      const { fee, msg } = result;

      const res = await client.signAndBroadcast(account.id, [msg], fee, memo);
      assertIsDeliverTxSuccess(res);

      refetchBalances();
      return res;
    } catch (error) {
      console.error("Error sending tokens", error);
      throw error;
    }
  }

  const getBalanceByDenom = (denom: string) => {
    return processedBalances.find((balance) => balance.asset.base === denom);
  };

  return {
    balances: processedBalances,
    totalDollarValue,
    sendTokens,
    assetList,
    refetchBalances,
    getBalanceByDenom,
    getEstimatedSendFee,
  };
}
