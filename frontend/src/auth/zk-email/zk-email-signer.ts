import { DirectSignResponse, makeSignBytes } from "@cosmjs/proto-signing";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { AAccountData, AASigner, AAAlgo } from "@burnt-labs/signers";
import {
  verifyEmailWithZKEmail,
  getZKEmailStatusMessage,
  pollZKEmailStatusUntilComplete,
  ZK_EMAIL_STATUS,
  ZK_EMAIL_POLL_INTERVAL_MS,
  ZK_EMAIL_PROOF_TIMEOUT_MS,
} from "../utils/zk-email";
import {
  setZKEmailSigningStatus,
  getZKEmailSigningAbortController,
  getZKEmailTurnstileTokenProvider,
} from "./zk-email-signing-status";
import { toUrlSafeBase64 } from "@burnt-labs/signers/crypto";

/**
 * This class is an implementation of the AASigner interface using ZK-Email.
 * Proofs and publicInputs are generated at sign time (when a transaction is
 * being signed), using the same flow as the ZK-Email authenticator: send
 * command (sign bytes) to backend, user confirms via email, then proof is
 * polled and used to produce the signature.
 *
 * @abstractAccount the abstract account address of the signer
 * @accountAuthenticatorIndex the index of the abstract account authenticator
 * @email user's email (from session, set at ZK-Email login)
 * @implements AASigner
 */
export class AAZKEmailSigner extends AASigner {
  constructor(
    abstractAccount: string,
    public accountAuthenticatorIndex: number,
    /** User's email from session (set at login); used to request proof at sign time */
    public readonly email: string,
  ) {
    super(abstractAccount);
  }

  async signDirect(
    _signerAddress: string,
    signDoc: SignDoc,
  ): Promise<DirectSignResponse> {
    if (!this.abstractAccount) {
      throw new Error("ZK-Email signer: abstract account is required");
    }
    if (!this.email?.trim()) {
      throw new Error(
        "ZK-Email signer: email is required (set at login for signing)",
      );
    }

    // Command endpoint always requires a Turnstile token; get it from the provider set by the signing UI.
    const getToken = getZKEmailTurnstileTokenProvider();
    if (!getToken) {
      setZKEmailSigningStatus({
        phase: "error",
        message: "Security verification is required. Please try again.",
      });
      throw new Error(
        "ZK-Email signing requires Turnstile token. Ensure the signing UI has Turnstile configured and setZKEmailTurnstileTokenProvider is called.",
      );
    }
    let turnstileToken: string;
    try {
      turnstileToken = await getToken();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to complete security verification.";
      setZKEmailSigningStatus({ phase: "error", message });
      throw new Error(message);
    }

    const signBytes = makeSignBytes(signDoc);
    const command = toUrlSafeBase64(btoa(String.fromCharCode(...signBytes)));

    const data = await verifyEmailWithZKEmail(
      this.email.trim(),
      command,
      this.abstractAccount,
      turnstileToken,
    );
    if (!data.success || !data.proofId) {
      setZKEmailSigningStatus({
        phase: "error",
        message:
          data.error || "Failed to send ZK-Email verification for signing",
      });
      throw new Error(
        data.error || "Failed to send ZK-Email verification for signing",
      );
    }

    // Session may have been abandoned while command was in flight (e.g. user closed modal).
    // If so, do not start polling.
    const abortController = getZKEmailSigningAbortController();
    if (!abortController || abortController.signal.aborted) {
      setZKEmailSigningStatus(null);
      throw new Error("Polling cancelled");
    }
    const signal = abortController.signal;
    setZKEmailSigningStatus({
      phase: "in_progress",
      message: getZKEmailStatusMessage(
        ZK_EMAIL_STATUS.email_sent_awaiting_reply,
      ),
    });

    try {
      const statusResponse = await pollZKEmailStatusUntilComplete(
        data.proofId,
        {
          signal,
          timeoutMs: ZK_EMAIL_PROOF_TIMEOUT_MS,
          pollIntervalMs: ZK_EMAIL_POLL_INTERVAL_MS,
          onStatus: (res) =>
            setZKEmailSigningStatus({
              phase: "in_progress",
              message: getZKEmailStatusMessage(res.status),
              detail:
                res.status === ZK_EMAIL_STATUS.email_replied
                  ? "Generating zero-knowledge proof. This may take 10-30 seconds."
                  : undefined,
            }),
        },
      );
      setZKEmailSigningStatus({
        phase: "success",
        message: "Proof generated successfully!",
      });
      const proofStr = JSON.stringify(statusResponse.proof!.proof);
      const publicInputsStr = JSON.stringify(
        statusResponse.proof!.publicInputs,
      );
      return this.buildDirectSignResponse(signDoc, proofStr, publicInputsStr);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Signing failed. Please try again.";
      if (message === "Polling cancelled") {
        setZKEmailSigningStatus(null);
      } else {
        setZKEmailSigningStatus({ phase: "error", message });
      }
      throw err;
    }
  }

  /**
   * Build DirectSignResponse from proof and publicInputs (JSON strings).
   * Validates proof/publicInputs shape and encodes signature for chain.
   */
  private buildDirectSignResponse(
    signDoc: SignDoc,
    proofTrimmed: string,
    publicInputsTrimmed: string,
  ): DirectSignResponse {
    if (!proofTrimmed || !publicInputsTrimmed) {
      throw new Error(
        "ZK-Email signer: proof and publicInputs are required and must be non-empty",
      );
    }

    // Proof format: { curve?, pi_a, pi_b, pi_c, protocol?, ... }
    let proofData: {
      curve?: string;
      pi_a?: unknown;
      pi_b?: unknown;
      pi_c?: unknown;
      protocol?: string;
      [key: string]: unknown;
    };
    let publicInputsParsed: unknown;

    try {
      proofData = JSON.parse(proofTrimmed.trim()) as typeof proofData;
      publicInputsParsed = JSON.parse(publicInputsTrimmed.trim());
    } catch (parseErr) {
      const detail =
        parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[ZK-Email signer] JSON parse error:", parseErr);
      throw new Error(
        `ZK-Email signer: proof and publicInputs must be valid JSON. ${detail}`,
      );
    }

    // Validate proof is an object
    if (!proofData || typeof proofData !== "object") {
      throw new Error("ZK-Email signer: proof must be a JSON object");
    }

    // pi_a: non-empty array of strings
    if (!Array.isArray(proofData.pi_a) || proofData.pi_a.length === 0) {
      throw new Error(
        "ZK-Email signer: proof.pi_a must be a non-empty array of strings",
      );
    }
    if (!proofData.pi_a.every((x) => typeof x === "string")) {
      throw new Error("ZK-Email signer: proof.pi_a must contain only strings");
    }

    // pi_b: array of 3 elements, each an array of 2 strings
    if (!Array.isArray(proofData.pi_b) || proofData.pi_b.length !== 3) {
      throw new Error(
        "ZK-Email signer: proof.pi_b must be an array of 3 elements",
      );
    }
    for (let i = 0; i < proofData.pi_b.length; i++) {
      const row = proofData.pi_b[i];
      if (
        !Array.isArray(row) ||
        row.length !== 2 ||
        typeof row[0] !== "string" ||
        typeof row[1] !== "string"
      ) {
        throw new Error(
          `ZK-Email signer: proof.pi_b[${i}] must be an array of 2 strings`,
        );
      }
    }

    // pi_c: non-empty array of strings
    if (!Array.isArray(proofData.pi_c) || proofData.pi_c.length === 0) {
      throw new Error(
        "ZK-Email signer: proof.pi_c must be a non-empty array of strings",
      );
    }
    if (!proofData.pi_c.every((x) => typeof x === "string")) {
      throw new Error("ZK-Email signer: proof.pi_c must contain only strings");
    }

    // publicInputs: array of strings
    if (!Array.isArray(publicInputsParsed)) {
      throw new Error(
        "ZK-Email signer: publicInputs must be a JSON array of strings",
      );
    }
    if (!publicInputsParsed.every((x) => typeof x === "string")) {
      throw new Error(
        "ZK-Email signer: publicInputs must contain only strings",
      );
    }

    const publicInputsValidated = publicInputsParsed as string[];

    // Create the combined signature structure (preserve optional proof fields: curve, protocol, etc.)
    const zkEmailSignature = {
      proof: {
        ...proofData,
        pi_a: proofData.pi_a,
        pi_b: proofData.pi_b,
        pi_c: proofData.pi_c,
        protocol: proofData.protocol ?? "groth16",
      },
      publicInputs: publicInputsValidated,
    };

    // Convert to base64 for transmission
    const signatureJson = JSON.stringify(zkEmailSignature);
    const base64Signature = Buffer.from(signatureJson, "utf-8").toString(
      "base64",
    );

    return {
      signed: signDoc,
      signature: {
        pub_key: {
          type: "tendermint/PubKeySecp256k1",
          value: "", // This doesn't matter for ZK-Email
        },
        signature: base64Signature,
      },
    };
  }

  async getAccounts(): Promise<readonly AAccountData[]> {
    if (this.abstractAccount === undefined) {
      return [];
    }

    // Note: algo is set to secp256k1 for interface compatibility, but ZK-Email
    // doesn't use traditional key-based signing. The actual signature is a
    // ZK proof + public inputs, handled in buildDirectSignResponse().
    // The SmartAccount contract expects ZKEmail authenticator format per:
    // https://github.com/burnt-labs/xion/blob/main/x/xion/types/authenticator_zkemail.go
    return [
      {
        address: this.abstractAccount,
        algo: "secp256k1", // Interface compatibility; ZK-Email uses proof-based auth
        pubkey: new Uint8Array(), // No pubkey for ZK-Email
        authenticatorId: this.accountAuthenticatorIndex,
        accountAddress: this.abstractAccount,
        aaalgo: AAAlgo.ZKEmail,
      },
    ];
  }
}
