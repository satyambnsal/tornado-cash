import { describe, it, expect, vi } from "vitest";
import {
  decodeJwt,
  extractAbstractAccountFromJwt,
  extractCustomClaims,
} from "../../utils/jwt-decoder";

describe("decodeJwt", () => {
  it("decodes a valid JWT", () => {
    // Header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
    // Payload: {"sub":"1234567890","name":"John Doe","iat":1516239022} -> eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
    // Signature: SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

    const decoded = decodeJwt(jwt);
    expect(decoded).toEqual({
      sub: "1234567890",
      name: "John Doe",
      iat: 1516239022,
    });
  });

  it("returns null for invalid JWT format (not 3 parts)", () => {
    const jwt = "invalid.jwt";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(decodeJwt(jwt)).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith("Invalid JWT format");
    consoleSpy.mockRestore();
  });

  it("returns null for invalid base64", () => {
    const jwt = "header.invalid-payload.signature";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(decodeJwt(jwt)).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("extractAbstractAccountFromJwt", () => {
  it("extracts abstract account info when present", () => {
    const payload = {
      abstract_account_address: "xion123",
      abstract_account_transaction_hash: "0xabc",
    };
    const encodedPayload = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const jwt = `header.${encodedPayload}.signature`;

    const result = extractAbstractAccountFromJwt(jwt);
    expect(result).toEqual({
      address: "xion123",
      txHash: "0xabc",
    });
  });

  it("returns nulls when fields are missing", () => {
    const payload = {
      other: "field",
    };
    const encodedPayload = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const jwt = `header.${encodedPayload}.signature`;

    const result = extractAbstractAccountFromJwt(jwt);
    expect(result).toEqual({
      address: null,
      txHash: null,
    });
  });

  it("returns null when decoding fails", () => {
    const jwt = "invalid";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(extractAbstractAccountFromJwt(jwt)).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe("extractCustomClaims", () => {
  it("extracts only custom claims", () => {
    const payload = {
      sub: "123",
      name: "John",
      custom_claim: "value",
      another_custom: 123,
    };
    const encodedPayload = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const jwt = `header.${encodedPayload}.signature`;

    const result = extractCustomClaims(jwt);
    expect(result).toEqual({
      custom_claim: "value",
      another_custom: 123,
    });
  });

  it("returns empty object when decoding fails", () => {
    const jwt = "invalid";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(extractCustomClaims(jwt)).toEqual({});
    consoleSpy.mockRestore();
  });
});
