/**
 * Merkle tree utilities for Tornado Cash
 * Builds sparse Merkle trees and generates proofs for zero-knowledge circuits
 */

import type { MerkleTree, MerkleProof } from "../types/tornado";

/**
 * Build a sparse Merkle tree from leaves
 * Empty leaves are filled with zeros
 *
 * Note: Poseidon hashing is done by the proof server, so we build the tree structure
 * but send leaves to the server for actual hash computation.
 *
 * This is a placeholder - the actual tree building with Poseidon hashes
 * will be done by calling the proof server or using circomlibjs if we add it.
 *
 * @param leaves - Array of leaf values (commitments as BigInt)
 * @param levels - Merkle tree depth
 * @returns Merkle tree with root and proofs
 */
export function buildMerkleTree(
  leaves: bigint[],
  levels: number
): MerkleTree {
  // This is a simplified version - in practice, we need to use Poseidon hash
  // The actual implementation will call the proof server or use circomlibjs
  throw new Error('buildMerkleTree requires Poseidon hash implementation. Use proof server instead.');
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
 * In practice, this is simplified - we just need to know the structure
 * The actual tree building with Poseidon hashing is done server-side or via circomlibjs
 *
 * For now, we'll use a simplified approach where we query the contract for the root
 * and build a zero-filled tree except for our commitment.
 *
 * @param commitment - Our commitment value
 * @param leafIndex - Index where our commitment is located
 * @param levels - Tree depth
 * @returns Path elements and indices for the proof
 */
export function buildSparseTreeProof(
  commitment: bigint,
  leafIndex: number,
  levels: number
): {
  pathElements: bigint[];
  pathIndices: number[];
} {
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];

  let index = leafIndex;

  // Build proof path by traversing up the tree
  for (let level = 0; level < levels; level++) {
    const isRight = index % 2;
    const siblingIndex = isRight ? index - 1 : index + 1;

    // Sibling is always zero in sparse tree (except for our leaf)
    pathElements.push(BigInt(0));
    pathIndices.push(isRight);

    index = Math.floor(index / 2);
  }

  return { pathElements, pathIndices };
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
