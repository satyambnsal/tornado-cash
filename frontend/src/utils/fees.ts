import { xionGasValues, type ChainInfo } from "@burnt-labs/constants";
import { calculateFee, GasPrice, StdFee } from "@cosmjs/stargate";
import { GAS_ADJUSTMENT, GAS_MARGIN } from "../config";

/**
 * Formats a GasPrice from ChainInfo configuration
 * Uses the low gas price step from the first fee currency
 */
export function formatGasPrice(chainInfo: ChainInfo): GasPrice {
  const feeCurrency = chainInfo.feeCurrencies[0];
  const gasPrice = feeCurrency.gasPriceStep.low;
  return GasPrice.fromString(`${gasPrice}${feeCurrency.coinMinimalDenom}`);
}

/**
 * Calculates StdFee from simulated gas with adjustments
 * Applies gas adjustment multiplier and adds gas margin
 *
 * @param simmedGas - Gas amount from simulation
 * @param chainInfo - Chain configuration
 * @returns StdFee with adjusted gas and calculated fee amount
 */
export function getGasCalculation(
  simmedGas: number,
  chainInfo: ChainInfo,
): StdFee {
  const gasPrice = formatGasPrice(chainInfo);
  const gasAdjustment = GAS_ADJUSTMENT || xionGasValues.gasAdjustment;
  const gasAdjustmentMargin = GAS_MARGIN || xionGasValues.gasAdjustmentMargin;

  const adjustedGas = Math.ceil(
    simmedGas * gasAdjustment + gasAdjustmentMargin,
  );

  return calculateFee(adjustedGas, gasPrice);
}
