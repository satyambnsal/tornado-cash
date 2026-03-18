/**
 * Merkle tree utilities for Tornado Cash
 * Builds sparse Merkle trees and generates proofs for zero-knowledge circuits
 */

import { buildPoseidon } from "circomlibjs";
import type { MerkleTree, MerkleProof } from "../types/tornado";

// Cache the Poseidon instance
let poseidonInstance: any = null;
let poseidonField: any = null;

/**
 * Initialize Poseidon hash function
 */
async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
    poseidonField = poseidonInstance.F;
  }
  return { poseidon: poseidonInstance, F: poseidonField };
}

/**
 * Hash two values using Poseidon (matching circuit implementation)
 */
function hashPoseidonPair(poseidon: any, F: any, left: bigint, right: bigint): bigint {
  // Use Poseidon hash with 2 inputs (matching circuit's HashLeftRight template)
  const hash = poseidon([left, right]);
  return F.toObject(hash);
}

/**
 * Build a sparse Merkle tree from leaves
 * Empty leaves are filled with zeros
 *
 * @param leaves - Array of leaf values (commitments as BigInt)
 * @param levels - Merkle tree depth
 * @returns Merkle tree with root and proofs
 */
export async function buildMerkleTree(
  leaves: bigint[],
  levels: number
): Promise<MerkleTree> {
  const { poseidon, F } = await getPoseidon();
  const tree: bigint[][] = [leaves];

  // Build tree level by level using Poseidon (matching circuit implementation)
  for (let level = 0; level < levels; level++) {
    const currentLevel = tree[level];
    const nextLevel: bigint[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i] || BigInt(0);
      const right = currentLevel[i + 1] || BigInt(0);
      const hash = hashPoseidonPair(poseidon, F, left, right);
      nextLevel.push(hash);
    }

    tree.push(nextLevel);
  }

  const root = tree[levels][0];

  // Generate proofs for each leaf
  const pathElements: bigint[][] = [];
  const pathIndices: number[][] = [];

  for (let leafIdx = 0; leafIdx < leaves.length; leafIdx++) {
    const path: bigint[] = [];
    const indices: number[] = [];
    let index = leafIdx;

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

/**
 * Generate Merkle proof for a specific leaf index
 * @param tree - Full Merkle tree
 * @param leafIndex - Index of the leaf to generate proof for
 * @returns Merkle proof with path elements and indices
 */
export function getMerkleProof(
  tree: MerkleTree,
  leafIndex: number
): MerkleProof {
  if (leafIndex >= tree.pathElements.length) {
    throw new Error(`Invalid leaf index: ${leafIndex}`);
  }

  return {
    root: tree.root,
    pathElements: tree.pathElements[leafIndex],
    pathIndices: tree.pathIndices[leafIndex],
  };
}

/**
 * Verify a Merkle proof (requires Poseidon hash)
 * @param proof - Merkle proof to verify
 * @param leaf - Leaf value (commitment)
 * @returns True if proof is valid
 */
export function verifyMerkleProof(
  proof: MerkleProof,
  leaf: bigint
): boolean {
  // This requires Poseidon hash implementation
  throw new Error('verifyMerkleProof requires Poseidon hash implementation');
}

/**
 * Build sparse Merkle tree for withdrawal
 * Builds a full Merkle tree with the commitment at the specified leaf index
 * and all other leaves as zero, then extracts the proof path.
 *
 * @param commitment - Our commitment value
 * @param leafIndex - Index where our commitment is located
 * @param levels - Tree depth
 * @returns Root, path elements and indices for the proof
 */
export async function buildSparseTreeProof(
  commitment: bigint,
  leafIndex: number,
  levels: number
): Promise<{
  root: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}> {
  const numLeaves = 1 << levels; // 2^levels

  // Build array of leaves with commitment at the correct index
  const leaves = new Array(numLeaves).fill(BigInt(0));
  leaves[leafIndex] = commitment;

  // Build full Merkle tree
  const tree = await buildMerkleTree(leaves, levels);

  // Extract proof for our commitment
  return {
    root: tree.root,
    pathElements: tree.pathElements[leafIndex],
    pathIndices: tree.pathIndices[leafIndex],
  };
}

/**
 * Calculate the number of leaves in a tree of given depth
 * @param levels - Tree depth
 * @returns Number of leaves (2^levels)
 */
export function getTreeSize(levels: number): number {
  return 1 << levels; // 2^levels
}

/**
 * Validate leaf index is within tree bounds
 * @param leafIndex - Leaf index to validate
 * @param levels - Tree depth
 * @returns True if valid
 */
export function isValidLeafIndex(leafIndex: number, levels: number): boolean {
  const maxIndex = getTreeSize(levels) - 1;
  return leafIndex >= 0 && leafIndex <= maxIndex;
}
