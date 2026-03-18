pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

// Computes Poseidon(left, right)
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

// Merkle tree proof verifier
// if pathIndices[i] == 0 then current hash is on the left, sibling on the right
// if pathIndices[i] == 1 then current hash is on the right, sibling on the left
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectors[levels];
    component hashers[levels];

    signal currentHash[levels + 1];
    currentHash[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // Select which side the current hash should be on
        selectors[i] = DualMux();
        selectors[i].in[0] <== currentHash[i];
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        // Hash the pair
        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];

        currentHash[i + 1] <== hashers[i].hash;
    }

    // Check that computed root matches the provided root
    root === currentHash[levels];
}

// Helper template - dual mux
// If s == 0: out[0] = in[0], out[1] = in[1]
// If s == 1: out[0] = in[1], out[1] = in[0]
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0; // s must be 0 or 1

    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Main Tornado Cash withdrawal circuit
// Proves that the sender knows a secret for a commitment in the Merkle tree
// without revealing which commitment
template Withdraw(levels) {
    // Public inputs
    signal input root;              // Merkle tree root
    signal input nullifierHash;     // Hash of nullifier (prevents double-spend)
    signal input recipient;         // Recipient address
    signal input relayer;           // Relayer address (for meta-transactions)
    signal input fee;               // Fee paid to relayer
    signal input refund;            // Refund amount

    // Private inputs
    signal input nullifier;         // Secret nullifier
    signal input secret;            // Secret value
    signal input pathElements[levels];  // Merkle proof path
    signal input pathIndices[levels];   // Merkle proof indices

    // 1. Compute commitment = Hash(nullifier, secret)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;
    signal commitment <== commitmentHasher.out;

    // 2. Verify Merkle proof for the commitment
    component merkleProof = MerkleTreeChecker(levels);
    merkleProof.leaf <== commitment;
    merkleProof.root <== root;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i] <== pathIndices[i];
    }

    // 3. Verify nullifier hash
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash === nullifierHasher.out;

    // 4. Add dummy constraints for recipient, relayer, fee, refund
    // These are included as public inputs for the contract to enforce
    // but don't need circuit logic - just ensure they're not optimized away
    signal recipientSquare <== recipient * recipient;
    signal relayerSquare <== relayer * relayer;
    signal feeSquare <== fee * fee;
    signal refundSquare <== refund * refund;
}

// Note: main component is exported in withdraw_main.circom
