import * as fs from 'fs';
import * as path from 'path';

interface ProofData {
  vkey: object;
  publicSignals: string[] | number[];
  proof: object;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: Please provide a JSON file path as argument');
    console.error('Usage: npx ts-node scripts/extract_proof_data.ts <input-file.json>');
    process.exit(1);
  }

  const inputFile = args[0];

  // Check if file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File "${inputFile}" not found`);
    process.exit(1);
  }

  // Read and parse JSON
  let data: ProofData;
  try {
    const content = fs.readFileSync(inputFile, 'utf-8');
    data = JSON.parse(content);
  } catch (error) {
    console.error(`Error: Failed to parse JSON file "${inputFile}"`);
    console.error(error);
    process.exit(1);
  }

  // Validate required properties
  if (!data.vkey || !data.publicSignals || !data.proof) {
    console.error('Error: JSON file must contain "vkey", "publicSignals", and "proof" properties');
    process.exit(1);
  }

  // Create payload directory if it doesn't exist
  const payloadDir = path.join(process.cwd(), 'payload');
  if (!fs.existsSync(payloadDir)) {
    fs.mkdirSync(payloadDir, { recursive: true });
  }

  // Write vkey.json
  const vkeyPath = path.join(payloadDir, 'vkey.json');
  fs.writeFileSync(vkeyPath, JSON.stringify(data.vkey, null, 2));
  console.log(`Created: ${vkeyPath}`);

  // Write proof.json
  const proofPath = path.join(payloadDir, 'proof.json');
  fs.writeFileSync(proofPath, JSON.stringify(data.proof, null, 2));
  console.log(`Created: ${proofPath}`);

  // Write public_signals.txt with comma-separated values (no spaces, no quotes)
  const publicSignalsPath = path.join(payloadDir, 'public_signals.txt');
  const publicSignalsString = data.publicSignals.join(',');
  fs.writeFileSync(publicSignalsPath, publicSignalsString);
  console.log(`Created: ${publicSignalsPath}`);

  console.log('\nExtraction complete!');
}

main();
