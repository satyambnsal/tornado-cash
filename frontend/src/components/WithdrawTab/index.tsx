/**
 * Withdraw Tab Component
 * Handles withdrawals from Tornado Cash mixer
 */

import { useState } from "react";
import type { TornadoNote, WithdrawStatus, ProofData } from "../../types/tornado";
import { Button } from "../ui/button";
import { NoteInput } from "./NoteInput";
import { WithdrawalProgress } from "./WithdrawalProgress";
import { generateWithdrawalProof } from "../../services/proofServer";
import { buildSparseTreeProof } from "../../utils/merkleTree";
import { addressToBigInt } from "../../utils/crypto";

interface WithdrawTabProps {
  contractAddress: string;
  denomination: string;
  merkleTreeLevels: number;
  userAddress: string;
  onWithdraw: (
    proof: ProofData,
    publicInputs: string[],
    root: string,
    nullifierHash: string,
    recipient: string,
    relayer?: string,
    fee?: string,
    refund?: string
  ) => Promise<{
    txHash: string;
    events: readonly any[];
  }>;
  onCheckNullifier: (nullifierHash: string) => Promise<boolean>;
  onGetMerkleRoot: () => Promise<string>;
}

export function WithdrawTab({
  contractAddress,
  denomination,
  merkleTreeLevels,
  userAddress,
  onWithdraw,
  onCheckNullifier,
  onGetMerkleRoot,
}: WithdrawTabProps) {
  const [note, setNote] = useState<TornadoNote | null>(null);
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<WithdrawStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleNoteLoaded = async (loadedNote: TornadoNote) => {
    try {
      setError(null);
      setStatus("validating");

      // Validate note matches current contract
      if (loadedNote.contractAddress !== contractAddress) {
        throw new Error(
          "Note is for a different contract. Please check the contract address."
        );
      }

      if (loadedNote.denomination !== denomination) {
        throw new Error(
          "Note is for a different denomination. Please check the amount."
        );
      }

      // Check if nullifier has already been used
      const isUsed = await onCheckNullifier(loadedNote.nullifierHash);
      if (isUsed) {
        throw new Error(
          "This note has already been withdrawn. Each note can only be used once."
        );
      }

      setNote(loadedNote);
      setRecipient(userAddress); // Default to current user address
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate note");
      setStatus("error");
      setNote(null);
    }
  };

  const handleWithdraw = async () => {
    if (!note) {
      setError("No note loaded");
      return;
    }

    try {
      setError(null);
      setStatus("building_tree");

      // Get current Merkle root from contract
      console.log("Fetching Merkle root...");
      const contractRoot = await onGetMerkleRoot();
      console.log("Contract root:", contractRoot);

      // Build sparse Merkle proof
      console.log("Building Merkle proof...");
      const { root: computedRoot, pathElements, pathIndices } = await buildSparseTreeProof(
        BigInt(note.commitment),
        parseInt(note.leafIndex),
        merkleTreeLevels
      );

      console.log("Merkle proof built");
      console.log("Computed root:", computedRoot.toString());
      console.log("Contract root:", contractRoot);
      console.log("Path elements:", pathElements.map(x => x.toString()));
      console.log("Path indices:", pathIndices);

      // CRITICAL: Verify computed root matches contract root
      if (computedRoot.toString() !== contractRoot) {
        throw new Error(
          `Merkle root mismatch! This likely means the commitment or leaf index is incorrect.\n` +
          `Computed root: ${computedRoot.toString()}\n` +
          `Contract root: ${contractRoot}\n` +
          `This could happen if:\n` +
          `- The contract has new deposits since your deposit\n` +
          `- The leaf index in your note is wrong\n` +
          `- The commitment value is incorrect`
        );
      }
      console.log("✅ Merkle roots match!");

      // Convert recipient address to BigInt
      setStatus("generating_proof");
      console.log("Converting addresses...");

      // Convert addresses to BigInt format (matching contract test implementation)
      const recipientBigInt = await addressToBigInt(recipient);
      // Relayer address must also be converted - use hex zero address
      const relayerBigInt = await addressToBigInt("0x0000000000000000000000000000000000000000");

      // Prepare withdrawal input (use computed root which matches contract root)
      const withdrawInput = {
        root: computedRoot.toString(),
        nullifierHash: note.nullifierHash,
        recipient: recipientBigInt,
        relayer: relayerBigInt,
        fee: "0",
        refund: "0",
        nullifier: note.nullifier,
        secret: note.secret,
        pathElements: pathElements.map((x) => x.toString()),
        pathIndices,
      };

      console.log("Generating withdrawal proof...");
      console.log("Input:", withdrawInput);

      // Generate proof via proof server
      const proofResult = await generateWithdrawalProof(withdrawInput);
      console.log("Proof generated in", proofResult.duration, "ms");

      // Execute withdrawal
      setStatus("withdrawing");
      console.log("Executing withdrawal...");

      const result = await onWithdraw(
        proofResult.proof,
        proofResult.publicSignals,
        computedRoot.toString(),
        note.nullifierHash,
        recipient,
        "0x0000000000000000000000000000000000000000", // No relayer
        "0",
        "0"
      );

      console.log("Withdrawal successful! TX:", result.txHash);

      // Success!
      setTxHash(result.txHash);
      setStatus("success");

      // Save to transaction history (metadata only, NO SECRETS)
      saveWithdrawalToHistory({
        contractAddress,
        denomination,
        recipient,
        txHash: result.txHash,
        timestamp: new Date().toISOString(),
      });

      // Clear note for privacy
      setNote(null);
      setRecipient("");
    } catch (err) {
      console.error("Withdrawal failed:", err);
      setError(err instanceof Error ? err.message : "Failed to withdraw");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setNote(null);
    setRecipient("");
    setStatus("idle");
    setError(null);
    setTxHash(null);
  };

  // If withdrawal is in progress or complete, show progress
  if (status !== "idle" && status !== "error" || status === "success") {
    return (
      <div className="ui-space-y-6">
        <WithdrawalProgress status={status} error={error} txHash={txHash} />

        {status === "success" && (
          <Button onClick={handleReset} className="ui-w-full">
            Make Another Withdrawal
          </Button>
        )}
      </div>
    );
  }

  // If no note loaded, show note input
  if (!note) {
    return (
      <div className="ui-space-y-6">
        <NoteInput onNoteLoaded={handleNoteLoaded} disabled={status === "validating"} />

        {status === "validating" && (
          <div className="ui-text-center ui-text-sm ui-text-muted-foreground">
            <p>Validating note...</p>
          </div>
        )}

        {status === "error" && error && (
          <div className="ui-bg-error ui-text-error-foreground ui-p-4 ui-rounded-lg">
            <p className="ui-font-semibold">Error</p>
            <p className="ui-text-sm ui-mt-1">{error}</p>
            <Button
              onClick={() => {
                setError(null);
                setStatus("idle");
              }}
              variant="outline"
              size="sm"
              className="ui-mt-3"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Note loaded, show withdrawal form
  return (
    <div className="ui-space-y-6">
      {/* Note Info */}
      <div className="ui-bg-muted ui-p-4 ui-rounded-lg ui-space-y-2 ui-text-sm">
        <div className="ui-flex ui-justify-between">
          <span className="ui-text-muted-foreground">Amount:</span>
          <span className="ui-font-semibold">
            {(Number(note.denomination) / 1_000_000).toFixed(2)} XION
          </span>
        </div>
        <div className="ui-flex ui-justify-between">
          <span className="ui-text-muted-foreground">Leaf Index:</span>
          <span>{note.leafIndex}</span>
        </div>
        <div className="ui-flex ui-justify-between">
          <span className="ui-text-muted-foreground">Deposit Date:</span>
          <span>{new Date(note.timestamp).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Recipient Address Input */}
      <div>
        <label className="ui-block ui-text-sm ui-font-medium ui-mb-2">
          Recipient Address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="xion1... or 0x..."
          className="ui-w-full ui-p-3 ui-border ui-rounded-lg ui-font-mono ui-text-sm focus:ui-ring-2 focus:ui-ring-foreground"
        />
        <p className="ui-text-xs ui-text-muted-foreground ui-mt-2">
          For maximum privacy, use a different address than the one you deposited
          from.
        </p>
      </div>

      {/* Withdraw Button */}
      <div>
        <Button
          onClick={handleWithdraw}
          disabled={!recipient.trim()}
          className="ui-w-full ui-h-12 ui-text-lg"
        >
          Withdraw {(Number(note.denomination) / 1_000_000).toFixed(2)} XION
        </Button>
      </div>

      {/* Clear Note Button */}
      <div className="ui-text-center">
        <Button onClick={handleReset} variant="outline" size="sm">
          Clear Note
        </Button>
      </div>
    </div>
  );
}

// Helper function to save withdrawal metadata to localStorage (NO SECRETS!)
function saveWithdrawalToHistory(metadata: {
  contractAddress: string;
  denomination: string;
  recipient: string;
  txHash: string;
  timestamp: string;
}) {
  try {
    const history = JSON.parse(
      localStorage.getItem("tornado_deposit_history") || "[]"
    );
    history.unshift({
      type: "withdrawal",
      ...metadata,
    });
    // Keep only last 50 transactions
    localStorage.setItem(
      "tornado_deposit_history",
      JSON.stringify(history.slice(0, 50))
    );
  } catch (error) {
    console.error("Failed to save withdrawal to history:", error);
  }
}
