/**
 * Example client for Tornado Cash Proof Server
 *
 * This file demonstrates how to integrate the proof server
 * with your frontend application or another backend service.
 */

import * as crypto from 'crypto';

// Configuration
const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL || 'http://localhost:3001';

// Helper function to convert address to BigInt (for circuit)
function addressToBigInt(address: string): string {
  if (address.startsWith('0x')) {
    // Hex address - decode it directly
    const hex = address.slice(2);
    const padded = hex.padStart(64, '0');
    return BigInt('0x' + padded).toString();
  } else {
    // Bech32 address - hash it with SHA256
    const addressHash = crypto.createHash('sha256').update(address).digest('hex');
    // Take first 30 bytes (60 hex chars) to fit in BN254 field
    return BigInt('0x' + '0000' + addressHash.slice(0, 60)).toString();
  }
}

/**
 * Check if the proof server is healthy
 */
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PROOF_SERVER_URL}/health`);
    const data: any = await response.json();
    console.log('Server status:', data);
    return data.status === 'ok';
  } catch (error) {
    console.error('Failed to connect to proof server:', error);
    return false;
  }
}

/**
 * Get available circuits from the server
 */
async function getAvailableCircuits() {
  try {
    const response = await fetch(`${PROOF_SERVER_URL}/circuits`);
    const data = await response.json() as any;
    console.log('Available circuits:', data.circuits);
    return data.circuits;
  } catch (error) {
    console.error('Failed to fetch circuits:', error);
    throw error;
  }
}

/**
 * Compute commitment and nullifier hash
 */
async function computeCommitment(nullifier: string, secret: string) {
  try {
    const response = await fetch(`${PROOF_SERVER_URL}/compute/commitment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nullifier,
        secret,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Failed to compute commitment: ${error.message}`);
    }

    const data = await response.json();
    console.log('Commitment computed:', data);
    return data;
  } catch (error) {
    console.error('Error computing commitment:', error);
    throw error;
  }
}

/**
 * Generate withdrawal proof
 */
async function generateWithdrawProof(withdrawInput: {
  root: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  fee: string;
  refund: string;
  nullifier: string;
  secret: string;
  pathElements: string[];
  pathIndices: number[];
}) {
  try {
    console.log('Requesting proof generation from server...');

    const response = await fetch(`${PROOF_SERVER_URL}/generate-proof/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: withdrawInput,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Failed to generate proof: ${error.message}`);
    }

    const data: any = await response.json();
    console.log(`Proof generated in ${data.duration}ms`);
    return {
      proof: data.proof,
      publicSignals: data.publicSignals,
    };
  } catch (error) {
    console.error('Error generating withdrawal proof:', error);
    throw error;
  }
}

/**
 * Generate commitment proof
 */
async function generateCommitmentProof(nullifier: string, secret: string) {
  try {
    console.log('Requesting commitment proof generation...');

    const response = await fetch(`${PROOF_SERVER_URL}/generate-proof/commitment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          nullifier,
          secret,
        },
      }),
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Failed to generate proof: ${error.message}`);
    }

    const data: any = await response.json();
    console.log(`Commitment proof generated in ${data.duration}ms`);
    return {
      proof: data.proof,
      publicSignals: data.publicSignals,
    };
  } catch (error) {
    console.error('Error generating commitment proof:', error);
    throw error;
  }
}

/**
 * Complete withdrawal flow example
 */
async function exampleWithdrawalFlow() {
  console.log('\n=== Example Withdrawal Flow ===\n');

  // Step 1: Check server health
  console.log('1. Checking server health...');
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    throw new Error('Proof server is not available');
  }

  // Step 2: Get available circuits
  console.log('\n2. Getting available circuits...');
  await getAvailableCircuits();

  // Step 3: Prepare withdrawal input
  console.log('\n3. Preparing withdrawal input...');

  // Example data (replace with actual values from your deposit)
  const withdrawInput = {
    root: '123456789012345678901234567890', // From contract
    nullifierHash: '987654321098765432109876543210', // Computed from your nullifier
    recipient: addressToBigInt('xion1h26yyjht8ch5gg9kpxgcfrxvz0j30yp728zfq6'),
    relayer: addressToBigInt('0x0000000000000000000000000000000000000000'),
    fee: '0',
    refund: '0',
    nullifier: '111111111111111111111111111111', // Your secret nullifier
    secret: '222222222222222222222222222222', // Your secret
    pathElements: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0'], // Merkle proof
    pathIndices: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Merkle proof indices
  };

  // Step 4: Generate proof
  console.log('\n4. Generating withdrawal proof...');
  const { proof, publicSignals } = await generateWithdrawProof(withdrawInput);

  console.log('\n5. Proof generated successfully!');
  console.log('Proof:', JSON.stringify(proof, null, 2));
  console.log('Public signals:', publicSignals);

  console.log('\n6. Ready to submit to blockchain!');
  console.log('Use these values in your contract withdrawal transaction:');
  console.log('  - proof:', proof);
  console.log('  - publicSignals:', publicSignals);

  return { proof, publicSignals };
}

/**
 * Example: Compute commitment for deposit
 */
async function exampleComputeCommitment() {
  console.log('\n=== Example Compute Commitment ===\n');

  // Generate random nullifier and secret (31 bytes to fit in BN254 field)
  const nullifier = BigInt('0x' + crypto.randomBytes(31).toString('hex')).toString();
  const secret = BigInt('0x' + crypto.randomBytes(31).toString('hex')).toString();

  console.log('Nullifier:', nullifier);
  console.log('Secret:', secret);

  const { commitment, nullifierHash }: any = await computeCommitment(nullifier, secret);

  console.log('\nComputed values:');
  console.log('Commitment:', commitment);
  console.log('Nullifier hash:', nullifierHash);

  console.log('\n⚠️  IMPORTANT: Save these values securely!');
  console.log('You will need them to withdraw your funds later.');

  return { nullifier, secret, commitment, nullifierHash };
}

// Export functions for use in other modules
export {
  checkServerHealth,
  getAvailableCircuits,
  computeCommitment,
  generateWithdrawProof,
  generateCommitmentProof,
  exampleWithdrawalFlow,
  exampleComputeCommitment,
  addressToBigInt,
};

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      // Example 1: Compute commitment
      // await exampleComputeCommitment();

      // Example 2: Generate withdrawal proof
      // Uncomment to test (requires actual deposit data)
      await exampleWithdrawalFlow();

    } catch (error) {
      console.error('Error running examples:', error);
      process.exit(1);
    }
  })();
}
