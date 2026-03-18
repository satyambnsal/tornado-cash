pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Simple circuit to compute a commitment
// commitment = Poseidon(nullifier, secret)
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal output commitment;
    signal output nullifierHash;

    // Compute commitment
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;
    commitment <== commitmentHasher.out;

    // Compute nullifier hash
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash <== nullifierHasher.out;
}

component main = CommitmentHasher();
