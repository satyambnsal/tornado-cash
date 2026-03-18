# Tornado Cash

# Circom Circuits for XION

A collection of zero-knowledge circuits built with [Circom](https://docs.circom.io/) for XION blockchain applications.

```bash
 # Start the server with PM2
  pm2 start ecosystem.config.js
```

## Available Circuits

### Sudoku

A zero-knowledge Sudoku proof circuit that allows a prover to demonstrate they know a valid solution to a Sudoku puzzle without revealing the solution itself.

**Circuit Location:** `circuits/sudoku/sudoku.circom`

**How it works:**

- **Public Input:** The Sudoku puzzle (0 for empty cells, 1-9 for given numbers)
- **Private Input:** The complete solution (all cells filled with 1-9)
- **Output:** `isValid` - 1 if solution is valid, 0 otherwise

**Verification checks:**

1. All solution cells are in range [1, 9]
2. Solution matches the puzzle where puzzle has non-zero values
3. Each row contains numbers 1-9 (no duplicates)
4. Each column contains numbers 1-9 (no duplicates)
5. Each 3x3 subgrid contains numbers 1-9 (no duplicates)

## Quick Start

### Prerequisites

```bash
# Install dependencies
yarn install

# Ensure circom is installed (version 2.0.0+)
circom --version
```

### Compile Circuits

Compile all circuits:

```bash
yarn compile
```

Compile only the Sudoku circuit:

```bash
yarn compile:sudoku
```

### Run Tests

Run all tests:

```bash
yarn test
```

Run Sudoku-specific tests:

```bash
yarn test:sudoku
```

extract data from circuit artifacts

```bash
npx ts-node scripts/extract_proof_data.ts cache/sudoku_proof_data.json
```

VKEY ID: 6
VKEY name: sudoku

## Circuit Details

### Sudoku Circuit Architecture

The Sudoku circuit uses the following templates:

- **`RangeCheck(max)`** - Validates a value is within range [1, max]
- **`AllInRange(n, max)`** - Validates all values in an array are in range
- **`ContainsOneToNine(n)`** - Validates an array contains each number 1-9 exactly once (using sum=45 and product=362880 constraints)
- **`MatchesPuzzle()`** - Validates solution matches puzzle where puzzle is non-zero
- **`Sudoku()`** - Main template combining all validations

## Project Structure

```
circuits/
├── sudoku/           # Sudoku verification circuit
├── shuffle_encrypt/  # Card shuffle & encryption circuits
├── decrypt/          # Decryption circuits
└── common/           # Shared utilities (matrix, permutation, etc.)

tests/                # Test files
utils/                # Build scripts and utilities
wasm/                 # Compiled WASM files (generated)
zkey/                 # Proving/verification keys (generated)
```

## Available Scripts

| Script                | Description                           |
| --------------------- | ------------------------------------- |
| `yarn build`          | Compile TypeScript                    |
| `yarn compile`        | Build all circuits with trusted setup |
| `yarn compile:sudoku` | Compile only Sudoku circuit           |
| `yarn test`           | Run all tests                         |
| `yarn test:sudoku`    | Run Sudoku tests                      |
| `yarn checksum`       | Generate circuit checksums            |

## License

MIT
