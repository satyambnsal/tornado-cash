import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3016;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for proof data

// Circuit files paths
const CIRCUITS_DIR = path.resolve(__dirname, '../circom-circuits');
const WASM_DIR = path.join(CIRCUITS_DIR, 'wasm');
const ZKEY_DIR = path.join(CIRCUITS_DIR, 'zkey');

// Available circuits
const CIRCUITS = {
  withdraw_small: {
    wasm: path.join(WASM_DIR, 'withdraw_small.wasm'),
    zkey: path.join(ZKEY_DIR, 'withdraw_small.zkey'),
  },
  commitment: {
    wasm: path.join(WASM_DIR, 'commitment.wasm'),
    zkey: path.join(ZKEY_DIR, 'commitment.zkey'),
  },
};

// Initialize Poseidon hash
let poseidon: any;
let F: any;

// Helper function to format proof for contract
function formatProofForContract(proof: any): {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
} {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][0], proof.pi_b[0][1]],
      [proof.pi_b[1][0], proof.pi_b[1][1]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}

// Helper function to validate circuit files exist
function validateCircuitFiles(circuitName: string): { valid: boolean; error?: string } {
  const circuit = CIRCUITS[circuitName as keyof typeof CIRCUITS];

  if (!circuit) {
    return {
      valid: false,
      error: `Circuit "${circuitName}" not found. Available circuits: ${Object.keys(CIRCUITS).join(', ')}`
    };
  }

  if (!fs.existsSync(circuit.wasm)) {
    return { valid: false, error: `WASM file not found: ${circuit.wasm}` };
  }

  if (!fs.existsSync(circuit.zkey)) {
    return { valid: false, error: `zkey file not found: ${circuit.zkey}` };
  }

  return { valid: true };
}

// Initialize server
async function initializeServer() {
  console.log('🔧 Initializing cryptographic libraries...');
  poseidon = await buildPoseidon();
  F = poseidon.F;
  console.log('✅ Poseidon initialized');

  // Verify circuit files exist
  console.log('📁 Checking circuit files...');
  for (const [name, paths] of Object.entries(CIRCUITS)) {
    const wasmExists = fs.existsSync(paths.wasm);
    const zkeyExists = fs.existsSync(paths.zkey);
    console.log(`   ${name}:`);
    console.log(`      WASM: ${wasmExists ? '✅' : '❌'} ${paths.wasm}`);
    console.log(`      zkey: ${zkeyExists ? '✅' : '❌'} ${paths.zkey}`);
  }
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    availableCircuits: Object.keys(CIRCUITS),
  });
});

// Get available circuits
app.get('/circuits', (req: Request, res: Response) => {
  const circuits = Object.keys(CIRCUITS).map((name) => {
    const circuit = CIRCUITS[name as keyof typeof CIRCUITS];
    return {
      name,
      wasmExists: fs.existsSync(circuit.wasm),
      zkeyExists: fs.existsSync(circuit.zkey),
    };
  });

  res.json({ circuits });
});

// Generate withdrawal proof
app.post('/generate-proof/withdraw', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    console.log('📝 Received withdrawal proof request');

    const { input } = req.body;

    // Validate input
    if (!input) {
      return res.status(400).json({ error: 'Missing input parameter' });
    }

    // Validate required fields
    const requiredFields = [
      'root',
      'nullifierHash',
      'recipient',
      'relayer',
      'fee',
      'refund',
      'nullifier',
      'secret',
      'pathElements',
      'pathIndices',
    ];

    for (const field of requiredFields) {
      if (input[field] === undefined || input[field] === null) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Validate circuit files
    const validation = validateCircuitFiles('withdraw_small');
    if (!validation.valid) {
      return res.status(500).json({ error: validation.error });
    }

    const circuit = CIRCUITS.withdraw_small;

    console.log('   🔐 Generating proof...');
    console.log(`   Input root: ${input.root}`);
    console.log(`   Input nullifier hash: ${input.nullifierHash}`);

    // Generate proof using snarkjs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      circuit.wasm,
      circuit.zkey
    );

    // Format proof for contract
    const formattedProof = formatProofForContract(proof);

    // Convert public signals to strings
    const publicInputs = publicSignals.map((signal: any) => {
      if (typeof signal === 'bigint') {
        return signal.toString();
      }
      return String(signal);
    });

    const duration = Date.now() - startTime;
    console.log(`   ✅ Proof generated successfully in ${duration}ms`);

    res.json({
      success: true,
      proof: formattedProof,
      publicSignals: publicInputs,
      duration,
    });
  } catch (error: any) {
    console.error('❌ Error generating proof:', error);
    res.status(500).json({
      error: 'Failed to generate proof',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Generate commitment proof
app.post('/generate-proof/commitment', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    console.log('📝 Received commitment proof request');

    const { input } = req.body;

    // Validate input
    if (!input) {
      return res.status(400).json({ error: 'Missing input parameter' });
    }

    // Validate required fields
    const requiredFields = ['nullifier', 'secret'];

    for (const field of requiredFields) {
      if (input[field] === undefined || input[field] === null) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Validate circuit files
    const validation = validateCircuitFiles('commitment');
    if (!validation.valid) {
      return res.status(500).json({ error: validation.error });
    }

    const circuit = CIRCUITS.commitment;

    console.log('   🔐 Generating commitment proof...');

    // Generate proof using snarkjs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      circuit.wasm,
      circuit.zkey
    );

    // Format proof for contract
    const formattedProof = formatProofForContract(proof);

    // Convert public signals to strings
    const publicInputs = publicSignals.map((signal: any) => {
      if (typeof signal === 'bigint') {
        return signal.toString();
      }
      return String(signal);
    });

    const duration = Date.now() - startTime;
    console.log(`   ✅ Proof generated successfully in ${duration}ms`);

    res.json({
      success: true,
      proof: formattedProof,
      publicSignals: publicInputs,
      duration,
    });
  } catch (error: any) {
    console.error('❌ Error generating proof:', error);
    res.status(500).json({
      error: 'Failed to generate proof',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Compute commitment and nullifier hash
app.post('/compute/commitment', async (req: Request, res: Response) => {
  try {
    const { nullifier, secret } = req.body;

    if (!nullifier || !secret) {
      return res.status(400).json({ error: 'Missing nullifier or secret' });
    }

    // Convert to BigInt
    const nullifierBigInt = BigInt(nullifier);
    const secretBigInt = BigInt(secret);

    // Compute commitment and nullifier hash using Poseidon
    const commitment = F.toObject(poseidon([nullifierBigInt, secretBigInt]));
    const nullifierHash = F.toObject(poseidon([nullifierBigInt]));

    res.json({
      commitment: commitment.toString(),
      nullifierHash: nullifierHash.toString(),
    });
  } catch (error: any) {
    console.error('❌ Error computing commitment:', error);
    res.status(500).json({
      error: 'Failed to compute commitment',
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    availableEndpoints: [
      'GET /health',
      'GET /circuits',
      'POST /generate-proof/withdraw',
      'POST /generate-proof/commitment',
      'POST /compute/commitment',
    ],
  });
});

// Start server
async function start() {
  try {
    await initializeServer();

    app.listen(PORT, () => {
      console.log(`\n🚀 Tornado Cash Proof Server running on port ${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(`   Available circuits: http://localhost:${PORT}/circuits`);
      console.log(`\n📡 API Endpoints:`);
      console.log(`   POST /generate-proof/withdraw - Generate withdrawal proof`);
      console.log(`   POST /generate-proof/commitment - Generate commitment proof`);
      console.log(`   POST /compute/commitment - Compute commitment hash\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
