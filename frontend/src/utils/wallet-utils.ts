import {
  normalizeEthereumAddress,
  validateEthereumAddress,
  formatEthSignature,
  formatSecp256k1Signature,
  validateBech32Address,
} from "@burnt-labs/signers/crypto";

export class WalletAccountError extends Error {
  constructor(
    message: string,
    public userMessage: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = "WalletAccountError";
  }
}

/**
 * Converts technical errors to simple user messages
 */
export function getErrorMessageForUI(error: unknown): string {
  if (error instanceof WalletAccountError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("user rejected") || message.includes("user denied")) {
      return "Signature cancelled";
    }

    if (message.includes("not installed")) {
      return "Wallet not found";
    }

    if (message.includes("pubkey recovered from signature does not match")) {
      return "Signature verification failed";
    }

    if (message.includes("signature is invalid")) {
      return "Invalid signature";
    }

    if (message.includes("authorization not found")) {
      return "Service error. Please contact support";
    }

    if (message.includes("fee-grant not found")) {
      return "Fee grant not found. Please contact support";
    }

    if (message.includes("account already exists")) {
      return "Account already exists";
    }

    if (message.includes("network") || message.includes("fetch")) {
      return "Network error. Check your connection";
    }
  }

  return "Something went wrong. Please try again";
}

/**
 * Gets Ethereum wallet address from MetaMask
 */
export async function getEthWalletAddress(): Promise<string> {
  try {
    if (!window.ethereum) {
      throw new WalletAccountError(
        "MetaMask not installed",
        "MetaMask wallet not found. Please install MetaMask and try again.",
      );
    }

    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new WalletAccountError(
        "No accounts found",
        "No MetaMask accounts found. Please unlock your wallet and try again.",
      );
    }

    const address = accounts[0];

    // Validate and normalize address using signers utilities
    validateEthereumAddress(address); // Throws if invalid
    return normalizeEthereumAddress(address); // Lowercase with 0x prefix
  } catch (error) {
    if (error instanceof WalletAccountError) {
      throw error;
    }
    throw new WalletAccountError(
      "Failed to get Ethereum address",
      getErrorMessageForUI(error),
      error,
    );
  }
}

/**
 * Gets Secp256k1 public key from Cosmos wallets (Keplr/OKX)
 */
export async function getSecp256k1Pubkey(
  chainId: string,
  walletName: "keplr" | "okx" = "keplr",
): Promise<{ pubkeyHex: string; pubkeyBase64: string; address: string }> {
  try {
    let wallet: NonNullable<Window["keplr"]>;

    switch (walletName) {
      case "keplr":
        if (!window.keplr) {
          throw new WalletAccountError(
            "Keplr not installed",
            "Keplr wallet not found. Please install Keplr and try again.",
          );
        }
        wallet = window.keplr;
        break;
      case "okx":
        if (!window.okxwallet) {
          throw new WalletAccountError(
            "OKX not installed",
            "OKX wallet not found. Please install OKX Wallet and try again.",
          );
        }
        if (window.okxwallet?.keplr) {
          await window.okxwallet.keplr.enable(chainId);
          wallet = window.okxwallet.keplr;
        } else {
          throw new WalletAccountError(
            "OKX Keplr integration not found",
            "OKX Wallet configuration error. Please try again.",
          );
        }
        break;
    }

    const key = await wallet.getKey(chainId);

    if (!key || !key.pubKey) {
      throw new WalletAccountError(
        "No public key found",
        "Could not get wallet public key. Please try again.",
      );
    }

    // Convert Uint8Array to both hex and base64
    const pubkeyHex = Array.from(key.pubKey as Uint8Array)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");

    const pubkeyBase64 = Buffer.from(key.pubKey as Uint8Array).toString(
      "base64",
    );

    // Validate the bech32 address format
    validateBech32Address(key.bech32Address, "wallet address");

    return {
      pubkeyHex,
      pubkeyBase64,
      address: key.bech32Address,
    };
  } catch (error) {
    if (error instanceof WalletAccountError) {
      throw error;
    }
    throw new WalletAccountError(
      "Failed to get public key",
      getErrorMessageForUI(error),
      error,
    );
  }
}

/**
 * Signs a message with Ethereum wallet (MetaMask)
 */
export async function signWithEthWallet(
  message: string,
  userAddress: string,
): Promise<string> {
  try {
    if (!window.ethereum) {
      throw new WalletAccountError(
        "MetaMask not installed",
        "MetaMask wallet not found.",
      );
    }

    const signature = (await window.ethereum.request({
      method: "personal_sign",
      params: [message, userAddress],
    })) as string;

    if (!signature) {
      throw new WalletAccountError(
        "No signature returned",
        "Failed to get signature from wallet.",
      );
    }

    // Validate and format signature using signers utilities
    // This ensures it's properly formatted (0x-prefixed, 65 bytes)
    return formatEthSignature(signature);
  } catch (error) {
    if (error instanceof WalletAccountError) {
      throw error;
    }
    throw new WalletAccountError(
      "Failed to sign with Ethereum wallet",
      getErrorMessageForUI(error),
      error,
    );
  }
}

/**
 * Signs a message with Cosmos wallet (Keplr/OKX)
 *
 * Uses Keplr's signArbitrary which creates an ADR-036 wrapped signature.
 * The backend verification (in @burnt-labs/signers) now supports both:
 * - Plain SHA256 signatures (for programmatic signers)
 * - ADR-036 wrapped signatures (for Keplr/OKX)
 *
 * @param message - Plain text message to sign (typically a bech32 address like "xion1...")
 * @param chainId - Chain ID for the wallet
 * @param userAddress - User's wallet address
 * @param walletName - Which wallet to use (keplr or okx)
 * @returns Signature in hex format
 */
export async function signWithSecp256k1Wallet(
  message: string,
  chainId: string,
  userAddress: string,
  walletName: "keplr" | "okx" = "keplr",
): Promise<string> {
  try {
    let wallet: NonNullable<Window["keplr"]>;

    switch (walletName) {
      case "keplr":
        if (!window.keplr) {
          throw new WalletAccountError(
            "Keplr not installed",
            "Keplr wallet not found.",
          );
        }
        wallet = window.keplr;
        break;
      case "okx":
        if (!window.okxwallet?.keplr) {
          throw new WalletAccountError(
            "OKX not installed",
            "OKX wallet not found.",
          );
        }
        wallet = window.okxwallet.keplr;
        break;
    }

    // Use Keplr's signArbitrary to create an ADR-036 wrapped signature
    // The backend's verifySecp256k1Signature now handles ADR-036 verification
    const signArbResult = await wallet.signArbitrary(
      chainId,
      userAddress,
      message,
    );

    if (!signArbResult || !signArbResult.signature) {
      throw new WalletAccountError(
        "No signature returned",
        "Failed to get signature from wallet.",
      );
    }

    // Convert base64 signature to hex and validate format using signers utilities
    // This ensures it's properly formatted (64 bytes for secp256k1)
    return formatSecp256k1Signature(signArbResult.signature);
  } catch (error) {
    if (error instanceof WalletAccountError) {
      throw error;
    }
    throw new WalletAccountError(
      "Failed to sign with Cosmos wallet",
      getErrorMessageForUI(error),
      error,
    );
  }
}
