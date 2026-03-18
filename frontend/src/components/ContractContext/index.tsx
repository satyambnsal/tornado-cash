import React, { createContext, ReactNode, useState, useEffect } from "react";
import { FeatureKey } from "../../types/migration";
import { fetchContractChecksum, accountFeatures } from "../../utils/migration";
import { useSigningClient } from "../../hooks/useSigningClient";

export interface ContractContextProps {
  isLoadingFeatures: boolean;
  enabledFeatures: FeatureKey[];
}

const defaultContextValue: ContractContextProps = {
  isLoadingFeatures: false,
  enabledFeatures: [],
};

export const ContractContext =
  createContext<ContractContextProps>(defaultContextValue);

export const ContractContextProvider = ({
  children,
  codeId,
}: {
  children: ReactNode;
  codeId?: number;
}) => {
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState<FeatureKey[]>([]);
  const { client } = useSigningClient();

  useEffect(() => {
    const fetchFeatures = async () => {
      if (!codeId || !client) return;

      setIsLoadingFeatures(true);
      try {
        const checksum = await fetchContractChecksum(client, codeId);
        if (!checksum) {
          console.warn(
            `[ContractContext] No checksum found for codeId: ${codeId}`,
          );
          setEnabledFeatures([]);
          return;
        }

        const featureSet = accountFeatures[checksum];
        if (featureSet) {
          const features = Array.from(featureSet.features);
          setEnabledFeatures(features);
        } else {
          console.warn(
            `[ContractContext] No feature set found for checksum: ${checksum}`,
          );
          setEnabledFeatures([]);
        }
      } catch (error) {
        console.error(
          "[ContractContext] Error fetching contract features:",
          error,
        );
        setEnabledFeatures([]);
      } finally {
        setIsLoadingFeatures(false);
      }
    };

    fetchFeatures();
  }, [codeId, client]);

  const contextValue = {
    isLoadingFeatures,
    enabledFeatures,
  };

  return (
    <ContractContext.Provider value={contextValue}>
      {children}
    </ContractContext.Provider>
  );
};
