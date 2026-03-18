/**
 * Proof Server API Client for Tornado Cash
 * Handles communication with the backend proof generation server
 */

import { TORNADO_PROOF_SERVER_URL } from "../config";
import type {
  ComputeCommitmentRequest,
  ComputeCommitmentResponse,
  WithdrawInput,
  GenerateProofResponse,
  ProofServerHealth,
} from "../types/tornado";
import { ProofGenerationError } from "../types/tornado";

/**
 * Proof Server API Client
 */
export class ProofServerClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || TORNADO_PROOF_SERVER_URL;
  }

  /**
   * Check proof server health
   * @returns Promise<ProofServerHealth>
   */
  async checkHealth(): Promise<ProofServerHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new ProofGenerationError(
          `Health check failed: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ProofGenerationError) {
        throw error;
      }
      throw new ProofGenerationError(
        "Failed to connect to proof server",
        { originalError: error }
      );
    }
  }

  /**
   * Compute Poseidon commitment and nullifier hash
   * @param request - Commitment request with nullifier and secret
   * @returns Promise<ComputeCommitmentResponse>
   */
  async computeCommitment(
    request: ComputeCommitmentRequest
  ): Promise<ComputeCommitmentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/compute/commitment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ProofGenerationError(
          `Failed to compute commitment: ${response.status} ${response.statusText}`,
          { serverError: error }
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ProofGenerationError) {
        throw error;
      }
      throw new ProofGenerationError(
        "Failed to compute commitment",
        { originalError: error }
      );
    }
  }

  /**
   * Generate withdrawal proof using zero-knowledge circuit
   * This operation can take 10-30 seconds
   * @param input - Withdrawal input data
   * @returns Promise<GenerateProofResponse>
   */
  async generateWithdrawalProof(
    input: WithdrawInput
  ): Promise<GenerateProofResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/generate-proof/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ProofGenerationError(
          `Failed to generate withdrawal proof: ${response.status} ${response.statusText}`,
          { serverError: error }
        );
      }

      const result = await response.json();

      // Validate response
      if (!result.proof || !result.publicSignals) {
        throw new ProofGenerationError(
          "Invalid proof response from server",
          { response: result }
        );
      }

      return result;
    } catch (error) {
      if (error instanceof ProofGenerationError) {
        throw error;
      }
      throw new ProofGenerationError(
        "Failed to generate withdrawal proof",
        { originalError: error }
      );
    }
  }

  /**
   * Generate withdrawal proof with retry logic
   * @param input - Withdrawal input data
   * @param maxRetries - Maximum number of retries (default: 3)
   * @param retryDelay - Delay between retries in ms (default: 2000)
   * @returns Promise<GenerateProofResponse>
   */
  async generateWithdrawalProofWithRetry(
    input: WithdrawInput,
    maxRetries: number = 3,
    retryDelay: number = 2000
  ): Promise<GenerateProofResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generateWithdrawalProof(input);
      } catch (error) {
        lastError = error as Error;
        console.error(`Proof generation attempt ${attempt + 1} failed:`, error);

        if (attempt < maxRetries - 1) {
          console.log(`Retrying in ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw new ProofGenerationError(
      `Failed to generate proof after ${maxRetries} attempts`,
      { lastError }
    );
  }

  /**
   * Get available circuits from proof server
   * @returns Promise<string[]>
   */
  async getAvailableCircuits(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/circuits`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new ProofGenerationError(
          `Failed to get circuits: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.circuits || [];
    } catch (error) {
      if (error instanceof ProofGenerationError) {
        throw error;
      }
      throw new ProofGenerationError(
        "Failed to get available circuits",
        { originalError: error }
      );
    }
  }
}

// Export singleton instance
export const proofServerClient = new ProofServerClient();

// Export helper functions

/**
 * Compute commitment and nullifier hash
 * @param nullifier - Nullifier as string
 * @param secret - Secret as string
 * @returns Promise<ComputeCommitmentResponse>
 */
export async function computeCommitment(
  nullifier: string,
  secret: string
): Promise<ComputeCommitmentResponse> {
  return proofServerClient.computeCommitment({ nullifier, secret });
}

/**
 * Generate withdrawal proof
 * @param input - Withdrawal input data
 * @returns Promise<GenerateProofResponse>
 */
export async function generateWithdrawalProof(
  input: WithdrawInput
): Promise<GenerateProofResponse> {
  return proofServerClient.generateWithdrawalProofWithRetry(input);
}

/**
 * Check if proof server is available
 * @returns Promise<boolean>
 */
export async function isProofServerAvailable(): Promise<boolean> {
  try {
    await proofServerClient.checkHealth();
    return true;
  } catch {
    return false;
  }
}
