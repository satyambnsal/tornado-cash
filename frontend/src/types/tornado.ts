/**
 * Tornado Cash types for privacy mixer functionality
 */

// =============================================================================
// Status Types
// =============================================================================

export type DepositStatus =
  | "idle"
  | "generating"
  | "depositing"
  | "success"
  | "error";

export type WithdrawStatus =
  | "idle"
  | "validating"
  | "building_tree"
  | "generating_proof"
  | "withdrawing"
  | "success"
  | "error";

// =============================================================================
// Note Types
// =============================================================================

/**
 * Tornado Cash deposit note - contains all information needed for withdrawal
 * SECURITY: Never store this in localStorage or send to a server
 */
export interface TornadoNote {
  version: string; // Note format version (e.g., "1.0")
  network: string; // Chain ID (e.g., "xion-testnet-2")
  contractAddress: string; // Contract address
  denomination: string; // Deposit amount in base units
  nullifier: string; // Random nullifier (BigInt as string)
  secret: string; // Random secret (BigInt as string)
  commitment: string; // Poseidon hash of (nullifier, secret)
  nullifierHash: string; // Poseidon hash of (nullifier)
  depositId?: string; // Deposit ID from contract event
  leafIndex: string; // Merkle tree leaf index
  timestamp: string; // ISO timestamp of deposit
}

/**
 * Deposit data to save in localStorage (NO SECRETS!)
 * Only contains metadata for transaction history
 */
export interface DepositMetadata {
  contractAddress: string;
  denomination: string;
  depositId?: string;
  txHash: string;
  timestamp: string;
  leafIndex: string;
}

/**
 * Withdrawal metadata to save in localStorage (NO SECRETS!)
 */
export interface WithdrawalMetadata {
  contractAddress: string;
  denomination: string;
  recipient: string;
  txHash: string;
  timestamp: string;
}

// =============================================================================
// Contract Types
// =============================================================================

/**
 * Contract configuration from smart contract query
 */
export interface ContractConfig {
  denomination: string; // Amount required for deposits
  merkle_tree_levels: number; // Depth of Merkle tree
  next_leaf_index: string; // Next available leaf index
  verifier_code_id: string; // Verifier contract code ID
}

/**
 * Deposit information from contract query
 */
export interface Deposit {
  id: number;
  commitment: string;
  leaf_index: number;
  depositor: string;
  timestamp: number;
}

/**
 * Proof data for Groth16 zero-knowledge proof
 */
export interface ProofData {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

// =============================================================================
// Proof Server Types
// =============================================================================

/**
 * Request to compute Poseidon commitment and nullifier hash
 */
export interface ComputeCommitmentRequest {
  nullifier: string; // BigInt as string
  secret: string; // BigInt as string
}

/**
 * Response from commitment computation
 */
export interface ComputeCommitmentResponse {
  commitment: string; // BigInt as string
  nullifierHash: string; // BigInt as string
}

/**
 * Input for withdrawal proof generation
 */
export interface WithdrawInput {
  root: string; // Merkle root (BigInt as string)
  nullifierHash: string; // BigInt as string
  recipient: string; // Recipient address as BigInt string
  relayer: string; // Relayer address as BigInt string (or "0")
  fee: string; // Relayer fee (BigInt as string, usually "0")
  refund: string; // Refund amount (BigInt as string, usually "0")
  nullifier: string; // BigInt as string
  secret: string; // BigInt as string
  pathElements: string[]; // Merkle proof path elements
  pathIndices: number[]; // Merkle proof path indices (0 = left, 1 = right)
}

/**
 * Response from proof generation
 */
export interface GenerateProofResponse {
  success: boolean;
  proof: ProofData;
  publicSignals: string[]; // Public inputs to the circuit
  duration: number; // Proof generation time in milliseconds
}

/**
 * Proof server health check response
 */
export interface ProofServerHealth {
  status: string;
  timestamp: number;
  availableCircuits: string[];
}

// =============================================================================
// Merkle Tree Types
// =============================================================================

/**
 * Merkle tree with proof generation
 */
export interface MerkleTree {
  root: bigint;
  pathElements: bigint[][]; // Path elements for each leaf
  pathIndices: number[][]; // Path indices for each leaf
}

/**
 * Merkle proof for a specific leaf
 */
export interface MerkleProof {
  root: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}

// =============================================================================
// Contract Message Types
// =============================================================================

/**
 * Deposit message for contract execution
 */
export interface DepositMsg {
  deposit: {
    commitment: string; // Uint256 string
  };
}

/**
 * Withdraw message for contract execution
 */
export interface WithdrawMsg {
  withdraw: {
    proof: ProofData;
    public_inputs: string[]; // Public signals as strings
    root: string; // Merkle root (Uint256 string)
    nullifier_hash: string; // Nullifier hash (Uint256 string)
    recipient: string; // Recipient address (bech32 or hex)
    relayer: string; // Relayer address (bech32 or hex)
    fee: string; // Fee amount (Uint256 string)
    refund: string; // Refund amount (Uint256 string)
  };
}

// =============================================================================
// Transaction History Types
// =============================================================================

/**
 * Transaction type
 */
export type TransactionType = "deposit" | "withdrawal";

/**
 * Transaction history entry (stored in localStorage)
 */
export interface TransactionHistoryEntry {
  type: TransactionType;
  contractAddress: string;
  denomination: string;
  txHash: string;
  timestamp: string;
  // Deposit-specific
  depositId?: string;
  leafIndex?: string;
  // Withdrawal-specific
  recipient?: string;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Tornado Cash specific errors
 */
export class TornadoCashError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any,
  ) {
    super(message);
    this.name = "TornadoCashError";
  }
}

/**
 * Proof generation errors
 */
export class ProofGenerationError extends TornadoCashError {
  constructor(message: string, details?: any) {
    super(message, "PROOF_GENERATION_ERROR", details);
    this.name = "ProofGenerationError";
  }
}

/**
 * Contract interaction errors
 */
export class ContractError extends TornadoCashError {
  constructor(message: string, details?: any) {
    super(message, "CONTRACT_ERROR", details);
    this.name = "ContractError";
  }
}

/**
 * Note validation errors
 */
export class NoteValidationError extends TornadoCashError {
  constructor(message: string, details?: any) {
    super(message, "NOTE_VALIDATION_ERROR", details);
    this.name = "NoteValidationError";
  }
}
