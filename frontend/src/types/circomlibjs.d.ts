/**
 * Type definitions for circomlibjs
 * circomlibjs doesn't have official TypeScript definitions
 */

declare module "circomlibjs" {
  export function buildPoseidon(): Promise<Poseidon>;

  export interface Poseidon {
    (inputs: bigint[]): any;
    F: Field;
  }

  export interface Field {
    toObject(value: any): bigint;
  }
}
