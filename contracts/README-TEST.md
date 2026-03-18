# Tornado Cash Contract Testing on Xion Testnet

This directory contains a comprehensive TypeScript test script for the Tornado Cash privacy contract deployed on Xion testnet.

## Overview

The test script demonstrates a complete privacy flow:

1. **Instantiate** the Tornado Cash contract with a fixed denomination
2. **Deposit** funds with a commitment (hash of secret + nullifier)
3. **Generate** a zero-knowledge proof of withdrawal
4. **Withdraw** funds using the ZK proof (without revealing which deposit)

## Prerequisites

1. **Wallet Setup**: You need a wallet with testnet funds
   - The script uses the SATYAM2 wallet address from `.env.local`
   - You must add your mnemonic to `.env.local`

2. **ZK Circuit Files**: The script requires compiled circuit files
   - WASM file: `../circom-circuits/wasm/withdraw_small.wasm`
   - ZKey file: `../circom-circuits/zkey/withdraw_small.zkey`

3. **Contract Code**: The contract must be uploaded to the testnet
   - Current CODE_ID: 2048 (from `.env.local`)

## Setup

1. Install dependencies:

```bash
cd /Users/satyam/web3/xion/zk-sudoku/contracts
npm install
# or
yarn install
```

2. Add your mnemonic to `.env.local`:

```bash
echo 'MNEMONIC="your twelve or twenty four word mnemonic phrase here"' >> .env.local
```

**⚠️ IMPORTANT**: Never commit your mnemonic to version control! Make sure `.env.local` is in your `.gitignore`.

3. Ensure you have testnet funds:

Visit the Xion testnet faucet to get test tokens if needed.

## Running the Test

```bash
npm run test:tornado
# or
yarn test:tornado
# or
ts-node test-tornado-cash.ts
```

## What the Script Does

### Step 1: Instantiate Contract

Deploys a new instance of the Tornado Cash contract with:
- Fixed denomination: 1,000,000 uxion (1 XION)
- Merkle tree levels: 10 (supports up to 1,024 deposits)

### Step 2: Make Deposit

1. Generates random nullifier and secret
2. Computes commitment = hash(nullifier, secret)
3. Deposits 1 XION with the commitment
4. Saves deposit data to `tornado-deposit.json`

### Step 3: Build Merkle Proof

1. Reconstructs the Merkle tree from on-chain data
2. Generates Merkle path for the deposit
3. Verifies the computed root matches on-chain root

### Step 4: Generate ZK Proof

Uses the ZK circuits to generate a proof that:
- Proves knowledge of the secret and nullifier
- Proves the commitment exists in the Merkle tree
- Does NOT reveal which deposit is being withdrawn

### Step 5: Withdraw Funds

1. Submits the ZK proof to the contract
2. Contract verifies the proof
3. Marks the nullifier as used (prevents double-spending)
4. Sends funds to the recipient address

## Privacy Guarantees

The ZK-SNARK proof ensures:

✅ **Anonymity**: No link between deposit and withdrawal addresses
✅ **Privacy**: The specific deposit being withdrawn is hidden
✅ **Security**: Only the holder of the secret can withdraw
✅ **No Double-Spend**: Each nullifier can only be used once

## Output Files

- `tornado-deposit.json`: Contains the deposit secrets (keep this safe!)
  - nullifier
  - secret
  - commitment
  - nullifierHash
  - contractAddress
  - denomination

## Troubleshooting

### "MNEMONIC not found"

Add your wallet mnemonic to `.env.local`:

```bash
MNEMONIC="your mnemonic words here"
```

### "Wallet has no balance"

Get testnet funds from the Xion faucet for your wallet address.

### "WASM or zkey files not found"

Build the circuits first:

```bash
cd ../circom-circuits
# Follow the circuit building instructions
```

### "Merkle roots do not match"

This usually means:
- The Merkle tree levels don't match the contract
- There are other deposits in the tree
- The commitment wasn't stored at the expected leaf index

## Technical Details

### Commitment Scheme

```
commitment = Poseidon(nullifier, secret)
nullifierHash = Poseidon(nullifier)
```

### Merkle Tree

- Hash function: Poseidon (ZK-friendly)
- Levels: 10 (configured in contract)
- Capacity: 2^10 = 1,024 deposits
- Empty leaves: Zero values

### ZK Circuit

- Public inputs: root, nullifierHash, recipient, relayer, fee, refund
- Private inputs: nullifier, secret, pathElements, pathIndices
- Proves: commitment is in the tree without revealing which leaf

## Security Notes

1. **Keep your secrets safe**: If someone gets your `tornado-deposit.json`, they can withdraw your funds
2. **Mnemonic security**: Never commit your mnemonic to version control
3. **Testnet only**: This is for testing purposes on testnet
4. **Gas fees**: Withdrawals require gas, which reduces anonymity if using the same wallet
5. **Relayers**: In production, use relayers to submit withdrawals for better privacy

## Contract Address

After running the test, the contract address will be printed and can be used for subsequent tests.

## Next Steps

1. Test with multiple deposits to see the anonymity set grow
2. Implement relayer functionality for better privacy
3. Test with different denominations
4. Deploy to mainnet (after thorough testing and audits)

## Resources

- [Tornado Cash whitepaper](https://tornado.cash/Tornado.cash_whitepaper_v1.4.pdf)
- [Circom documentation](https://docs.circom.io/)
- [snarkjs documentation](https://github.com/iden3/snarkjs)
- [Xion documentation](https://docs.burnt.com/)
