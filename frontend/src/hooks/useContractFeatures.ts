import { useContext } from "react";
import {
  ContractContext,
  ContractContextProps,
} from "../components/ContractContext";
import { FeatureKey } from "../types/migration";

interface UseContractFeaturesProps {
  requestedFeatures: FeatureKey[];
}

export function useContractFeatures({
  requestedFeatures,
}: UseContractFeaturesProps) {
  const { isLoadingFeatures, enabledFeatures } = useContext(
    ContractContext,
  ) as ContractContextProps;

  const hasFeatures = requestedFeatures.every((feature) =>
    enabledFeatures.includes(feature),
  );

  return {
    isLoadingFeatures,
    hasFeatures,
  };
}
