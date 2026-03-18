import { describe, it, expect } from '@jest/globals';
const path = require('path');
const { buildPoseidon } = require('circomlibjs');
const crypto = require('crypto');
const fs = require('fs');
const { writeFileSync, readFileSync } = require('fs');
const wasm_tester = require('circom_tester').wasm;
const snarkjs = require('snarkjs');

describe('Tornado Cash Circuits', () => {
  let poseidon: any;

  beforeAll(async () => {
    poseidon = await buildPoseidon();
  });

  // Helper function to calculate witness using pre-compiled WASM
  async function calculateWitness(wasmFile: string, input: any) {
    const wasmPath = path.join(__dirname, '../wasm', wasmFile);
    const wasmBuffer = fs.readFileSync(wasmPath);

    // Use witness calculator from circom_tester
    const wc = require('circom_tester/wasm/witness_calculator.js');
    const witnessCalculator = await wc(wasmBuffer);
    const witness = await witnessCalculator.calculateWitness(input, false);

    return witness;
  }

  // Helper function to convert address to BigInt
  function addressToBigInt(address: string): string {
    const hex = address.startsWith('0x') ? address.slice(2) : address;
    // For Xion addresses (bech32), we'll use a hash to get a number
    // In production, you'd want a proper mapping
    const addressHash = crypto.createHash('sha256').update(address).digest('hex');
    return BigInt('0x' + addressHash.slice(0, 60)).toString(); // Take first 60 hex chars to fit in field
  }

  describe('CommitmentHasher', () => {
    it('should compute commitment and nullifier hash correctly', async () => {
      const nullifier = BigInt('12345');
      const secret = BigInt('67890');

      const witness = await calculateWitness('commitment.wasm', {
        nullifier: nullifier.toString(),
        secret: secret.toString(),
      });

      // Compute expected values using circomlibjs
      const F = poseidon.F;
      const expectedCommitment = F.toObject(poseidon([nullifier, secret]));
      const expectedNullifierHash = F.toObject(poseidon([nullifier]));

      // Get outputs
      const commitment = witness[1];
      const nullifierHash = witness[2];

      expect(commitment.toString()).toBe(expectedCommitment.toString());
      expect(nullifierHash.toString()).toBe(expectedNullifierHash.toString());
    });

    it('should generate unique commitments for different secrets', async () => {
      const nullifier = BigInt('12345');
      const secret1 = BigInt('67890');
      const secret2 = BigInt('11111');

      const witness1 = await calculateWitness('commitment.wasm', {
        nullifier: nullifier.toString(),
        secret: secret1.toString(),
      });

      const witness2 = await calculateWitness('commitment.wasm', {
        nullifier: nullifier.toString(),
        secret: secret2.toString(),
      });

      const commitment1 = witness1[1];
      const commitment2 = witness2[1];

      expect(commitment1).not.toBe(commitment2);
    });
  });

  describe('Withdraw Circuit', () => {
    // Helper function to build Merkle tree
    function buildMerkleTree(leaves: bigint[], levels: number): {
      root: bigint;
      pathElements: bigint[][];
      pathIndices: number[][];
    } {
      const tree: bigint[][] = [leaves];
      const F = poseidon.F;

      // Build tree level by level
      for (let level = 0; level < levels; level++) {
        const currentLevel = tree[level];
        const nextLevel: bigint[] = [];

        for (let i = 0; i < currentLevel.length; i += 2) {
          const left = currentLevel[i] || BigInt(0);
          const right = currentLevel[i + 1] || BigInt(0);
          const hash = poseidon([left, right]);
          nextLevel.push(F.toObject(hash));
        }

        tree.push(nextLevel);
      }

      const root = tree[levels][0];

      // Generate proofs for each leaf
      const pathElements: bigint[][] = [];
      const pathIndices: number[][] = [];

      for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
        const path: bigint[] = [];
        const indices: number[] = [];
        let index = leafIndex;

        for (let level = 0; level < levels; level++) {
          const isRight = index % 2;
          const siblingIndex = isRight ? index - 1 : index + 1;
          const sibling = tree[level][siblingIndex] || BigInt(0);

          path.push(sibling);
          indices.push(isRight);
          index = Math.floor(index / 2);
        }

        pathElements.push(path);
        pathIndices.push(indices);
      }

      return { root, pathElements, pathIndices };
    }

    it('should verify valid withdrawal proof', async () => {
      const levels = 10;
      const nullifier = BigInt('0x' + crypto.randomBytes(31).toString('hex'));
      const secret = BigInt('0x' + crypto.randomBytes(31).toString('hex'));

      // Compute commitment
      const F = poseidon.F;
      const commitment = F.toObject(poseidon([nullifier, secret]));
      const nullifierHash = F.toObject(poseidon([nullifier]));

      // Build Merkle tree with our commitment at index 0
      const numLeaves = 1 << levels; // 2^levels
      const leaves = new Array(numLeaves).fill(BigInt(0));
      leaves[0] = commitment;

      const { root, pathElements, pathIndices } = buildMerkleTree(leaves, levels);

      // Prepare witness
      const input = {
        root: root.toString(),
        nullifierHash: nullifierHash.toString(),
        recipient: addressToBigInt('0x1234567890123456789012345678901234567890'),
        relayer: addressToBigInt('0x0000000000000000000000000000000000000000'),
        fee: '0',
        refund: '0',
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        pathElements: pathElements[0].map(x => x.toString()),
        pathIndices: pathIndices[0],
      };

      const witness = await calculateWitness('withdraw_small.wasm', input);
      expect(witness).toBeDefined();
    });

    it('should fail with wrong nullifier hash', async () => {
      const levels = 10;
      const nullifier = BigInt('0x' + crypto.randomBytes(31).toString('hex'));
      const secret = BigInt('0x' + crypto.randomBytes(31).toString('hex'));

      const F = poseidon.F;
      const commitment = F.toObject(poseidon([nullifier, secret]));
      const wrongNullifierHash = F.toObject(poseidon([BigInt(123)])); // Wrong nullifier

      const numLeaves = 1 << levels;
      const leaves = new Array(numLeaves).fill(BigInt(0));
      leaves[0] = commitment;

      const { root, pathElements, pathIndices } = buildMerkleTree(leaves, levels);

      const input = {
        root: root.toString(),
        nullifierHash: wrongNullifierHash.toString(),
        recipient: addressToBigInt('0x1234567890123456789012345678901234567890'),
        relayer: addressToBigInt('0x0000000000000000000000000000000000000000'),
        fee: '0',
        refund: '0',
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        pathElements: pathElements[0].map(x => x.toString()),
        pathIndices: pathIndices[0],
      };

      await expect(calculateWitness('withdraw_small.wasm', input)).rejects.toThrow();
    });

    it('should fail with wrong Merkle root', async () => {
      const levels = 10;
      const nullifier = BigInt('0x' + crypto.randomBytes(31).toString('hex'));
      const secret = BigInt('0x' + crypto.randomBytes(31).toString('hex'));

      const F = poseidon.F;
      const commitment = F.toObject(poseidon([nullifier, secret]));
      const nullifierHash = F.toObject(poseidon([nullifier]));

      const numLeaves = 1 << levels;
      const leaves = new Array(numLeaves).fill(BigInt(0));
      leaves[0] = commitment;

      const { pathElements, pathIndices } = buildMerkleTree(leaves, levels);
      const wrongRoot = F.toObject(poseidon([BigInt(999)]));

      const input = {
        root: wrongRoot.toString(),
        nullifierHash: nullifierHash.toString(),
        recipient: addressToBigInt('0x1234567890123456789012345678901234567890'),
        relayer: addressToBigInt('0x0000000000000000000000000000000000000000'),
        fee: '0',
        refund: '0',
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        pathElements: pathElements[0].map(x => x.toString()),
        pathIndices: pathIndices[0],
      };

      await expect(calculateWitness('withdraw_small.wasm', input)).rejects.toThrow();
    });
  });

  describe('Commitment Proof Generation and Verification', () => {
    const wasmFile = path.resolve(__dirname, '../wasm/commitment.wasm');
    const zkeyFile = path.resolve(__dirname, '../zkey/commitment.zkey');
    const outputPath = path.resolve(__dirname, '../cache/commitment_proof_data.json');

    it('should generate and verify a valid commitment proof', async () => {
      // Skip if files don't exist yet
      let wasmData: Buffer;
      let zkeyData: Buffer;
      try {
        wasmData = readFileSync(wasmFile);
        zkeyData = readFileSync(zkeyFile);
      } catch (e) {
        console.log('WASM or zkey files not found for commitment circuit, skipping proof test');
        return;
      }

      const nullifier = BigInt('12345');
      const secret = BigInt('67890');

      const input = {
        nullifier: nullifier.toString(),
        secret: secret.toString(),
      };

      // Export verification key
      const vkey = await snarkjs.zKey.exportVerificationKey(
        new Uint8Array(zkeyData)
      );

      // Generate proof
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmFile,
        zkeyFile
      );

      // Verify proof
      const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      expect(verified).toBe(true);

      // Save vkey, publicSignals, and proof to JSON file
      const outputData = {
        vkey,
        publicSignals,
        proof
      };
      writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
      console.log('Saved commitment proof data to', outputPath);
    });
  });

  describe('Withdraw Proof Generation and Verification', () => {
    const wasmFile = path.resolve(__dirname, '../wasm/withdraw_small.wasm');
    const zkeyFile = path.resolve(__dirname, '../zkey/withdraw_small.zkey');
    const outputPath = path.resolve(__dirname, '../cache/withdraw_small_proof_data.json');

    it('should generate and verify a valid withdrawal proof', async () => {
      // Skip if files don't exist yet
      let wasmData: Buffer;
      let zkeyData: Buffer;
      try {
        wasmData = readFileSync(wasmFile);
        zkeyData = readFileSync(zkeyFile);
      } catch (e) {
        console.log('WASM or zkey files not found for withdraw_small circuit, skipping proof test');
        return;
      }

      const levels = 10;
      const nullifier = BigInt('0x' + crypto.randomBytes(31).toString('hex'));
      const secret = BigInt('0x' + crypto.randomBytes(31).toString('hex'));

      // Compute commitment
      const F = poseidon.F;
      const commitment = F.toObject(poseidon([nullifier, secret]));
      const nullifierHash = F.toObject(poseidon([nullifier]));

      // Build Merkle tree with our commitment at index 0
      const numLeaves = 1 << levels; // 2^levels
      const leaves = new Array(numLeaves).fill(BigInt(0));
      leaves[0] = commitment;

      // Build Merkle tree using the helper function
      function buildMerkleTree(leaves: bigint[], levels: number): {
        root: bigint;
        pathElements: bigint[][];
        pathIndices: number[][];
      } {
        const tree: bigint[][] = [leaves];
        const F = poseidon.F;

        // Build tree level by level
        for (let level = 0; level < levels; level++) {
          const currentLevel = tree[level];
          const nextLevel: bigint[] = [];

          for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i] || BigInt(0);
            const right = currentLevel[i + 1] || BigInt(0);
            const hash = poseidon([left, right]);
            nextLevel.push(F.toObject(hash));
          }

          tree.push(nextLevel);
        }

        const root = tree[levels][0];

        // Generate proofs for each leaf
        const pathElements: bigint[][] = [];
        const pathIndices: number[][] = [];

        for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
          const path: bigint[] = [];
          const indices: number[] = [];
          let index = leafIndex;

          for (let level = 0; level < levels; level++) {
            const isRight = index % 2;
            const siblingIndex = isRight ? index - 1 : index + 1;
            const sibling = tree[level][siblingIndex] || BigInt(0);

            path.push(sibling);
            indices.push(isRight);
            index = Math.floor(index / 2);
          }

          pathElements.push(path);
          pathIndices.push(indices);
        }

        return { root, pathElements, pathIndices };
      }

      const { root, pathElements, pathIndices } = buildMerkleTree(leaves, levels);

      // Prepare input
      const input = {
        root: root.toString(),
        nullifierHash: nullifierHash.toString(),
        recipient: addressToBigInt('xion1h26yyjht8ch5gg9kpxgcfrxvz0j30yp728zfq6'),
        relayer: addressToBigInt('0x0000000000000000000000000000000000000000'),
        fee: '0',
        refund: '0',
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        pathElements: pathElements[0].map(x => x.toString()),
        pathIndices: pathIndices[0],
      };

      // Export verification key
      const vkey = await snarkjs.zKey.exportVerificationKey(
        new Uint8Array(zkeyData)
      );

      // Generate proof
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmFile,
        zkeyFile
      );

      // Verify proof
      const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      expect(verified).toBe(true);

      // Save vkey, publicSignals, and proof to JSON file
      const outputData = {
        vkey,
        publicSignals,
        proof
      };
      writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
      console.log('Saved withdraw_small proof data to', outputPath);
    });
  });
});
