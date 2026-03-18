import { buildPoseidon } from 'circomlibjs';
import crypto from 'crypto';

let poseidon: any;

export async function initPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

/**
 * Generate a random field element (31 bytes to stay within BN254 field)
 */
export function randomBigInt(): bigint {
  return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
}

/**
 * Generate commitment and nullifier hash from nullifier and secret
 */
export async function generateCommitment(
  nullifier: bigint,
  secret: bigint
): Promise<{ commitment: bigint; nullifierHash: bigint }> {
  const p = await initPoseidon();
  const commitment = p([nullifier, secret]);
  const nullifierHash = p([nullifier]);

  return {
    commitment: p.F.toObject(commitment),
    nullifierHash: p.F.toObject(nullifierHash),
  };
}

/**
 * Create a deposit note containing nullifier and secret
 */
export async function createDeposit(): Promise<{
  nullifier: bigint;
  secret: bigint;
  commitment: bigint;
  nullifierHash: bigint;
  note: string;
}> {
  const nullifier = randomBigInt();
  const secret = randomBigInt();
  const { commitment, nullifierHash } = await generateCommitment(nullifier, secret);

  // Create note string (for user to save)
  const note = `tornado-${nullifier.toString(16)}-${secret.toString(16)}`;

  return {
    nullifier,
    secret,
    commitment,
    nullifierHash,
    note,
  };
}

/**
 * Parse a note string back into nullifier and secret
 */
export function parseNote(note: string): { nullifier: bigint; secret: bigint } {
  const parts = note.split('-');
  if (parts.length !== 3 || parts[0] !== 'tornado') {
    throw new Error('Invalid note format');
  }

  return {
    nullifier: BigInt('0x' + parts[1]),
    secret: BigInt('0x' + parts[2]),
  };
}

/**
 * Merkle tree implementation for commitments
 */
export class MerkleTree {
  private levels: number;
  private tree: bigint[][];
  private poseidon: any;

  constructor(levels: number, leaves: bigint[] = []) {
    this.levels = levels;
    this.tree = [leaves];
  }

  async init() {
    this.poseidon = await initPoseidon();
    await this.build();
  }

  private async build() {
    const maxLeaves = 1 << this.levels;

    // Pad leaves with zeros
    while (this.tree[0].length < maxLeaves) {
      this.tree[0].push(BigInt(0));
    }

    // Build tree level by level
    for (let level = 0; level < this.levels; level++) {
      const currentLevel = this.tree[level];
      const nextLevel: bigint[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        const hash = this.poseidon([left, right]);
        nextLevel.push(this.poseidon.F.toObject(hash));
      }

      this.tree.push(nextLevel);
    }
  }

  getRoot(): bigint {
    return this.tree[this.levels][0];
  }

  async insert(leaf: bigint): Promise<number> {
    // Find first zero position
    const index = this.tree[0].findIndex(l => l === BigInt(0));
    if (index === -1) {
      throw new Error('Tree is full');
    }

    this.tree[0][index] = leaf;
    await this.updatePath(index);
    return index;
  }

  private async updatePath(leafIndex: number) {
    let index = leafIndex;
    for (let level = 0; level < this.levels; level++) {
      const isRight = index % 2;
      const siblingIndex = isRight ? index - 1 : index + 1;
      const left = this.tree[level][isRight ? siblingIndex : index];
      const right = this.tree[level][isRight ? index : siblingIndex];

      const parentIndex = Math.floor(index / 2);
      const hash = this.poseidon([left, right]);
      this.tree[level + 1][parentIndex] = this.poseidon.F.toObject(hash);

      index = parentIndex;
    }
  }

  getProof(leafIndex: number): { pathElements: bigint[]; pathIndices: number[] } {
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let index = leafIndex;

    for (let level = 0; level < this.levels; level++) {
      const isRight = index % 2;
      const siblingIndex = isRight ? index - 1 : index + 1;
      const sibling = this.tree[level][siblingIndex] || BigInt(0);

      pathElements.push(sibling);
      pathIndices.push(isRight);
      index = Math.floor(index / 2);
    }

    return { pathElements, pathIndices };
  }

  verify(leaf: bigint, proof: { pathElements: bigint[]; pathIndices: number[] }): boolean {
    let hash = leaf;

    for (let i = 0; i < this.levels; i++) {
      const isRight = proof.pathIndices[i];
      const left = isRight ? proof.pathElements[i] : hash;
      const right = isRight ? hash : proof.pathElements[i];
      hash = this.poseidon.F.toObject(this.poseidon([left, right]));
    }

    return hash === this.getRoot();
  }
}

/**
 * Generate withdrawal proof inputs
 */
export async function generateWithdrawInput(
  note: string,
  merkleTree: MerkleTree,
  recipient: string,
  relayer: string = '0x0000000000000000000000000000000000000000',
  fee: bigint = BigInt(0),
  refund: bigint = BigInt(0)
): Promise<any> {
  const { nullifier, secret } = parseNote(note);
  const { commitment, nullifierHash } = await generateCommitment(nullifier, secret);

  // Find commitment in tree
  const leafIndex = merkleTree['tree'][0].findIndex((l: bigint) => l === commitment);
  if (leafIndex === -1) {
    throw new Error('Commitment not found in tree');
  }

  const { pathElements, pathIndices } = merkleTree.getProof(leafIndex);
  const root = merkleTree.getRoot();

  return {
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    recipient,
    relayer,
    fee: fee.toString(),
    refund: refund.toString(),
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    pathElements: pathElements.map(x => x.toString()),
    pathIndices,
  };
}

/**
 * Convert address string to bigint (for circuit inputs)
 */
export function addressToBigInt(address: string): bigint {
  // Remove 0x prefix if present
  const hex = address.startsWith('0x') ? address.slice(2) : address;
  return BigInt('0x' + hex);
}

/**
 * Format bigint to hex address
 */
export function bigIntToAddress(value: bigint): string {
  return '0x' + value.toString(16).padStart(40, '0');
}
