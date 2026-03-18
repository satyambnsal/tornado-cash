/**
 * Note Input Component
 * Allows users to paste or upload their deposit note
 */

import { useState } from "react";
import type { TornadoNote } from "../../types/tornado";
import { Button } from "../ui/button";
import { parseNoteFromJSON, parseNoteFromFile, extractNoteValues } from "../../utils/noteFormat";
import { NoteValidationError } from "../../types/tornado";

interface NoteInputProps {
  onNoteLoaded: (note: TornadoNote) => void;
  disabled?: boolean;
}

export function NoteInput({ onNoteLoaded, disabled }: NoteInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePasteNote = () => {
    try {
      setError(null);
      setIsLoading(true);

      if (!input.trim()) {
        throw new NoteValidationError("Please enter your deposit note");
      }

      // Try parsing as JSON
      const note = parseNoteFromJSON(input);
      onNoteLoaded(note);
      setInput(""); // Clear input for privacy
    } catch (err) {
      if (err instanceof NoteValidationError) {
        setError(err.message);
      } else {
        setError("Invalid note format. Please check and try again.");
      }
      console.error("Failed to parse note:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      setIsLoading(true);

      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (!file.name.endsWith(".json")) {
        throw new NoteValidationError("Please upload a JSON file");
      }

      const note = await parseNoteFromFile(file);
      onNoteLoaded(note);

      // Clear input for privacy
      event.target.value = "";
      setInput("");
    } catch (err) {
      if (err instanceof NoteValidationError) {
        setError(err.message);
      } else {
        setError("Failed to read file. Please try again.");
      }
      console.error("Failed to load note from file:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ui-space-y-4">
      <div>
        <label className="ui-block ui-text-sm ui-font-medium ui-mb-2">
          Enter Your Deposit Note
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Paste your deposit note JSON here or upload a file below...\n\nExample:\n{\n  "nullifier": "123...",\n  "secret": "456...",\n  ...\n}'
          className="ui-w-full ui-h-40 ui-p-3 ui-border ui-rounded-lg ui-font-mono ui-text-sm ui-resize-none focus:ui-ring-2 focus:ui-ring-foreground disabled:ui-opacity-50"
          disabled={disabled || isLoading}
        />
      </div>

      {error && (
        <div className="ui-bg-error ui-text-error-foreground ui-p-3 ui-rounded-lg ui-text-sm">
          {error}
        </div>
      )}

      <div className="ui-flex ui-gap-3">
        <Button
          onClick={handlePasteNote}
          disabled={disabled || isLoading || !input.trim()}
          className="ui-flex-1"
        >
          {isLoading ? "Loading..." : "Load Note"}
        </Button>

        <div className="ui-relative">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            disabled={disabled || isLoading}
            className="ui-absolute ui-inset-0 ui-w-full ui-h-full ui-opacity-0 ui-cursor-pointer disabled:ui-cursor-not-allowed"
            id="note-file-upload"
          />
          <Button
            asChild
            variant="outline"
            disabled={disabled || isLoading}
          >
            <label htmlFor="note-file-upload" className="ui-cursor-pointer">
              Upload JSON
            </label>
          </Button>
        </div>
      </div>

      <div className="ui-text-xs ui-text-muted-foreground ui-p-3 ui-bg-muted ui-rounded">
        <p className="ui-font-semibold ui-mb-1">Security Note:</p>
        <p>
          Your note will be processed locally in your browser. Never share your
          deposit note with anyone.
        </p>
      </div>
    </div>
  );
}
