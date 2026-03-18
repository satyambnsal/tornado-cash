# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Abstraxion Dashboard is a React/TypeScript web application for the XION blockchain ecosystem, providing wallet management and authentication features.

## Essential Commands

### Development

```bash
npm run dev                # Run dev server on port 3000
npm run dev:mobile        # Run dev server with host access for mobile testing
```

**Important**: For local development, use this specific URL: `http://d09cc484f8.test.burnt.localhost:3000`

### Building

```bash
npm run build             # Standard build
npm run build:mainnet    # Build for mainnet (enforces no .env file)
npm run build:testnet    # Build for testnet (enforces no .env file)
```

### Code Quality

```bash
npm run lint             # Run ESLint
npm run check-types      # TypeScript type checking
npm run format:check     # Check code formatting
npm run format:fix       # Fix code formatting
```

### Testing

```bash
npm run test             # Run tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

### Deployment

Deployments are tag-driven from `main`. See [DEPLOYMENT.md](DEPLOYMENT.md) for full details.

```bash
npm run deploy:mainnet   # Deploy to mainnet via Cloudflare
npm run deploy:testnet   # Deploy to testnet via Cloudflare
```

## Architecture Overview

### Core Technologies

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite with Node.js polyfills
- **Styling**: Tailwind CSS with "ui-" prefix for all classes
- **State Management**: React Context API + TanStack Query
- **Blockchain**: CosmJS for Cosmos SDK interaction
- **Authentication**: Stytch for social logins (Google, TikTok)
- **Deployment**: Cloudflare Workers via Wrangler

### Project Structure

```
src/
├── components/
│   ├── Abstraxion*/      # Core wallet/auth components
│   ├── ui/               # Reusable UI components with detailed docs
│   └── [feature]/        # Feature-specific components
├── hooks/                # Custom React hooks
├── signers/              # Blockchain signing implementations
├── config/               # Configuration files
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
└── tests/                # Test files
```

### Key Abstraxion Components

- **AbstraxionContext**: Main context provider for wallet state
- **AbstraxionSignin**: Authentication flow component
- **AbstraxionWallets**: Multi-wallet connection (Keplr, MetaMask, OKX)
- **AbstraxionGrant**: Permission grant management
- **AbstraxionMigrate**: Account migration utilities

### Environment & Configuration

- **Always use `src/config/index.ts` exports** (e.g. `CHAIN_ID`, `RPC_URL`, `NETWORK`) instead of reading `import.meta.env` directly in application or test code.
- `src/config/index.ts` reads env vars internally and applies defaults from `src/config/mainnet.ts` / `src/config/testnet.ts`, so consuming code never needs to reference `import.meta.env.VITE_*`.
- `.env` files (`.env.mainnet`, `.env.testnet`) are for **local development overrides only**. Deployment values live in the config files.
- Build scripts enforce no `.env` file in production builds.
- In tests, mock config values via `vi.mock("../../config", ...)` rather than setting `import.meta.env` directly.

### Development Patterns

1. **Imports**: Use absolute imports with `@/` alias for src directory
2. **UI Components**: Follow existing patterns in `src/components/ui/`
3. **Tailwind**: Always use "ui-" prefix for CSS classes
4. **Type Safety**: Strict TypeScript enforcement
5. **Testing**: Tests co-located with components, 99% coverage threshold
6. **Form inputs**: All non-password inputs (email, OTP, etc.) must suppress password managers with `autoComplete="off"` (or `"one-time-code"` for OTP), `data-1p-ignore`, `data-lpignore="true"`, and `data-form-type="other"`. OTP/numeric inputs must also set `inputMode="numeric"` for mobile keyboards.

### Testing Approach

- Framework: Vitest with React Testing Library
- Setup file: `src/test/setup.ts`
- Pattern: `*.test.ts` or `*.spec.ts` files
- Coverage thresholds: 99% for lines, functions, branches, statements

### Blockchain Integration

- Smart accounts on XION network
- Multi-chain wallet support
- Asset management (send/receive tokens)
- Grant permissions for contracts and bank operations
- Custom signers in `src/signers/` directory

### Important Notes

- The dashboard handles both mainnet and testnet deployments
- Social authentication via Stytch requires proper configuration
- Wallet connections support multiple providers simultaneously
- UI components have comprehensive documentation in markdown files
