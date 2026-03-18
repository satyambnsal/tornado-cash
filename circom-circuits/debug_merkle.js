const { buildPoseidon } = require('circomlibjs');

async function debugMerklePath() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // Your provided data
  const nullifier = BigInt('140915109540177082036352667683430751798345934084782070030368319254355644076');
  const secret = BigInt('348837379988111950107986975988598105354562985385130187438912357690702507655');
  const providedRoot = BigInt('20235858886862934054581521775678796186574532570237872780947299547603860874578');

  const pathElements = [
    BigInt('0'),
    BigInt('111109925611824843164212799849330761292948257037696933205019304127221294824267'),
    BigInt('99208582119974435635122834636860944394611999454454139265101248405002450066801'),
    BigInt('90236482254272784387420235795439987838046297224132114184911355661882633139004'),
    BigInt('37735605373063189145609870960383397519157271673603325697615186821228299686460'),
    BigInt('71913990603354163933828411608472620759041242276514156984220416916786598645040'),
    BigInt('97950246258348409692531222476457095756697573854283095464293321272902400876449'),
    BigInt('61477539263323159367083172935543284935396148729545980766185719446310214598444'),
    BigInt('17421805441306662828813938682339723858550903736451371212309658526853237682579'),
    BigInt('36378541427962263534507524415416206454520492712868881526514165827410968138209')
  ];

  const pathIndices = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // Step 1: Compute commitment
  const commitment = F.toObject(poseidon([nullifier, secret]));
  console.log('Commitment:', commitment.toString());

  // Step 2: Verify nullifier hash
  const nullifierHash = F.toObject(poseidon([nullifier]));
  console.log('Nullifier Hash:', nullifierHash.toString());
  console.log('Expected Nullifier Hash: 15396768006849112180975997846743004093300075406938169116441156218387273176204');
  console.log('Nullifier Hash Match:', nullifierHash.toString() === '15396768006849112180975997846743004093300075406938169116441156218387273176204');

  // Step 3: Reconstruct Merkle root from path
  let currentHash = commitment;
  console.log('\n=== Merkle Path Reconstruction ===');
  console.log('Level 0 (leaf):', currentHash.toString());

  for (let i = 0; i < pathElements.length; i++) {
    const pathElement = pathElements[i];
    const isRight = pathIndices[i];

    let left, right;
    if (isRight === 0) {
      // Current hash is on the left
      left = currentHash;
      right = pathElement;
    } else {
      // Current hash is on the right
      left = pathElement;
      right = currentHash;
    }

    currentHash = F.toObject(poseidon([left, right]));
    console.log(`Level ${i + 1}: hash(${left}, ${right}) = ${currentHash}`);
  }

  console.log('\n=== Root Comparison ===');
  console.log('Computed Root:', currentHash.toString());
  console.log('Provided Root:', providedRoot.toString());
  console.log('Roots Match:', currentHash.toString() === providedRoot.toString());

  if (currentHash.toString() !== providedRoot.toString()) {
    console.log('\n❌ ERROR: Roots do not match!');
    console.log('\nPossible issues:');
    console.log('1. The commitment was not actually inserted into the tree at this position');
    console.log('2. The path elements are incorrect for this commitment');
    console.log('3. The tree was built with a different hash function or order');
    console.log('4. The nullifier/secret combination is wrong');
  } else {
    console.log('\n✓ Success: Merkle path is valid!');
  }
}

debugMerklePath().catch(console.error);
