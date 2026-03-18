/**
 * Transaction History Component
 * Displays past deposits and withdrawals (metadata only, no secrets)
 */

import { useState, useEffect } from "react";
import type { TransactionHistoryEntry } from "../../types/tornado";
import { getExplorerTxUrl } from "../../config";
import { ExternalLinkIcon as ExternalLink } from "../ui/icons/ExternalLink";

export function TransactionHistory() {
  const [history, setHistory] = useState<TransactionHistoryEntry[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem("tornado_deposit_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
      }
    } catch (error) {
      console.error("Failed to load transaction history:", error);
    }
  };

  const clearHistory = () => {
    if (
      confirm(
        "Are you sure you want to clear your transaction history? This action cannot be undone.",
      )
    ) {
      localStorage.removeItem("tornado_deposit_history");
      setHistory([]);
    }
  };

  if (history.length === 0) {
    return (
      <div className="ui-text-center ui-py-12">
        <p className="ui-text-muted-foreground">No transaction history yet</p>
        <p className="ui-text-sm ui-text-muted-foreground ui-mt-2">
          Your deposits and withdrawals will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="ui-space-y-4">
      <div className="ui-flex ui-justify-between ui-items-center">
        <h3 className="ui-text-lg ui-font-semibold">Transaction History</h3>
        <button
          onClick={clearHistory}
          className="ui-text-sm ui-text-muted-foreground hover:ui-text-foreground ui-underline"
        >
          Clear History
        </button>
      </div>

      <div className="ui-space-y-3">
        {history.map((entry, index) => (
          <TransactionEntry key={index} entry={entry} />
        ))}
      </div>

      <div className="ui-text-xs ui-text-muted-foreground ui-text-center ui-pt-4 ui-border-t">
        <p>
          Transaction history is stored locally in your browser. No sensitive
          information is stored.
        </p>
      </div>
    </div>
  );
}

function TransactionEntry({ entry }: { entry: TransactionHistoryEntry }) {
  const isDeposit = entry.type === "deposit";
  const amount = (Number(entry.denomination) / 1_000_000).toFixed(2);
  const explorerUrl = getExplorerTxUrl(entry.txHash);

  return (
    <div className="ui-bg-muted ui-p-4 ui-rounded-lg ui-space-y-2">
      <div className="ui-flex ui-justify-between ui-items-start">
        <div>
          <div className="ui-flex ui-items-center ui-gap-2">
            <span
              className={`ui-inline-block ui-w-2 ui-h-2 ui-rounded-full ${
                isDeposit ? "ui-bg-success" : "ui-bg-foreground"
              }`}
            />
            <span className="ui-font-semibold">
              {isDeposit ? "Deposit" : "Withdrawal"}
            </span>
          </div>
          <p className="ui-text-sm ui-text-muted-foreground ui-mt-1">
            {new Date(entry.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="ui-text-right">
          <p className="ui-font-semibold">{amount} XION</p>
        </div>
      </div>

      <div className="ui-space-y-1 ui-text-xs ui-text-muted-foreground">
        {isDeposit && entry.leafIndex && (
          <div className="ui-flex ui-justify-between">
            <span>Leaf Index:</span>
            <span className="ui-font-mono">{entry.leafIndex}</span>
          </div>
        )}

        {!isDeposit && entry.recipient && (
          <div className="ui-flex ui-justify-between">
            <span>Recipient:</span>
            <span className="ui-font-mono ui-text-xs">
              {entry.recipient.slice(0, 12)}...{entry.recipient.slice(-8)}
            </span>
          </div>
        )}

        <div className="ui-flex ui-justify-between ui-items-center">
          <span>TX Hash:</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-font-mono ui-text-xs ui-flex ui-items-center ui-gap-1 hover:ui-underline"
          >
            {entry.txHash.slice(0, 8)}...{entry.txHash.slice(-6)}
            <ExternalLink className="ui-w-3 ui-h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
