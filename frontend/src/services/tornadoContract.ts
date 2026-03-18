/**
 * Tornado Cash Contract Interaction Service
 * Handles all contract queries and transactions
 */

import type { AAClient } from "@burnt-labs/signers";
import type { Coin } from "@cosmjs/stargate";
import type {
  ContractConfig,
  Deposit,
  DepositMsg,
  WithdrawMsg,
  ProofData,
} from "../types/tornado";
import { ContractError } from "../types/tornado";
import { toUint256String } from "../utils/crypto";

/**
 * Tornado Cash Contract Service
 */
export class TornadoContractService {
  private client: AAClient;
  private contractAddress: string;

  constructor(client: AAClient, contractAddress: string) {
    this.client = client;
    this.contractAddress = contractAddress;
  }

  /**
   * Query contract configuration
   * @returns Promise<ContractConfig>
   */
  async getConfig(): Promise<ContractConfig> {
    try {
      const config = await this.client.queryContractSmart(
        this.contractAddress,
        { config: {} }
      );
      return config;
    } catch (error) {
      throw new ContractError("Failed to get contract config", error);
    }
  }

  /**
   * Get current Merkle root
   * @returns Promise<string>
   */
  async getMerkleRoot(): Promise<string> {
    try {
      const result = await this.client.queryContractSmart(
        this.contractAddress,
        { merkle_root: {} }
      );
      return result.root;
    } catch (error) {
      throw new ContractError("Failed to get Merkle root", error);
    }
  }

  /**
   * Query deposit by ID
   * @param id - Deposit ID
   * @returns Promise<Deposit>
   */
  async getDeposit(id: number): Promise<Deposit> {
    try {
      const result = await this.client.queryContractSmart(
        this.contractAddress,
        { deposit: { id } }
      );
      return result.deposit;
    } catch (error) {
      throw new ContractError(`Failed to get deposit ${id}`, error);
    }
  }

  /**
   * Check if nullifier hash has been used
   * @param nullifierHash - Nullifier hash as string
   * @returns Promise<boolean>
   */
  async isNullifierUsed(nullifierHash: string): Promise<boolean> {
    try {
      const result = await this.client.queryContractSmart(
        this.contractAddress,
        { is_nullifier_used: { nullifier_hash: nullifierHash } }
      );
      return result.used;
    } catch (error) {
      throw new ContractError("Failed to check nullifier status", error);
    }
  }

  /**
   * Make a deposit to the Tornado Cash pool
   * @param senderAddress - Address making the deposit
   * @param commitment - Commitment value (BigInt as string)
   * @param amount - Deposit amount in coins
   * @returns Promise<{ txHash: string; events: readonly any[] }>
   */
  async deposit(
    senderAddress: string,
    commitment: string,
    amount: readonly Coin[]
  ): Promise<{ txHash: string; events: readonly any[] }> {
    try {
      const depositMsg: DepositMsg = {
        deposit: {
          commitment: toUint256String(BigInt(commitment)),
        },
      };

      const result = await this.client.execute(
        senderAddress,
        this.contractAddress,
        depositMsg,
        "auto", // Auto gas calculation
        undefined,
        amount
      );

      return {
        txHash: result.transactionHash,
        events: result.events,
      };
    } catch (error) {
      throw new ContractError("Failed to execute deposit", error);
    }
  }

  /**
   * Withdraw funds from the Tornado Cash pool
   * @param senderAddress - Address executing the withdrawal
   * @param proof - Zero-knowledge proof
   * @param publicInputs - Public signals from proof
   * @param root - Merkle root
   * @param nullifierHash - Nullifier hash
   * @param recipient - Recipient address
   * @param relayer - Relayer address (or "0x0...0" for no relayer)
   * @param fee - Relayer fee
   * @param refund - Refund amount
   * @returns Promise<{ txHash: string; events: readonly any[] }>
   */
  async withdraw(
    senderAddress: string,
    proof: ProofData,
    publicInputs: string[],
    root: string,
    nullifierHash: string,
    recipient: string,
    relayer: string = "0x0000000000000000000000000000000000000000",
    fee: string = "0",
    refund: string = "0"
  ): Promise<{ txHash: string; events: readonly any[] }> {
    try {
      const withdrawMsg: WithdrawMsg = {
        withdraw: {
          proof,
          public_inputs: publicInputs,
          root: toUint256String(BigInt(root)),
          nullifier_hash: toUint256String(BigInt(nullifierHash)),
          recipient,
          relayer,
          fee: toUint256String(BigInt(fee)),
          refund: toUint256String(BigInt(refund)),
        },
      };

      const result = await this.client.execute(
        senderAddress,
        this.contractAddress,
        withdrawMsg,
        "auto" // Auto gas calculation
      );

      return {
        txHash: result.transactionHash,
        events: result.events,
      };
    } catch (error) {
      throw new ContractError("Failed to execute withdrawal", error);
    }
  }

  /**
   * Get account balance
   * @param address - Address to query
   * @param denom - Token denomination (e.g., "uxion")
   * @returns Promise<string>
   */
  async getBalance(address: string, denom: string = "uxion"): Promise<string> {
    try {
      const balance = await this.client.getBalance(address, denom);
      return balance.amount;
    } catch (error) {
      throw new ContractError("Failed to get balance", error);
    }
  }
}

/**
 * Helper function to extract deposit ID and leaf index from transaction events
 * @param events - Transaction events
 * @returns { depositId: string; leafIndex: string }
 */
export function extractDepositInfo(events: readonly any[]): {
  depositId: string | null;
  leafIndex: string | null;
} {
  let depositId: string | null = null;
  let leafIndex: string | null = null;

  for (const event of events) {
    if (event.type === "wasm") {
      for (const attr of event.attributes) {
        if (attr.key === "deposit_id") {
          depositId = attr.value;
        }
        if (attr.key === "leaf_index") {
          leafIndex = attr.value;
        }
      }
    }
  }

  return { depositId, leafIndex };
}

/**
 * Create TornadoContractService instance
 * @param client - AAClient instance
 * @param contractAddress - Tornado contract address
 * @returns TornadoContractService
 */
export function createTornadoContract(
  client: AAClient,
  contractAddress: string
): TornadoContractService {
  return new TornadoContractService(client, contractAddress);
}
