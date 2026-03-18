/**
 * Deposit Note Display Component
 * Shows deposit note with copy and download functionality
 */

import { useState } from "react";
import type { TornadoNote } from "../../types/tornado";
import { Button } from "../ui/button";
import { downloadNote, abbreviateBigInt } from "../../utils/noteFormat";
import { CopyIcon as Copy } from "../ui/icons/Copy";
import { CheckIcon as Check } from "../ui/icons/Check";

interface DepositNoteDisplayProps {
  note: TornadoNote;
  onClose: () => void;
}

export function DepositNoteDisplay({ note, onClose }: DepositNoteDisplayProps) {
  return (
    <div className="ui-space-y-6">
      {/* Warning Banner */}
      <div className="ui-bg-error ui-text-error-foreground ui-p-6 ui-rounded-lg">
        <h3 className="ui-text-xl ui-font-bold ui-mb-2">
          🔒 SAVE THESE VALUES!
        </h3>
        <p className="ui-text-sm">
          You need these values to withdraw your funds. They will NOT be shown
          again. Make sure to save them securely before closing this page.
        </p>
      </div>

      {/* Note Values */}
      <div className="ui-space-y-4">
        <h3 className="ui-text-lg ui-font-semibold ui-mb-4">
          Your Deposit Note
        </h3>

        <NoteField label="Nullifier" value={note.nullifier} />
        <NoteField label="Secret" value={note.secret} />
        <NoteField label="Commitment" value={note.commitment} />
        <NoteField label="Nullifier Hash" value={note.nullifierHash} />
        <NoteField label="Leaf Index" value={note.leafIndex} />
      </div>

      {/* Metadata */}
      <div className="ui-bg-muted ui-p-4 ui-rounded-lg ui-space-y-2 ui-text-sm">
        <div className="ui-flex ui-justify-between">
          <span className="ui-text-muted-foreground">Contract:</span>
          <span className="ui-font-mono ui-text-xs">
            {abbreviateBigInt(note.contractAddress, 12, 8)}
          </span>
        </div>
        <div className="ui-flex ui-justify-between">
          <span className="ui-text-muted-foreground">Denomination:</span>
          <span>{(Number(note.denomination) / 1_000_000).toFixed(2)} XION</span>
        </div>
        <div className="ui-flex ui-justify-between">
          <span className="ui-text-muted-foreground">Network:</span>
          <span>{note.network}</span>
        </div>
        <div className="ui-flex ui-justify-between">
          <span className="ui-text-muted-foreground">Timestamp:</span>
          <span>{new Date(note.timestamp).toLocaleString()}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="ui-space-y-3">
        <Button
          onClick={() => downloadNote(note)}
          className="ui-w-full"
          variant="default"
        >
          Download as JSON
        </Button>

        <Button onClick={onClose} className="ui-w-full" variant="outline">
          Close (I have saved my note)
        </Button>
      </div>

      {/* Security Warning */}
      <div className="ui-text-xs ui-text-muted-foreground ui-text-center ui-pt-4 ui-border-t">
        <p>
          Never share your nullifier or secret with anyone. Store them securely
          offline.
        </p>
      </div>
    </div>
  );
}

/**
 * Individual note field with copy button
 */
function NoteField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="ui-space-y-2">
      <label className="ui-text-sm ui-font-medium">{label}</label>
      <div className="ui-flex ui-gap-2">
        <div className="ui-flex-1 ui-bg-muted ui-p-3 ui-rounded ui-font-mono ui-text-xs ui-break-all">
          {abbreviateBigInt(value, 16, 16)}
        </div>
        <Button
          onClick={handleCopy}
          variant="outline"
          size="sm"
          className="ui-px-3"
        >
          {copied ? (
            <>
              <Check className="ui-w-4 ui-h-4 ui-mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="ui-w-4 ui-h-4 ui-mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
