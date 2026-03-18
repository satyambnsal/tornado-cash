# XION Authentication Application

This application provides authentication and account management for XION. It can run both as a standalone dashboard or embedded as an iframe for SDK integration.

## Getting Started

### Installation

```bash
npm install
```

### Development

First, run the development server:

```bash
npm run dev
```

To develop against **mainnet-1** or **testnet-1** use the following url as `http://localhost:3000` is not allowed:

```
http://d09cc484f8.test.burnt.localhost:3000
```

### Environment Configuration

Create a `.env` file based on `.env.example`:

```env
# Stytch Configuration (REQUIRED)
VITE_STYTCH_PUBLIC_TOKEN=public-token-test-your-token-here

# Network Configuration
VITE_CHAIN_ID=xion-testnet-2
VITE_NETWORK=testnet-2

# XION API Configuration
VITE_XION_API_URL=https://api.xion-testnet-2.burnt.com
VITE_XION_RPC_URL=https://rpc.xion-testnet-2.burnt.com
VITE_XION_STYTCH_API=https://stytch.testnet.burnt.com/v1

# Account Abstraction API Configuration
VITE_ABSTRAXION_API_URL=https://aa-api.testnet.burnt.com

# Fee Granter Configuration
VITE_FEE_GRANTER_ADDRESS=xion1xrqz2wpt4rw8rtdvrc4n4yn5h54jm0nn4evn2x

# Feature Flags
VITE_OKX_FLAG=true
VITE_METAMASK_FLAG=true
VITE_PASSKEY_FLAG=true
VITE_KEPLR_FLAG=false
VITE_APPLE_FLAG=true
```

## Deployment

### Build for Mainnet

To deploy mainnet, run the following commands:

```bash
npm run build:mainnet
npm run deploy:mainnet
```

### Build for Testnet

```bash
npm run build:testnet
npm run deploy:testnet
```

### Environment Files

The build scripts (`build:mainnet`, `build:testnet`, `build:testnet2`) will fail if a `.env` file is present in the directory. This is by design to ensure that environment-specific builds use the correct environment configuration files (`.env.mainnet`, `.env.testnet`, `.env.testnet2`) and are not affected by a local development `.env` file.

If you encounter an error during the build process, make sure to remove any `.env` file before running the build commands.

## Project Structure

```
src/
├── auth/              # Authentication logic
│   ├── hooks/        # Auth hooks (useAuthTypes, etc.)
│   ├── lib/          # Auth utilities
│   └── utils/        # Helper functions
├── components/        # React components
│   ├── ModalViews/   # Modal components
│   │   ├── AddAuthenticators/
│   │   └── RemoveAuthenticator/
│   ├── AccountInfo.tsx
│   ├── AuthenticatorsList.tsx
│   └── ui/           # UI components
├── hooks/             # React hooks
│   ├── useAbstraxionSigningClient.ts
│   ├── useAccountBalance.ts
│   └── useContractFeatures.ts
├── indexer-strategies/ # Chain indexing strategies
├── messaging/         # MessageChannel communication (iframe mode)
│   ├── types.ts      # Message type definitions
│   ├── channel.ts    # Response utilities
│   └── handler.ts    # Message router
├── signers/          # Transaction signing
├── styles/           # CSS
├── types/            # TypeScript types
├── utils/            # Utilities
├── IframeApp.tsx     # Iframe mode entry
└── main.tsx          # Standalone mode entry
```

## Features

### Standalone Mode

- 🏠 **Dashboard Interface**: Full account management UI
- 👤 **Account Overview**: View balances, authenticators, and account details
- 🔐 **Multi-Auth Support**: Email, SMS, OAuth, WebAuthn, Passkeys, Web3 wallets
- ➕ **Add Authenticators**: Add multiple authentication methods to your account
- ➖ **Remove Authenticators**: Manage and remove authenticators
- 💰 **Balance Display**: View token balances and USD values
- 🌐 **Network Support**: Mainnet and testnet configurations

### Iframe Mode

- 🔒 **Secure Isolation**: Runs in cross-origin iframe, JWTs never leave this context
- 💬 **MessageChannel Communication**: Type-safe communication with parent SDK
- 🎯 **Transaction Signing**: Sign transactions with user approval
- ⚡ **Session Persistence**: Remembers user sessions across page reloads
- 🎨 **Modal UI**: Clean overlay interface that appears only when needed

## Authentication Methods

### Supported Authenticators

1. **JWT (Email/OAuth)**
   - Email OTP
   - Google OAuth
   - Apple Sign In
   - GitHub OAuth
   - Twitter OAuth

2. **Web3 Wallets**
   - Ethereum wallets (MetaMask)
   - Cosmos wallets (Keplr)
   - OKX Wallet

3. **Passkeys**
   - WebAuthn passkeys
   - Biometric authentication

### Adding Authenticators

Users can add multiple authenticators to their account through the "Add Authenticator" modal. The app validates:

- No duplicate authenticators
- Proper signature verification
- Available authenticator indices

### Removing Authenticators

Users can remove authenticators (except the last one) through the "Remove Authenticator" modal.

## API Integration

### Account Abstraction API

The app integrates with the AA-API for:

- Authenticator type resolution (`/api/v1/jwt-accounts/authenticator-types`)
- Session authentication without creating users (`/api/v1/sessions/authenticate-no-session`)
- OAuth authentication (`/api/v1/sessions/authenticate-oauth-no-session`)

### Fee Grants

The app checks for fee grants to enable gasless transactions for users. Configure the fee granter address in the environment variables.

## Iframe Integration

### Message Flow

```
Parent App (SDK)          Iframe (This App)
      |                         |
      |-- CONNECT ------------→ |
      |                         |-- Show AuthModal
      |                         |-- User authenticates
      |                         |-- Store JWT (isolated)
      |←-- {address} -----------|
      |                         |
      |-- SIGN_TRANSACTION ---→ |
      |                         |-- Show SigningModal
      |                         |-- User approves
      |                         |-- Sign with JWT
      |←-- {signedTx} ----------|
```

### Security Model

- **JWT Storage**: Session JWTs stored in iframe's localStorage only
- **Cross-Origin**: Iframe hosted on different domain from parent app
- **MessageChannel**: Each request uses isolated MessageChannel for communication
- **User Consent**: Every sensitive action requires explicit user approval via UI

### Message Types

#### CONNECT

Request user authentication.

**Response:**

```typescript
{
  address: string;
  balance?: string;
}
```

#### SIGN_TRANSACTION

Request transaction signing.

**Payload:**

```typescript
{
  transaction: {
    messages: Array<{ typeUrl: string; value: any }>;
    fee: { amount: Coin[]; gas: string };
    memo?: string;
  }
}
```

**Response:**

```typescript
{
  signedTx: SignedTransaction;
}
```

#### GET_ADDRESS

Get current authenticated address.

**Response:**

```typescript
{
  address: string | null;
}
```

#### DISCONNECT

Clear session and disconnect.

**Response:**

```typescript
{
}
```

### Testing Iframe Mode Locally

1. Start development server: `npm run dev` (port 3000)
2. The app will run in standalone mode by default
3. Access iframe mode at: `http://localhost:3000/iframe`
4. Integrate with SDK using iframe URL

### Deploying Iframe

1. Build the application: `npm run build:testnet` or `npm run build:mainnet`
2. Deploy to your hosting service (Cloudflare Pages, Vercel, Netlify, etc.)
3. Configure CORS to allow iframe embedding:
   ```
   Access-Control-Allow-Origin: *
   X-Frame-Options: ALLOWALL
   ```
4. Update SDK configuration with your deployed URL:
   ```typescript
   const sdk = new XionSDK({
     iframeUrl: 'https://your-iframe.your-domain.com/iframe',
     ...
   });
   ```

## Security Considerations

### Best Practices

✅ **Always use HTTPS** in production
✅ **Deploy iframe on separate domain** for maximum isolation
✅ **Validate message origins** (already implemented)
✅ **Never expose JWTs** to parent window
✅ **Require user consent** for all sensitive actions
✅ **Use fee grants** to enable gasless transactions

### What's Protected

- Session JWTs and tokens
- User credentials and passwords
- Stytch client instance
- Authentication state
- Private keys (never exposed)

### What's Exposed

- XION address (public information)
- Transaction signing capability (with user approval)
- Authentication status (connected/disconnected)
- Account balances (public blockchain data)

## Troubleshooting

### Build Errors

**Problem**: Build fails with environment variable errors
**Solution**: Remove `.env` file before running build commands. Use environment-specific files (`.env.mainnet`, `.env.testnet`, etc.)

### Authentication Issues

**Problem**: OTP/OAuth not working
**Solution**:

- Verify `VITE_STYTCH_PUBLIC_TOKEN` is correct
- Check that AA-API endpoint is accessible
- Ensure network configuration matches (testnet vs mainnet)

### Iframe Not Loading

**Problem**: Iframe not showing in parent app
**Solution**:

- Check that SDK is initializing iframe correctly
- Verify iframe URL is accessible
- Check browser console for CORS errors
- Ensure iframe URL includes `/iframe` path

### Fee Grant Errors

**Problem**: Fee grant validation failing
**Solution**:

- Verify `VITE_FEE_GRANTER_ADDRESS` is correct for your network
- Check that fee grant exists on-chain for the user's address
- Ensure REST endpoint is accessible

## Contributing

When adding new features:

1. Follow existing patterns
2. Add TypeScript types
3. Test in both standalone and iframe modes
4. Update documentation
5. Test with both testnet and mainnet configurations

## License

MIT
