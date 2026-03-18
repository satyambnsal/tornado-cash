# Tornado Cash Frontend

Privacy mixer interface for XION blockchain, enabling anonymous deposits and withdrawals using zero-knowledge proofs.

## Features

✅ **Privacy-First Design**: Deposit and withdraw funds with complete anonymity
✅ **Zero-Knowledge Proofs**: All proofs generated server-side (no WASM/zkey in browser)
✅ **XION Account Abstraction**: Support for email, passkey, Keplr, MetaMask, and OKX wallet authentication
✅ **Simple Black & White Theme**: Clean, minimalist interface
✅ **Transaction History**: Track deposits and withdrawals (metadata only, no secrets stored)
✅ **Secure Note Management**: Copy/download deposit notes with prominent security warnings

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
pnpm install
```

### 2. Configure Environment

Update `.env.local` with your Tornado Cash contract details:

```bash
# Proof server URL (backend for ZK proof generation)
VITE_PROOF_SERVER_URL=http://3.213.0.115:3016

# Your deployed Tornado Cash contract address
VITE_CONTRACT_ADDRESS=xion1w5mkgd0npxuynm07mx75hwxcg4ghf9an8w3lrhzvuajqjleqlrnsm7s47d

# Deposit denomination (0.1 XION = 100000 uxion)
VITE_DENOMINATION=100000

# Merkle tree depth
VITE_MERKLE_TREE_LEVELS=10
```

### 3. Run Development Server

```bash
pnpm dev
```

Access the app at `http://localhost:3000`

## How It Works

### Deposit Flow

1. **Connect Account**: Login via XION AA (email, passkey, or wallet)
2. **Generate Note**: Click deposit → random nullifier & secret generated client-side
3. **Compute Commitment**: Proof server computes Poseidon hash commitment
4. **Execute Deposit**: Transaction sends commitment to contract with denomination amount
5. **Save Note**: Display nullifier, secret, commitment with copy/download buttons
6. **Store Metadata**: Only tx hash, amount, timestamp saved (NO SECRETS)

### Withdrawal Flow

1. **Load Note**: Paste or upload JSON note from deposit
2. **Validate**: Check nullifier not already used, verify contract/denomination match
3. **Enter Recipient**: Specify withdrawal address (different from deposit for privacy)
4. **Build Proof**:
   - Query contract for Merkle root
   - Build sparse Merkle tree proof (zero-filled except commitment)
   - Call proof server to generate withdrawal proof (10-30s)
5. **Execute Withdrawal**: Submit proof to contract, funds sent to recipient
6. **Clear Note**: Note data cleared from UI for privacy

## Architecture

### Components

```
TornadoCashApp (Main)
├── Header (Contract info, account, balance)
├── DepositTab
│   ├── DepositForm (Generate & deposit)
│   └── DepositNoteDisplay (Show note with copy buttons)
├── WithdrawTab
│   ├── NoteInput (Paste or upload note)
│   ├── WithdrawalProgress (5-step progress indicator)
│   └── Withdrawal form (Recipient input, execute)
└── TransactionHistory (Past deposits/withdrawals)
```

### Services

- **proofServer.ts**: API client for proof generation
  - `POST /compute/commitment` - Generate commitment & nullifier hash
  - `POST /generate-proof/withdraw` - Generate ZK withdrawal proof
  - Retry logic with exponential backoff

- **tornadoContract.ts**: Smart contract interactions via AAClient
  - `deposit(commitment, amount)` - Make deposit
  - `withdraw(proof, publicInputs, ...)` - Withdraw with ZK proof
  - `getConfig()`, `getMerkleRoot()`, `isNullifierUsed()`

### Utilities

- **crypto.ts**: Client-side random generation, address conversion
  - `generateRandomFieldElement()` - 31-byte secure random for nullifier/secret
  - `addressToBigInt()` - Convert bech32/hex addresses to circuit-compatible BigInts

- **merkleTree.ts**: Sparse Merkle tree for withdrawal proofs
  - `buildSparseTreeProof()` - Generate pathElements & pathIndices

- **noteFormat.ts**: Note parsing, validation, download
  - `createNote()`, `parseNoteFromJSON()`, `downloadNote()`
  - `validateNote()` - Comprehensive validation

## Security Considerations

### Privacy

✅ **Secrets Generated Client-Side**: Nullifier & secret use Web Crypto API
✅ **No Automatic Storage**: Notes displayed once, user must save manually
✅ **Session Storage Only**: Current deposit note cleared on tab close
✅ **Metadata-Only History**: TX hash, amount, timestamp (NO SECRETS)

⚠️ **User Responsibilities**:
- Save deposit note securely (offline storage recommended)
- Use different withdrawal address for maximum privacy
- Clear browser history after use

### Trust Model

**Proof Server**: Must trust for proof generation (knows secrets during proof gen)
- Mitigation: Server URL configurable, users can run their own
- Future: Add client-side proof generation option

**XION AA**: Uses Stytch for email/social login (trusted third party)
- Alternative: Users can use Keplr/MetaMask for trustless auth

### Network Privacy

❌ Frontend does not provide IP anonymity (recommend Tor/VPN)
❌ XION AA may link identity if using email (recommend passkey or wallet)

## Development

### Project Structure

```
frontend/src/
├── components/
│   ├── TornadoCashApp.tsx          # Main app with tab navigation
│   ├── Header.tsx                   # Contract info & account display
│   ├── DepositTab/
│   │   ├── index.tsx                # Deposit interface
│   │   └── DepositNoteDisplay.tsx   # Note display with copy buttons
│   ├── WithdrawTab/
│   │   ├── index.tsx                # Withdrawal interface
│   │   ├── NoteInput.tsx            # Note input/upload
│   │   └── WithdrawalProgress.tsx   # Progress indicator
│   ├── TransactionHistory/          # Transaction list
│   └── ui/                          # Reusable UI components (from boilerplate)
├── services/
│   ├── proofServer.ts               # Proof server API client
│   └── tornadoContract.ts           # Contract interaction service
├── utils/
│   ├── crypto.ts                    # Random generation, address conversion
│   ├── merkleTree.ts                # Merkle tree builder
│   └── noteFormat.ts                # Note parsing/formatting
├── context/
│   └── TornadoContext.tsx           # Tornado state management
├── types/
│   └── tornado.ts                   # TypeScript types
├── config/
│   └── index.ts                     # Environment configuration
└── index.css                        # Black & white theme

```

### Testing

**Manual Testing Checklist**:
- [ ] Connect with email/passkey/Keplr/MetaMask
- [ ] Deposit with sufficient balance
- [ ] Copy all note values individually
- [ ] Download note as JSON
- [ ] Upload note JSON for withdrawal
- [ ] Withdraw to same address
- [ ] Withdraw to different address (privacy test)
- [ ] Error: Insufficient balance
- [ ] Error: Invalid note format
- [ ] Error: Already-used note
- [ ] Transaction history shows correct metadata
- [ ] Proof server status indicator

### Building for Production

```bash
# Build for testnet
pnpm run build:testnet

# Build for mainnet
pnpm run build:mainnet
```

### Deployment

The app is a static SPA that can be deployed to:
- Vercel
- Netlify
- Cloudflare Pages (already configured with wrangler)
- Any static hosting service

**Requirements**:
- HTTPS (required for Web Crypto API)
- Configure proof server CORS to allow frontend domain

## Troubleshooting

### "Contract not initialized"
- Ensure contract address is set in `.env.local`
- Check that contract is deployed on the correct network
- Verify RPC URL is accessible

### "Proof generation failed"
- Check proof server is running and accessible
- Verify proof server URL in `.env.local`
- Network timeout? Proof generation takes 10-30s

### "Nullifier already used"
- Each deposit note can only be withdrawn once
- This note has already been used for withdrawal
- Use a different note or make a new deposit

### Balance not updating
- Refresh the page to reload balance
- Check wallet connection is still active
- Verify transaction succeeded on block explorer

## Next Steps

1. **Deploy contract** to XION testnet/mainnet
2. **Update .env.local** with contract address
3. **Start proof server** (see `/proof-server` directory)
4. **Test deposit flow** with a small amount
5. **Test withdrawal flow** to verify end-to-end functionality
6. **Deploy frontend** to production hosting

## Resources

- [XION Documentation](https://docs.xion.burnt.com/)
- [Tornado Cash Original](https://tornado.cash/)
- [Zero-Knowledge Proofs](https://z.cash/technology/zksnarks/)
- [Circom Circuits](https://docs.circom.io/)

## License

MIT
