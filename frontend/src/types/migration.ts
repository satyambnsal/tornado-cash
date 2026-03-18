export enum FeatureKey {
  PASSKEY = "passkey",
  ZKEMAIL = "zkemail",

}

export interface PromotedFeature {
  title: string;
  description: string;
}

export interface AccountFeatureSet {
  checksum: string;
  features: Set<FeatureKey>;
  promotedFeatures: PromotedFeature[];
}
