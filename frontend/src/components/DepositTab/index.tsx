/**
 * Deposit Tab Component
 * Handles deposits to Tornado Cash mixer
 */

import { useState } from "react";
import type { DepositStatus, TornadoNote } from "../../types/tornado";
import { Button } from "../ui/button";
import { DepositNoteDisplay } from "./DepositNoteDisplay";
import { generateDepositCredentials } from "../../utils/crypto";
import { computeCommitment } from "../../services/proofServer";
import { createNote } from "../../utils/noteFormat";

interface DepositTabProps {
  contractAddress: string;
  denomination: string;
  balance: string;
  userAddress: string;
  chainId: string;
  onDeposit: (commitment: string, amount: readonly { denom: string; amount: string }[]) => Promise<{
    txHash: string;
    events: readonly any[];
  }>;
}

export function DepositTab({
  contractAddress,
  denomination,
  balance,
  userAddress,
  chainId,
  onDeposit,
}: DepositTabProps) {
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<TornadoNote | null>(null);

  const handleDeposit = async () => {
    try {
      setStatus("generating");
      setError(null);

      console.log("=== Starting Deposit ===");
      console.log("Balance:", balance);
      console.log("Denomination:", denomination);
      console.log("User Address:", userAddress);
      console.log("Contract Address:", contractAddress);

      // Step 1: Generate random nullifier and secret client-side
      console.log("Generating deposit credentials...");
      const { nullifier, secret } = generateDepositCredentials();

      // Step 2: Call proof server to compute commitment and nullifier hash
      console.log("Computing commitment...");
      const { commitment, nullifierHash } = await computeCommitment(
        nullifier.toString(),
        secret.toString()
      );

      console.log("Commitment generated:", commitment);
      console.log("Nullifier:", nullifier.toString());
      console.log("Secret:", secret.toString());

      // Step 3: Execute deposit transaction
      setStatus("depositing");
      console.log("Executing deposit transaction...");

      const result = await onDeposit(commitment, [
        { denom: "uxion", amount: denomination },
      ]);

      console.log("Deposit successful! TX:", result.txHash);

      // Step 4: Extract deposit info from events
      let depositId: string | undefined;
      let leafIndex = "0";

      for (const event of result.events) {
        if (event.type === "wasm") {
          for (const attr of event.attributes) {
            if (attr.key === "deposit_id") {
              depositId = attr.value;
            }
            if (attr.key === "leaf_index") {
              leafIndex = attr.value;
            }
          }
        }
      }

      // Step 5: Create note with all deposit information
      const depositNote = createNote({
        network: chainId,
        contractAddress,
        denomination,
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        commitment,
        nullifierHash,
        depositId,
        leafIndex,
      });

      setNote(depositNote);
      setStatus("success");

      // Save to transaction history (metadata only, NO SECRETS)
      saveDepositToHistory({
        contractAddress,
        denomination,
        depositId,
        txHash: result.txHash,
        timestamp: depositNote.timestamp,
        leafIndex,
      });
    } catch (err) {
      console.error("Deposit failed:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check if it's an authorization error
      if (errorMessage.includes("unauthorized") || errorMessage.includes("permission")) {
        setError(
          "Contract authorization required. Please disconnect and reconnect your wallet to grant the necessary permissions to the Tornado Cash contract."
        );
      } else {
        setError(errorMessage);
      }
      setStatus("error");
    }
  };

  const handleReset = () => {
    setNote(null);
    setStatus("idle");
    setError(null);
  };

  // Check if balance is sufficient
  const balanceNum = BigInt(balance || "0");
  const denominationNum = BigInt(denomination);
  const hasInsufficientBalance = balanceNum < denominationNum;

  // Format denomination for display (convert from uxion to XION)
  const denominationInXion = (Number(denomination) / 1_000_000).toFixed(2);

  if (status === "success" && note) {
    return <DepositNoteDisplay note={note} onClose={handleReset} />;
  }

  return (
    <div className="ui-space-y-6">
      {/* Deposit Info */}
      <div className="ui-bg-muted ui-p-6 ui-rounded-lg ui-space-y-4">
        <div>
          <h3 className="ui-text-lg ui-font-semibold">Deposit Amount</h3>
          <p className="ui-text-3xl ui-font-bold ui-mt-2">
            {denominationInXion} XION
          </p>
          <p className="ui-text-sm ui-text-muted-foreground ui-mt-1">
            ({denomination} uxion)
          </p>
        </div>

        <div className="ui-border-t ui-pt-4">
          <div className="ui-flex ui-justify-between ui-text-sm">
            <span className="ui-text-muted-foreground">Your Balance:</span>
            <span className="ui-font-medium">
              {(Number(balance) / 1_000_000).toFixed(6)} XION
            </span>
          </div>
          <div className="ui-flex ui-justify-between ui-text-sm ui-mt-2">
            <span className="ui-text-muted-foreground">Contract:</span>
            <span className="ui-font-mono ui-text-xs">
              {contractAddress.slice(0, 12)}...{contractAddress.slice(-8)}
            </span>
          </div>
        </div>
      </div>

      {/* Deposit Info Message */}
      <div className="ui-bg-muted ui-border-l-4 ui-border-foreground ui-p-4">
        <h4 className="ui-font-semibold ui-mb-2">How Deposits Work</h4>
        <ul className="ui-text-sm ui-space-y-1 ui-text-muted-foreground">
          <li>• A secure note will be generated for your deposit</li>
          <li>• You will receive nullifier and secret values</li>
          <li>• Save these values to withdraw your funds later</li>
          <li>• Never share your note with anyone</li>
        </ul>
      </div>

      {/* Error Display */}
      {error && (
        <div className="ui-bg-error ui-text-error-foreground ui-p-4 ui-rounded-lg">
          <p className="ui-font-semibold">Error</p>
          <p className="ui-text-sm ui-mt-1">{error}</p>
          <Button
            onClick={() => setError(null)}
            variant="secondary"
            size="small"
            className="ui-mt-3"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Deposit Button */}
      <div>
        <Button
          onClick={handleDeposit}
          disabled={status !== "idle" && status !== "error" || hasInsufficientBalance}
          className="ui-w-full ui-h-12 ui-text-lg"
        >
          {status === "idle" && !hasInsufficientBalance && "Deposit"}
          {status === "generating" && "Generating Note..."}
          {status === "depositing" && "Depositing..."}
          {hasInsufficientBalance && "Insufficient Balance"}
        </Button>

        {hasInsufficientBalance && (
          <p className="ui-text-sm ui-text-error ui-mt-2 ui-text-center">
            You need at least {denominationInXion} XION + gas fees to deposit
          </p>
        )}
      </div>

      {/* Connected Account */}
      <div className="ui-text-center ui-text-sm ui-text-muted-foreground ui-pt-4 ui-border-t">
        <p>Depositing from:</p>
        <p className="ui-font-mono ui-text-xs ui-mt-1">{userAddress}</p>
      </div>
    </div>
  );
}

// Helper function to save deposit metadata to localStorage (NO SECRETS!)
function saveDepositToHistory(metadata: {
  contractAddress: string;
  denomination: string;
  depositId?: string;
  txHash: string;
  timestamp: string;
  leafIndex: string;
}) {
  try {
    const history = JSON.parse(
      localStorage.getItem("tornado_deposit_history") || "[]"
    );
    history.unshift({
      type: "deposit",
      ...metadata,
    });
    // Keep only last 50 deposits
    localStorage.setItem(
      "tornado_deposit_history",
      JSON.stringify(history.slice(0, 50))
    );
  } catch (error) {
    console.error("Failed to save deposit to history:", error);
  }
}
