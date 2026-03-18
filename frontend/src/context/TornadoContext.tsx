/**
 * Tornado Cash Context
 * Provides Tornado-specific state and contract interactions
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { AAClient } from "@burnt-labs/signers";
import type { ContractConfig } from "../types/tornado";
import { TornadoContractService, createTornadoContract } from "../services/tornadoContract";
import { ContractError } from "../types/tornado";
import {
  TORNADO_CONTRACT_ADDRESS,
  TORNADO_DENOMINATION,
  TORNADO_MERKLE_TREE_LEVELS,
  CHAIN_ID,
} from "../config";

interface TornadoContextType {
  // Contract state
  contractAddress: string;
  denomination: string;
  merkleTreeLevels: number;
  contractConfig: ContractConfig | null;
  isLoadingConfig: boolean;

  // Contract service
  contractService: TornadoContractService | null;

  // Methods
  initializeContract: (client: AAClient) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const TornadoContext = createContext<TornadoContextType | undefined>(undefined);

interface TornadoProviderProps {
  children: ReactNode;
}

export function TornadoProvider({ children }: TornadoProviderProps) {
  const [contractAddress] = useState(TORNADO_CONTRACT_ADDRESS);
  const [denomination] = useState(TORNADO_DENOMINATION);
  const [merkleTreeLevels] = useState(TORNADO_MERKLE_TREE_LEVELS);
  const [contractConfig, setContractConfig] = useState<ContractConfig | null>(
    null
  );
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [contractService, setContractService] =
    useState<TornadoContractService | null>(null);

  const initializeContract = async (client: AAClient) => {
    try {
      const service = createTornadoContract(client, contractAddress);
      setContractService(service);

      // Load contract config
      await refreshConfigWithService(service);
    } catch (error) {
      console.error("Failed to initialize contract:", error);
      throw new ContractError("Failed to initialize contract", error);
    }
  };

  const refreshConfigWithService = async (service: TornadoContractService) => {
    try {
      setIsLoadingConfig(true);
      const config = await service.getConfig();
      setContractConfig(config);
    } catch (error) {
      console.error("Failed to load contract config:", error);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const refreshConfig = async () => {
    if (!contractService) {
      console.warn("Contract service not initialized");
      return;
    }
    await refreshConfigWithService(contractService);
  };

  const value: TornadoContextType = {
    contractAddress,
    denomination,
    merkleTreeLevels,
    contractConfig,
    isLoadingConfig,
    contractService,
    initializeContract,
    refreshConfig,
  };

  return (
    <TornadoContext.Provider value={value}>{children}</TornadoContext.Provider>
  );
}

export function useTornado() {
  const context = useContext(TornadoContext);
  if (context === undefined) {
    throw new Error("useTornado must be used within a TornadoProvider");
  }
  return context;
}
