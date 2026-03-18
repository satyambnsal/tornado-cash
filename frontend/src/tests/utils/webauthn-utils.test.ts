import { describe, it, expect, beforeEach } from "vitest";
import {
  getRegistrations,
  saveRegistration,
  registeredCredentials,
  convertToStandardBase64,
  toUrlSafeBase64,
  removeRegistration,
} from "../../auth/passkey";

describe("webauthn-utils", () => {
  const STORAGE_KEY = "xionStoredPasskeys";
  const mockAddress = "xion1addr";
  const mockRegistration = {
    id: "mock-id",
    rawId: "mock-raw-id",
    response: {
      clientDataJSON: "mock-client-data",
      attestationObject: "mock-attestation",
    },
    type: "public-key",
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  } as unknown as PublicKeyCredential;

  beforeEach(() => {
    localStorage.clear();
  });

  describe("getRegistrations", () => {
    it("returns empty array if no registrations", () => {
      expect(getRegistrations(mockAddress)).toEqual([]);
    });

    it("returns registrations for address", () => {
      const storage = { [mockAddress]: [mockRegistration] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
      expect(getRegistrations(mockAddress)).toEqual([mockRegistration]);
    });
  });

  describe("saveRegistration", () => {
    it("saves new registration", () => {
      saveRegistration(mockAddress, mockRegistration);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored[mockAddress]).toEqual([mockRegistration]);
    });

    it("appends to existing registrations", () => {
      const existing = { ...mockRegistration, id: "existing" };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ [mockAddress]: [existing] }),
      );

      saveRegistration(mockAddress, mockRegistration);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored[mockAddress]).toHaveLength(2);
      expect(stored[mockAddress][1]).toEqual(mockRegistration);
    });
  });

  describe("registeredCredentials", () => {
    it("returns credentials for specific address", () => {
      const storage = { [mockAddress]: [mockRegistration] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));

      const creds = registeredCredentials(mockAddress);
      expect(creds).toHaveLength(1);
      expect(creds[0].type).toBe("public-key");
      // id is converted to buffer, check length or content
      expect(new Uint8Array(creds[0].id).length).toBeGreaterThan(0);
    });

    it("returns all credentials if no address provided", () => {
      const storage = {
        [mockAddress]: [mockRegistration],
        other: [{ ...mockRegistration, id: "other-id" }],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));

      const creds = registeredCredentials();
      expect(creds).toHaveLength(2);
    });
  });

  describe("base64 utils", () => {
    it("converts to standard base64", () => {
      expect(convertToStandardBase64("a-b_c")).toBe("a+b/c===");
    });

    it("converts to url safe base64", () => {
      expect(toUrlSafeBase64("a+b/c=")).toBe("a-b_c");
    });
  });

  describe("removeRegistration", () => {
    it("removes specific registration", () => {
      const reg1 = { ...mockRegistration, id: "id1" };
      const reg2 = { ...mockRegistration, id: "id2" };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ [mockAddress]: [reg1, reg2] }),
      );

      // id1 is url safe base64, so we pass the id that matches what's stored (or decoded?)
      // The util expects credentialId to be passed, and it compares with toUrlSafeBase64(credentialId)
      // Wait, the util does: reg.id !== toUrlSafeBase64(credentialId)
      // So if stored id is "id1" (already url safe), and we pass "id1" (assuming it's standard base64?),
      // toUrlSafeBase64("id1") -> "id1".

      removeRegistration(mockAddress, "id1");

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored[mockAddress]).toHaveLength(1);
      expect(stored[mockAddress][0].id).toBe("id2");
    });

    it("removes address key if no registrations left", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ [mockAddress]: [mockRegistration] }),
      );
      removeRegistration(mockAddress, "mock-id");

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored[mockAddress]).toBeUndefined();
    });

    it("does nothing if address has no registrations", () => {
      removeRegistration(mockAddress, "some-id");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored[mockAddress]).toBeUndefined();
    });
  });
});
