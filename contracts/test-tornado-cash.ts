import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice } from '@cosmjs/stargate';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://rpc.xion-testnet-2.burnt.com:443';
const CHAIN_ID = process.env.CHAIN_ID || 'xion-testnet-2';
const CODE_ID = parseInt(process.env.CODE_ID || '2048');
const DEPOSIT_ADDRESS = process.env.SATYAM2 || '';
const WITHDRAW_ADDRESS = process.env.SATYAM_TORN || '';
const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL || 'http://localhost:3001';

// You need to provide your mnemonics here - NEVER commit this to version control
// For testing purposes, you can set them in .env.local as MNEMONIC and MNEMONIC2
const DEPOSIT_MNEMONIC = process.env.MNEMONIC || '';
const WITHDRAW_MNEMONIC = process.env.SATYAM_DRAW_MNEMONIC || '';

if (!DEPOSIT_MNEMONIC) {
  console.error('ERROR: MNEMONIC not found in .env.local');
  console.error('Please add your wallet mnemonic to .env.local as:');
  console.error('MNEMONIC="your twelve or twenty four word mnemonic here"');
  console.error('Optionally add MNEMONIC2 for the withdrawal wallet');
  process.exit(1);
}

// Circuit files
const WASM_FILE = path.resolve(__dirname, '../circom-circuits/wasm/withdraw_small.wasm');
const ZKEY_FILE = path.resolve(__dirname, '../circom-circuits/zkey/withdraw_small.zkey');

// Helper function to convert address to BigInt (for circuit)
// Must match the contract's address_to_uint256 function
function addressToBigInt(address: string): string {
  if (address.startsWith('0x')) {
    // Hex address - decode it directly
    const hex = address.slice(2);
    const padded = hex.padStart(64, '0'); // Pad to 64 hex chars (32 bytes)
    return BigInt('0x' + padded).toString();
  } else {
    // Bech32 address - hash it with SHA256
    const addressHash = crypto.createHash('sha256').update(address).digest('hex');
    // Take first 30 bytes (60 hex chars) to fit in BN254 field, pad with 2 zero bytes at start
    return BigInt('0x' + '0000' + addressHash.slice(0, 60)).toString();
  }
}


// Helper function to convert Uint256 BigInt to contract format
function toUint256String(value: bigint): string {
  return value.toString();
}

// Helper function to hash two values using Poseidon (matching circuit implementation)
function hashPoseidonPair(poseidon: any, F: any, left: bigint, right: bigint): bigint {
  // Use Poseidon hash with 2 inputs (matching circuit's HashLeftRight template)
  const hash = poseidon([left, right]);
  return F.toObject(hash);
}

// Helper function to convert proof to contract format
// function formatProofForContract(proof: any): {
//   a: [string, string];
//   b: [[string, string], [string, string]];
//   c: [string, string];
// } {
//   return {
//     a: [proof.pi_a[0], proof.pi_a[1]],
//     b: [
//       [proof.pi_b[0][0], proof.pi_b[0][1]], // XION expects standard SnarkJS format (no reversal)
//       [proof.pi_b[1][0], proof.pi_b[1][1]],
//     ],
//     c: [proof.pi_c[0], proof.pi_c[1]],
//   };
// }

// Helper function to query transaction events by hash
async function getTransactionEvents(
  client: SigningCosmWasmClient,
  txHash: string
): Promise<readonly any[]> {
  // Wait 10 seconds for transaction to be indexed
  console.log('   ⏳ Waiting 10 seconds for transaction to be indexed...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Query transaction by hash
  console.log('   🔍 Querying transaction events...');
  const tx = await client.getTx(txHash);

  if (!tx) {
    throw new Error(`Transaction ${txHash} not found`);
  }

  // Return events from the transaction
  return tx.events || [];
}

// Helper function to extract attribute value from events
function getEventAttributeValue(
  events: readonly any[],
  eventType: string,
  attributeKey: string
): string | null {
  for (const event of events) {
    if (event.type === eventType) {
      for (const attr of event.attributes) {
        if (attr.key === attributeKey) {
          return attr.value;
        }
      }
    }
  }
  return null;
}

async function main() {
  console.log('🚀 Starting Tornado Cash Contract Test on Xion Testnet\n');
  console.log('🎭 Testing privacy: Deposit from one wallet, withdraw to another\n');

  // Initialize Poseidon hash
  console.log('📦 Initializing cryptographic libraries...');
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // Create deposit wallet from mnemonic
  console.log('🔑 Loading deposit wallet (SATYAM2)...');
  const depositWallet = await DirectSecp256k1HdWallet.fromMnemonic(DEPOSIT_MNEMONIC, {
    prefix: 'xion',
  });
  const [depositAccount] = await depositWallet.getAccounts();
  console.log(`   Deposit wallet address: ${depositAccount.address}`);

  if (depositAccount.address !== DEPOSIT_ADDRESS && DEPOSIT_ADDRESS) {
    console.warn(`   ⚠️  Warning: Wallet address ${depositAccount.address} doesn't match SATYAM2 ${DEPOSIT_ADDRESS}`);
  }

  // Create withdrawal wallet from mnemonic
  console.log('🔑 Loading withdrawal wallet (SATYAM_TORN)...');
  const withdrawWallet = await DirectSecp256k1HdWallet.fromMnemonic(WITHDRAW_MNEMONIC, {
    prefix: 'xion',
  });
  const [withdrawAccount] = await withdrawWallet.getAccounts();
  console.log(`   Withdrawal wallet address: ${withdrawAccount.address}`);

  if (withdrawAccount.address !== WITHDRAW_ADDRESS && WITHDRAW_ADDRESS) {
    console.warn(`   ⚠️  Warning: Wallet address ${withdrawAccount.address} doesn't match SATYAM_TORN ${WITHDRAW_ADDRESS}`);
  }

  // Connect deposit wallet to the chain
  console.log('\n🌐 Connecting deposit wallet to Xion testnet...');
  const depositClient = await SigningCosmWasmClient.connectWithSigner(RPC_URL, depositWallet, {
    gasPrice: GasPrice.fromString('0.025uxion'),
  });
  console.log('   ✅ Deposit wallet connected successfully');

  // Connect withdrawal wallet to the chain
  console.log('🌐 Connecting withdrawal wallet to Xion testnet...');
  const withdrawClient = await SigningCosmWasmClient.connectWithSigner(RPC_URL, withdrawWallet, {
    gasPrice: GasPrice.fromString('0.025uxion'),
  });
  console.log('   ✅ Withdrawal wallet connected successfully');

  // Check deposit wallet balance
  const depositBalance = await depositClient.getBalance(depositAccount.address, 'uxion');
  console.log(`\n💰 Deposit wallet balance: ${depositBalance.amount} uxion`);

  if (depositBalance.amount === '0') {
    console.error('\n❌ ERROR: Deposit wallet has no balance. Please fund your wallet from faucet.');
    process.exit(1);
  }

  // Check withdrawal wallet balance
  const withdrawBalance = await withdrawClient.getBalance(withdrawAccount.address, 'uxion');
  console.log(`💰 Withdrawal wallet balance: ${withdrawBalance.amount} uxion`);

  // Step 1: Instantiate the contract (using deposit wallet)
  console.log('\n📝 Step 1: Instantiating Tornado Cash contract...');
  const denomination = '100000'; // 1 XION = 1,000,000 uxion
  const instantiateMsg = {
    denomination,
  };

  const instantiateResult = await depositClient.instantiate(
    depositAccount.address,
    CODE_ID,
    instantiateMsg,
    'Tornado Cash Privacy Pool',
    'auto',
  );

  const contractAddress = instantiateResult.contractAddress;
  console.log(`   ✅ Contract instantiated at: ${contractAddress}`);
  console.log(`   Transaction hash: ${instantiateResult.transactionHash}`);
  console.log(`   Denomination: ${denomination} uxion`);
  // console.log(`   ✅ Contract already instantiated at: xion1w5mkgd0npxuynm07mx75hwxcg4ghf9an8w3lrhzvuajqjleqlrnsm7s47d`);

  // const contractAddress = "xion1w5mkgd0npxuynm07mx75hwxcg4ghf9an8w3lrhzvuajqjleqlrnsm7s47d"

  // Query initial config
  console.log('\n🔍 Querying contract configuration...');
  const config = await depositClient.queryContractSmart(contractAddress, { config: {} });
  console.log(`   Denomination: ${config.denomination}`);
  console.log(`   Merkle tree levels: ${config.merkle_tree_levels}`);
  console.log(`   Next leaf index: ${config.next_leaf_index}`);

  // Step 2: Generate commitment and deposit
  console.log('\n📝 Step 2: Generating commitment and making deposit...');

  // Generate random nullifier and secret
  const nullifier = BigInt('0x' + crypto.randomBytes(31).toString('hex'));
  const secret = BigInt('0x' + crypto.randomBytes(31).toString('hex'));

  console.log(`   Nullifier: ${nullifier.toString()}`);
  console.log(`   Secret: ${secret.toString()}`);

  // Compute commitment and nullifier hash
  const commitment = F.toObject(poseidon([nullifier, secret]));
  const nullifierHash = F.toObject(poseidon([nullifier]));

  console.log(`   Commitment: ${commitment.toString()}`);
  console.log(`   Nullifier hash: ${nullifierHash.toString()}`);

  // Save these for later use
  const depositData = {
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    commitment: commitment.toString(),
    nullifierHash: nullifierHash.toString(),
    contractAddress,
    denomination,
  };
  fs.writeFileSync('tornado-deposit.json', JSON.stringify(depositData, null, 2));
  console.log('   💾 Deposit data saved to tornado-deposit.json');

  // Make deposit (from deposit wallet)
  console.log('\n   💰 Making deposit from SATYAM2 wallet...');
  const depositMsg = {
    deposit: {
      commitment: toUint256String(commitment),
    },
  };

  const depositResult = await depositClient.execute(
    depositAccount.address,
    contractAddress,
    depositMsg,
    'auto',
    undefined,
    [{ denom: 'uxion', amount: denomination }],
  );

  console.log(`   ✅ Deposit successful!`);
  console.log(`   Transaction hash: ${depositResult.transactionHash}`);
  console.log(`   Deposited from: ${depositAccount.address}`);

  // Extract deposit ID and leaf index from events
  const depositEvents = await getTransactionEvents(depositClient, depositResult.transactionHash);

  const depositId = getEventAttributeValue(depositEvents, 'wasm', 'deposit_id') || '1';
  const leafIndex = getEventAttributeValue(depositEvents, 'wasm', 'leaf_index') || '0';

  console.log(`   Deposit ID: ${depositId}`);
  console.log(`   Leaf index: ${leafIndex}`);

  // Query deposit
  console.log('\n🔍 Querying deposit...');
  const depositQuery = await depositClient.queryContractSmart(contractAddress, {
    deposit: { id: parseInt(depositId) },
  });
  console.log(`   Deposit found:`, depositQuery.deposit);

  // Query Merkle root
  const merkleRootQuery = await depositClient.queryContractSmart(contractAddress, {
    merkle_root: {},
  });
  console.log(`   Current Merkle root: ${merkleRootQuery.root}`);

  // Step 3: Build Merkle proof
  console.log('\n📝 Step 3: Building Merkle proof...');
  const levels = config.merkle_tree_levels;
  const numLeaves = 1 << levels; // 2^levels

  // Build Merkle tree
  function buildMerkleTree(
    leaves: bigint[],
    levels: number
  ): {
    root: bigint;
    pathElements: bigint[][];
    pathIndices: number[][];
  } {
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

  const leaves = new Array(numLeaves).fill(BigInt(0));
  leaves[parseInt(leafIndex)] = commitment;

  const { root, pathElements, pathIndices } = buildMerkleTree(leaves, levels);
  console.log(`   Computed Merkle root: ${root.toString()}`);
  console.log(`   Contract Merkle root: ${merkleRootQuery.root}`);

  // Verify roots match
  if (root.toString() !== merkleRootQuery.root) {
    console.error('   ❌ ERROR: Merkle roots do not match!');
    process.exit(1);
  }
  console.log('   ✅ Merkle roots match!');

  // Step 4: Generate withdrawal proof
  console.log('\n📝 Step 4: Generating withdrawal proof...');
  console.log('   This may take a minute...');
  console.log(`   🎯 Withdrawing to SATYAM_TORN wallet: ${withdrawAccount.address}`);

  const recipientAddress = withdrawAccount.address; // Withdraw to different address
  const relayerAddress = '0x0000000000000000000000000000000000000000'; // No relayer
  const fee = '0';
  const refund = '0';

  const withdrawInput = {
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    recipient: addressToBigInt(recipientAddress),
    relayer: addressToBigInt(relayerAddress),
    fee,
    refund,
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    pathElements: pathElements[parseInt(leafIndex)].map((x) => x.toString()),
    pathIndices: pathIndices[parseInt(leafIndex)],
  };

  console.log("Withdraw input prepared:");
  console.log(`   Root: ${withdrawInput.root}`);
  console.log(`   Nullifier hash: ${withdrawInput.nullifierHash}`);
  console.log(`   Recipient: ${recipientAddress} (as bigint: ${withdrawInput.recipient})`);
  console.log(`   Relayer: ${relayerAddress} (as bigint: ${withdrawInput.relayer})`);
  console.log(`   Fee: ${withdrawInput.fee}`);
  console.log(`   Refund: ${withdrawInput.refund}`);
  console.log(`   Nullifier: ${withdrawInput.nullifier}`);
  console.log(`   Secret: ${withdrawInput.secret}`);
  console.log(`   Path elements: [${withdrawInput.pathElements.join(', ')}]`);
  console.log(`   Path indices: [${withdrawInput.pathIndices.join(', ')}]`);
  // Check if WASM and zkey files exist
  if (!fs.existsSync(WASM_FILE) || !fs.existsSync(ZKEY_FILE)) {
    console.error('   ❌ ERROR: WASM or zkey files not found');
    console.error(`   Expected WASM: ${WASM_FILE}`);
    console.error(`   Expected zkey: ${ZKEY_FILE}`);
    process.exit(1);
  }

  // const { proof, publicSignals } = await snarkjs.groth16.fullProve(withdrawInput, WASM_FILE, ZKEY_FILE);

  fs.writeFileSync('withdraw_input.json', JSON.stringify(withdrawInput, null, 2));

  const { proof, publicSignals } = await generateWithdrawProof(withdrawInput);

  console.log('   ✅ Proof generated successfully!');
  console.log(`   Public signals: ${publicSignals.join(', ')}`);

  // Step 5: Withdraw funds
  console.log('\n📝 Step 5: Withdrawing funds...');

  // const formattedProof = formatProofForContract(proof);
  const formattedProof = proof

  // const formattedProof = {
  //   "a": [
  //     "17784842419098994214826833250228200226477840054607247446499511178133414901609",
  //     "1262106810349117899583386901835422953550065335704273276071966822597253377466"
  //   ],
  //   "b": [
  //     [
  //       "7047368510534070305982852285855281645036024949251202965377741384950068017987",
  //       "18141058173079636725835803224707848399330594411689915707801376667086005271516"
  //     ],
  //     [
  //       "9374997234098058255383229981030071259582990392308637534075065745169010826533",
  //       "3521640127597902546575447972837137054039491322413468976542858731758112809270"
  //     ]
  //   ],
  //   "c": [
  //     "11366878632640810783232994316399242636135928355173980774921901433017907053521",
  //     "3921768658253946069297618282722507847785169022272371031804720550057237095213",
  //   ],
  // }

  // Convert public signals to Uint256 strings
  // Public signals order: [root, nullifierHash, recipient, relayer, fee, refund]
  const publicInputs = publicSignals.map((signal: any) => {
    if (typeof signal === 'bigint') {
      return signal.toString();
    }
    return String(signal);
  });
  // const publicInputs = ["778453897116362033231764667787626079208449735622311665250691543147586886921", "2091494570625781414801123335772982296875111628444069607086145685317750839639", "103929005307130220006098923584552504982110632080", "0", "0", "0"];

  const withdrawMsg = {
    withdraw: {
      proof: formattedProof,
      public_inputs: publicInputs,
      root: toUint256String(root),
      nullifier_hash: toUint256String(nullifierHash),
      recipient: recipientAddress,
      relayer: relayerAddress,
      fee: toUint256String(BigInt(fee)),
      refund: toUint256String(BigInt(refund)),
    },
  };

  console.log('   Submitting withdrawal transaction from SATYAM_TORN wallet...');
  const withdrawResult = await withdrawClient.execute(withdrawAccount.address, contractAddress, withdrawMsg, 'auto');

  console.log(`   ✅ Withdrawal successful!`);
  console.log(`   Transaction hash: ${withdrawResult.transactionHash}`);
  console.log(`   Withdrawn to: ${withdrawAccount.address}`);

  // Check final balances
  const finalDepositBalance = await depositClient.getBalance(depositAccount.address, 'uxion');
  const finalWithdrawBalance = await withdrawClient.getBalance(withdrawAccount.address, 'uxion');

  console.log(`\n💰 Final balances:`);
  console.log(`   Deposit wallet (SATYAM2): ${finalDepositBalance.amount} uxion`);
  console.log(`   - Changed by: ${parseInt(finalDepositBalance.amount) - parseInt(depositBalance.amount)} uxion (lost ${denomination} + gas)`);
  console.log(`   Withdrawal wallet (SATYAM_TORN): ${finalWithdrawBalance.amount} uxion`);
  console.log(`   - Changed by: ${parseInt(finalWithdrawBalance.amount) - parseInt(withdrawBalance.amount)} uxion (gained ${denomination} - gas)`);

  // Verify nullifier was used
  console.log('\n🔍 Verifying nullifier was marked as used...');
  const nullifierUsed = await withdrawClient.queryContractSmart(contractAddress, {
    is_nullifier_used: { nullifier_hash: nullifierHash.toString() },
  });
  console.log(`   Nullifier used: ${nullifierUsed.used}`);

  if (!nullifierUsed.used) {
    console.error('   ❌ ERROR: Nullifier should be marked as used!');
    process.exit(1);
  }

  console.log('\n✅ All tests passed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   - Contract: ${contractAddress}`);
  console.log(`   - Deposit wallet (SATYAM2): ${depositAccount.address}`);
  console.log(`   - Withdrawal wallet (SATYAM_TORN): ${withdrawAccount.address}`);
  console.log(`   - Amount: ${denomination} uxion`);
  console.log(`   - Withdrawal: Successful with ZK proof`);
  console.log(`   - Privacy: ✅ (no link between deposit and withdrawal addresses)`);
}

main()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });



async function generateWithdrawProof(withdrawInput: {
  root: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  fee: string;
  refund: string;
  nullifier: string;
  secret: string;
  pathElements: string[];
  pathIndices: number[];
}) {
  try {
    console.log('Requesting proof generation from server...');

    const response = await fetch(`${PROOF_SERVER_URL}/generate-proof/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: withdrawInput,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Failed to generate proof: ${error.message}`);
    }

    const data: any = await response.json();
    console.log(`Proof generated in ${data.duration}ms`);
    console.log(`Proof details:`, data);
    return {
      proof: data.proof,
      publicSignals: data.publicSignals,
    };
  } catch (error) {
    console.error('Error generating withdrawal proof:', error);
    throw error;
  }
}
