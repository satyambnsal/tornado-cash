pragma circom 2.0.0;

include "./withdraw.circom";

// Main component with 20 levels (supports up to 2^20 = ~1M deposits)
component main {public [root, nullifierHash, recipient, relayer, fee, refund]} = Withdraw(20);
