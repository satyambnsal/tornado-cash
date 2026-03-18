/**
 * Note formatting and parsing utilities for Tornado Cash
 * Handles creation, validation, and storage of deposit notes
 */

import type { TornadoNote } from "../types/tornado";
import { NoteValidationError } from "../types/tornado";
import { isValidBigIntString } from "./crypto";

/**
 * Create a Tornado Cash note from deposit data
 * @param data - Note data
 * @returns Formatted Tornado note
 */
export function createNote(data: {
  network: string;
  contractAddress: string;
  denomination: string;
  nullifier: string;
  secret: string;
  commitment: string;
  nullifierHash: string;
  depositId?: string;
  leafIndex: string;
}): TornadoNote {
  return {
    version: "1.0",
    network: data.network,
    contractAddress: data.contractAddress,
    denomination: data.denomination,
    nullifier: data.nullifier,
    secret: data.secret,
    commitment: data.commitment,
    nullifierHash: data.nullifierHash,
    depositId: data.depositId,
    leafIndex: data.leafIndex,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format note as JSON string for download
 * @param note - Tornado note
 * @returns JSON string
 */
export function formatNoteAsJSON(note: TornadoNote): string {
  return JSON.stringify(note, null, 2);
}

/**
 * Format note as human-readable text
 * @param note - Tornado note
 * @returns Formatted text string
 */
export function formatNoteAsText(note: TornadoNote): string {
  return `Tornado Cash Deposit Note
Version: ${note.version}
Network: ${note.network}
Contract: ${note.contractAddress}
Denomination: ${note.denomination}
Nullifier: ${note.nullifier}
Secret: ${note.secret}
Commitment: ${note.commitment}
Nullifier Hash: ${note.nullifierHash}
Leaf Index: ${note.leafIndex}
Deposit ID: ${note.depositId || 'N/A'}
Timestamp: ${note.timestamp}

⚠️  IMPORTANT: Keep this note safe! You need it to withdraw your funds.
Never share the nullifier or secret with anyone.`;
}

/**
 * Parse note from JSON string
 * @param json - JSON string
 * @returns Parsed Tornado note
 * @throws NoteValidationError if invalid
 */
export function parseNoteFromJSON(json: string): TornadoNote {
  try {
    const parsed = JSON.parse(json);
    return validateNote(parsed);
  } catch (error) {
    if (error instanceof NoteValidationError) {
      throw error;
    }
    throw new NoteValidationError(
      "Invalid JSON format",
      { originalError: error }
    );
  }
}

/**
 * Parse note from uploaded file
 * @param file - File object
 * @returns Promise<TornadoNote>
 * @throws NoteValidationError if invalid
 */
export async function parseNoteFromFile(file: File): Promise<TornadoNote> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const note = parseNoteFromJSON(content);
        resolve(note);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new NoteValidationError("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

/**
 * Validate a Tornado note
 * @param note - Note object to validate
 * @returns Validated note
 * @throws NoteValidationError if invalid
 */
export function validateNote(note: any): TornadoNote {
  // Check required fields
  const requiredFields = [
    "version",
    "network",
    "contractAddress",
    "denomination",
    "nullifier",
    "secret",
    "commitment",
    "nullifierHash",
    "leafIndex",
    "timestamp",
  ];

  for (const field of requiredFields) {
    if (!(field in note)) {
      throw new NoteValidationError(`Missing required field: ${field}`);
    }
  }

  // Validate version
  if (note.version !== "1.0") {
    throw new NoteValidationError(
      `Unsupported note version: ${note.version}. Expected 1.0`
    );
  }

  // Validate BigInt fields
  const bigIntFields = ["nullifier", "secret", "commitment", "nullifierHash", "denomination"];
  for (const field of bigIntFields) {
    if (!isValidBigIntString(note[field])) {
      throw new NoteValidationError(`Invalid ${field}: must be a valid number`);
    }
  }

  // Validate addresses
  if (!note.contractAddress || typeof note.contractAddress !== "string") {
    throw new NoteValidationError("Invalid contract address");
  }

  // Validate leaf index
  if (!isValidBigIntString(note.leafIndex)) {
    throw new NoteValidationError("Invalid leaf index: must be a valid number");
  }

  // Validate timestamp
  try {
    new Date(note.timestamp);
  } catch {
    throw new NoteValidationError("Invalid timestamp");
  }

  return note as TornadoNote;
}

/**
 * Download note as JSON file
 * @param note - Tornado note
 * @param filename - Optional filename (default: tornado_note_[timestamp].json)
 */
export function downloadNote(note: TornadoNote, filename?: string): void {
  const json = formatNoteAsJSON(note);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `tornado_note_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Copy note to clipboard as JSON
 * @param note - Tornado note
 * @returns Promise<boolean> - True if successful
 */
export async function copyNoteToClipboard(note: TornadoNote): Promise<boolean> {
  try {
    const json = formatNoteAsJSON(note);
    await navigator.clipboard.writeText(json);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Extract note values from various input formats
 * Supports JSON or comma-separated values
 * @param input - Input string
 * @returns Partial note data
 * @throws NoteValidationError if invalid
 */
export function extractNoteValues(input: string): {
  nullifier?: string;
  secret?: string;
  commitment?: string;
  nullifierHash?: string;
  contractAddress?: string;
  denomination?: string;
  leafIndex?: string;
} {
  // Try JSON first
  try {
    const note = parseNoteFromJSON(input);
    return note;
  } catch {
    // Not JSON, try other formats
  }

  // Try comma-separated or line-separated values
  const lines = input.split(/[,\n]/).map(l => l.trim()).filter(Boolean);

  if (lines.length < 3) {
    throw new NoteValidationError(
      "Invalid input format. Expected JSON or comma/line-separated values (nullifier, secret, commitment, ...)"
    );
  }

  return {
    nullifier: lines[0],
    secret: lines[1],
    commitment: lines[2],
    nullifierHash: lines[3],
    contractAddress: lines[4],
    denomination: lines[5],
    leafIndex: lines[6],
  };
}

/**
 * Format a large number for display (abbreviate with ellipsis)
 * @param value - BigInt string
 * @param prefixLength - Number of characters to show at start
 * @param suffixLength - Number of characters to show at end
 * @returns Formatted string
 */
export function abbreviateBigInt(
  value: string,
  prefixLength: number = 8,
  suffixLength: number = 6
): string {
  if (value.length <= prefixLength + suffixLength + 3) {
    return value;
  }
  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}
