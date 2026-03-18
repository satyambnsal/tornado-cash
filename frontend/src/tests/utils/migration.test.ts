import { describe, it, expect, vi } from "vitest";
import {
  getPromotedFeatures,
  fetchContractChecksum,
  accountFeatures,
} from "../../utils/migration";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

describe("getPromotedFeatures", () => {
  it("returns promoted features for known checksum", () => {
    const checksum = Object.keys(accountFeatures)[0];
    const features = getPromotedFeatures(checksum);
    expect(features).toEqual(accountFeatures[checksum].promotedFeatures);
  });

  it("returns empty array for unknown checksum", () => {
    const features = getPromotedFeatures("unknown_checksum");
    expect(features).toEqual([]);
  });
});

describe("fetchContractChecksum", () => {
  it("returns checksum when client call succeeds", async () => {
    const mockClient = {
      getCodeDetails: vi.fn().mockResolvedValue({ checksum: "test_checksum" }),
    } as unknown as CosmWasmClient;

    const checksum = await fetchContractChecksum(mockClient, 123);
    expect(checksum).toBe("test_checksum");
    expect(mockClient.getCodeDetails).toHaveBeenCalledWith(123);
  });

  it("returns null when client call fails", async () => {
    const mockClient = {
      getCodeDetails: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as CosmWasmClient;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const checksum = await fetchContractChecksum(mockClient, 123);
    expect(checksum).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns null when checksum is missing in response", async () => {
    const mockClient = {
      getCodeDetails: vi.fn().mockResolvedValue({}),
    } as unknown as CosmWasmClient;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const checksum = await fetchContractChecksum(mockClient, 123);
    expect(checksum).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
