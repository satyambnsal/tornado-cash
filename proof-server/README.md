# Tornado Cash Proof Server

Server-side proof generation for Tornado Cash privacy protocol. This server handles the computationally intensive zero-knowledge proof generation, keeping WASM and zkey circuit files secure on the backend.

## Features

- Generate withdrawal proofs with ZK-SNARKs
- Generate commitment proofs
- Compute Poseidon hashes for commitments and nullifiers
- RESTful API with CORS support
- Circuit file validation
- Error handling and logging

## Prerequisites

- Node.js 18+
- npm or yarn
- Compiled circuit files (WASM and zkey) in `../circom-circuits/`

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` to configure:

```
PORT=3001
NODE_ENV=development
```

## Usage

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3001` (or your configured PORT).

## API Endpoints

### Health Check

```bash
GET /health
```

Returns server status and available circuits.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "availableCircuits": ["withdraw_small", "commitment"]
}
```

### Get Available Circuits

```bash
GET /circuits
```

Returns list of available circuits and their file status.

**Response:**
```json
{
  "circuits": [
    {
      "name": "withdraw_small",
      "wasmExists": true,
      "zkeyExists": true
    },
    {
      "name": "commitment",
      "wasmExists": true,
      "zkeyExists": true
    }
  ]
}
```

### Generate Withdrawal Proof

```bash
POST /generate-proof/withdraw
Content-Type: application/json
```

**Request Body:**
```json
{
  "input": {
    "root": "123456789...",
    "nullifierHash": "987654321...",
    "recipient": "123456789...",
    "relayer": "0",
    "fee": "0",
    "refund": "0",
    "nullifier": "111111111...",
    "secret": "222222222...",
    "pathElements": ["0", "0", ...],
    "pathIndices": [0, 0, ...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "proof": {
    "a": ["string", "string"],
    "b": [["string", "string"], ["string", "string"]],
    "c": ["string", "string"]
  },
  "publicSignals": ["string", "string", ...],
  "duration": 1234
}
```

### Generate Commitment Proof

```bash
POST /generate-proof/commitment
Content-Type: application/json
```

**Request Body:**
```json
{
  "input": {
    "nullifier": "123456789...",
    "secret": "987654321..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "proof": {
    "a": ["string", "string"],
    "b": [["string", "string"], ["string", "string"]],
    "c": ["string", "string"]
  },
  "publicSignals": ["string", "string"],
  "duration": 456
}
```

### Compute Commitment Hash

```bash
POST /compute/commitment
Content-Type: application/json
```

**Request Body:**
```json
{
  "nullifier": "123456789...",
  "secret": "987654321..."
}
```

**Response:**
```json
{
  "commitment": "commitment_hash...",
  "nullifierHash": "nullifier_hash..."
}
```

## Example Usage

### Using curl

```bash
# Check server health
curl http://localhost:3001/health

# Generate withdrawal proof
curl -X POST http://localhost:3001/generate-proof/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "root": "123...",
      "nullifierHash": "456...",
      "recipient": "789...",
      "relayer": "0",
      "fee": "0",
      "refund": "0",
      "nullifier": "111...",
      "secret": "222...",
      "pathElements": ["0", "0"],
      "pathIndices": [0, 0]
    }
  }'

# Compute commitment
curl -X POST http://localhost:3001/compute/commitment \
  -H "Content-Type: application/json" \
  -d '{"nullifier": "12345", "secret": "67890"}'
```

### Using JavaScript/TypeScript

See `example-client.ts` for a complete example of integrating with your frontend.

## Circuit Files

The server expects circuit files in the following structure:

```
../circom-circuits/
  wasm/
    withdraw_small.wasm
    commitment.wasm
  zkey/
    withdraw_small.zkey
    commitment.zkey
```

Make sure to compile your circuits before starting the server.

## Security Considerations

- **HTTPS**: Use HTTPS in production to encrypt proof data in transit
- **Rate Limiting**: Implement rate limiting to prevent abuse (proof generation is CPU-intensive)
- **Authentication**: Add authentication if you want to restrict access
- **CORS**: Configure CORS to only allow trusted origins in production
- **Circuit Files**: Keep zkey files secure - they should not be publicly accessible via HTTP

## Error Handling

The server returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad request (missing or invalid parameters)
- `404`: Endpoint not found
- `500`: Server error (circuit files missing, proof generation failed, etc.)

All errors include a JSON response with `error` and `message` fields.

## Performance

Proof generation times depend on circuit complexity and server hardware:

- **withdraw_small** (10 levels): ~1-3 seconds
- **commitment**: <1 second

Consider:
- Running on a server with good CPU
- Adding a queue system for high load
- Caching verification keys

## License

MIT
