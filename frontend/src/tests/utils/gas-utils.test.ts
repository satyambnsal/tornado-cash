import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatGasPrice, getGasCalculation } from "../../utils/fees";
import { GasPrice } from "@cosmjs/stargate";
import type { ChainInfo } from "@burnt-labs/constants";

// We need to be able to change the mock implementation of config
const mocks = vi.hoisted(() => ({
  GAS_ADJUSTMENT: 1.2,
  GAS_MARGIN: 1000,
}));

vi.mock("../../config", () => ({
  get GAS_ADJUSTMENT() {
    return mocks.GAS_ADJUSTMENT;
  },
  get GAS_MARGIN() {
    return mocks.GAS_MARGIN;
  },
}));

vi.mock("@burnt-labs/constants", () => ({
  xionGasValues: {
    gasAdjustment: 1.4,
    gasAdjustmentMargin: 2000,
  },
}));

const mockChainInfo = {
  feeCurrencies: [
    {
      gasPriceStep: {
        low: 0.01,
        average: 0.025,
        high: 0.04,
      },
      coinMinimalDenom: "uxion",
    },
  ],
};

describe("formatGasPrice", () => {
  it("formats gas price correctly from chain info", () => {
    const result = formatGasPrice(mockChainInfo as unknown as ChainInfo);
    expect(result).toBeInstanceOf(GasPrice);
    expect(result.amount.toString()).toBe("0.01");
    expect(result.denom).toBe("uxion");
  });
});

describe("getGasCalculation", () => {
  beforeEach(() => {
    mocks.GAS_ADJUSTMENT = 1.2;
    mocks.GAS_MARGIN = 1000;
  });

  it("calculates fee correctly with configured adjustment and margin", () => {
    const simmedGas = 100000;
    // Expected gas = ceil(100000 * 1.2 + 1000) = ceil(120000 + 1000) = 121000
    // Fee = 121000 * 0.01 = 1210 uxion

    const fee = getGasCalculation(simmedGas, mockChainInfo as unknown as ChainInfo);

    expect(fee.amount[0].denom).toBe("uxion");
    expect(fee.amount[0].amount).toBe("1210");
    expect(fee.gas).toBe("121000");
  });

  it("calculates fee correctly with fallback values", () => {
    mocks.GAS_ADJUSTMENT = undefined as unknown as number;
    mocks.GAS_MARGIN = undefined as unknown as number;

    const simmedGas = 100000;
    // Expected gas = ceil(100000 * 1.4 + 2000) = ceil(140000 + 2000) = 142000
    // Fee = 142000 * 0.01 = 1420 uxion

    const fee = getGasCalculation(simmedGas, mockChainInfo as unknown as ChainInfo);

    expect(fee.amount[0].denom).toBe("uxion");
    expect(fee.amount[0].amount).toBe("1420");
    expect(fee.gas).toBe("142000");
  });
});
