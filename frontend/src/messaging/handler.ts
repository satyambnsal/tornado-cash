import { MessageChannelResponder } from "./channel";
import { VALID_MESSAGE_TARGETS, IframeMessageType } from "./types";
import type {
  IframeMessage,
  ConnectPayload,
  ConnectResponse,
  SignTransactionPayload,
  SignTransactionResponse,
  SignAndBroadcastResult,
  GetAddressResponse,
  DisconnectResponse,
  AddAuthenticatorPayload,
  AddAuthenticatorResponse,
  RemoveAuthenticatorPayload,
  RemoveAuthenticatorResponse,
  RequestGrantPayload,
  RequestGrantResponse,
  MessageTarget,
} from "./types";

/**
 * Callbacks for handling different message types
 */
export interface MessageHandlerCallbacks {
  /** Called when SDK requests authentication */
  onConnect: (origin: string, payload?: ConnectPayload) => Promise<ConnectResponse>;
  /** Called when SDK requests transaction signing */
  onSignTransaction: (
    origin: string,
    payload: SignTransactionPayload,
  ) => Promise<SignTransactionResponse>;
  /** Called when SDK requests transaction signing and broadcasting */
  onSignAndBroadcast: (
    origin: string,
    payload: SignTransactionPayload,
  ) => Promise<{ signedTx: SignAndBroadcastResult }>;
  /** Called when SDK requests current address */
  onGetAddress: (origin: string) => GetAddressResponse;
  /** Called when SDK requests disconnect */
  onDisconnect: (origin: string) => Promise<DisconnectResponse>;
  /** Called when SDK requests to add an authenticator */
  onAddAuthenticator: (
    origin: string,
    payload: AddAuthenticatorPayload,
  ) => Promise<AddAuthenticatorResponse>;
  /** Called when SDK requests to remove an authenticator */
  onRemoveAuthenticator: (
    origin: string,
    payload: RemoveAuthenticatorPayload,
  ) => Promise<RemoveAuthenticatorResponse>;
  /** Called when SDK requests treasury grant permissions */
  onRequestGrant: (
    origin: string,
    payload: RequestGrantPayload,
  ) => Promise<RequestGrantResponse>;
}

/**
 * Rate limit state per origin
 */
interface RateLimitState {
  count: number;
  resetAt: number;
}

/**
 * Handles incoming messages from the parent SDK
 * Routes messages to appropriate handlers and sends responses via MessageChannel
 */
export class IframeMessageHandler {
  private boundHandler: (event: MessageEvent) => Promise<void>;
  private rateLimiter = new Map<string, RateLimitState>();
  private processedRequests = new Set<string>();
  private cleanupInterval?: number;

  // Rate limit configuration
  private readonly MAX_REQUESTS_PER_WINDOW = 20; // requests
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
  private readonly MAX_PAYLOAD_SIZE = 100000; // 100KB
  private readonly MAX_PROCESSED_REQUESTS = 1000; // Prevent memory leak

  /** If set, only accept messages from this origin (the embedding dApp's origin from redirect_uri). */
  private allowedOrigin: string | null;

  constructor(private callbacks: MessageHandlerCallbacks, allowedOrigin?: string) {
    this.allowedOrigin = allowedOrigin ?? null;
    this.boundHandler = this.handleMessage.bind(this);
    this.setupListener();

    // Clean up old rate limit entries every 5 minutes
    this.cleanupInterval = window.setInterval(
      () => this.cleanupRateLimiter(),
      300000,
    );
  }

  /**
   * Set up the message listener on window
   */
  private setupListener(): void {
    window.addEventListener("message", this.boundHandler);
  }

  /**
   * Validate origin is from allowed domain
   * NOTE: Iframe is open to ANY origin - restrictions are only on SDK usage
   */
  private isAllowedOrigin(origin: string): boolean {
    // Defense-in-depth: if redirect_uri was provided, only accept messages from that origin.
    // This blocks other scripts/iframes on the same page from sending messages to us,
    // but does NOT prevent the embedder themselves (they control redirect_uri).
    // The real security boundary is user interaction (login, grant approval, tx confirmation).
    if (this.allowedOrigin) {
      return origin === this.allowedOrigin;
    }
    // No redirect_uri provided (standalone dashboard) — accept any origin.
    return true;
  }

  /**
   * Enforce HTTPS in production
   */
  private isSecureOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);

      // Allow http for localhost development
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return true;
      }

      // Require HTTPS for all other origins
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Check if origin is within rate limit
   */
  private checkRateLimit(origin: string): boolean {
    const now = Date.now();
    const limit = this.rateLimiter.get(origin);

    if (!limit || now > limit.resetAt) {
      // Reset or initialize
      this.rateLimiter.set(origin, {
        count: 1,
        resetAt: now + this.RATE_LIMIT_WINDOW,
      });
      return true;
    }

    if (limit.count >= this.MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Validate message payload size
   */
  private validatePayloadSize(message: IframeMessage): boolean {
    try {
      const size = JSON.stringify(message).length;
      return size <= this.MAX_PAYLOAD_SIZE;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimiter(): void {
    const now = Date.now();
    for (const [origin, limit] of this.rateLimiter.entries()) {
      if (now > limit.resetAt) {
        this.rateLimiter.delete(origin);
      }
    }
  }

  /**
   * Main message handler - routes to appropriate callback based on message type
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    // Get the MessagePort from the event (sent via transferable)
    const port = event.ports[0];
    if (!port) {
      // Message not from SDK (no MessageChannel port)
      return;
    }

    const message = event.data as IframeMessage;

    // Require a valid message target — the SDK always sets target.
    // Messages without a target (e.g. unrelated postMessage traffic) are ignored.
    if (
      !message.target ||
      !VALID_MESSAGE_TARGETS.includes(message.target as MessageTarget)
    ) {
      return;
    }

    // Capture and validate origin
    const origin = event.origin;
    if (!origin || origin === "null") {
      MessageChannelResponder.sendError(
        port,
        "Invalid origin",
        "INVALID_ORIGIN",
      );
      return;
    }

    // Validate origin is from allowed domain
    if (!this.isAllowedOrigin(origin)) {
      console.warn(
        `[Iframe] Rejected request from unauthorized origin: ${origin}`,
      );
      MessageChannelResponder.sendError(
        port,
        "Origin not allowed. Must be from *.testnet.burnt.com or *.mainnet.burnt.com",
        "FORBIDDEN_ORIGIN",
      );
      return;
    }

    // Enforce HTTPS in production
    if (!this.isSecureOrigin(origin)) {
      console.warn(`[Iframe] Rejected insecure origin: ${origin}`);
      MessageChannelResponder.sendError(
        port,
        "HTTPS required",
        "INSECURE_ORIGIN",
      );
      return;
    }

    // Check rate limit
    if (!this.checkRateLimit(origin)) {
      console.warn(`[Iframe] Rate limit exceeded for origin: ${origin}`);
      MessageChannelResponder.sendError(
        port,
        "Too many requests. Please try again later.",
        "RATE_LIMIT_EXCEEDED",
      );
      return;
    }

    // Validate payload size
    if (!this.validatePayloadSize(message)) {
      console.warn(`[Iframe] Payload too large from origin: ${origin}`);
      MessageChannelResponder.sendError(
        port,
        "Request payload too large",
        "PAYLOAD_TOO_LARGE",
      );
      return;
    }

    // Require requestId — the SDK always provides one.
    // Reject messages without it to prevent replay and spoofing.
    if (!message.requestId) {
      MessageChannelResponder.sendError(
        port,
        "Missing requestId",
        "MISSING_REQUEST_ID",
      );
      return;
    }

    // Check for duplicate request ID (replay attack protection)
    if (this.processedRequests.has(message.requestId)) {
      console.warn(
        `[Iframe] Duplicate request ID detected: ${message.requestId}`,
      );
      MessageChannelResponder.sendError(
        port,
        "Duplicate request",
        "DUPLICATE_REQUEST",
      );
      return;
    }

    // Mark request as processed
    this.processedRequests.add(message.requestId);

    // Prevent memory leak - remove oldest if over limit
    if (this.processedRequests.size > this.MAX_PROCESSED_REQUESTS) {
      const firstId = this.processedRequests.values().next().value;
      if (firstId) {
        this.processedRequests.delete(firstId);
      }
    }

    // Log request for monitoring (non-blocking)
    this.logRequest(origin, message.type);

    try {
      switch (message.type) {
        case IframeMessageType.CONNECT:
          await this.handleConnect(port, origin, message.payload as ConnectPayload | undefined);
          break;

        case IframeMessageType.SIGN_TRANSACTION:
          await this.handleSignTransaction(
            message.payload as SignTransactionPayload,
            port,
            origin,
          );
          break;

        case IframeMessageType.SIGN_AND_BROADCAST:
          await this.handleSignAndBroadcast(
            message.payload as SignTransactionPayload,
            port,
            origin,
          );
          break;

        case IframeMessageType.GET_ADDRESS:
          this.handleGetAddress(port, origin);
          break;

        case IframeMessageType.DISCONNECT:
        case IframeMessageType.HARD_DISCONNECT:
          await this.handleDisconnect(port, origin);
          break;

        case IframeMessageType.ADD_AUTHENTICATOR:
          await this.handleAddAuthenticator(
            message.payload as AddAuthenticatorPayload,
            port,
            origin,
          );
          break;

        case IframeMessageType.REMOVE_AUTHENTICATOR:
          await this.handleRemoveAuthenticator(
            message.payload as RemoveAuthenticatorPayload,
            port,
            origin,
          );
          break;

        case IframeMessageType.REQUEST_GRANT:
          await this.handleRequestGrant(message.payload as RequestGrantPayload, port, origin);
          break;

        // These types are dashboard → SDK only; the SDK should never send them inbound.
        case IframeMessageType.IFRAME_READY:
        case IframeMessageType.MODAL_STATE_CHANGE:
          MessageChannelResponder.sendError(
            port,
            `Message type ${message.type} is dashboard-to-SDK only`,
            "UNKNOWN_MESSAGE_TYPE",
          );
          break;

        default: {
          // Exhaustive check: TypeScript errors here if a new IframeMessageType value
          // is added to @burnt-labs/abstraxion-core without a case above.
          const _exhaustive: never = message.type;
          MessageChannelResponder.sendError(
            port,
            `Unknown message type: ${_exhaustive}`,
            "UNKNOWN_MESSAGE_TYPE",
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[Iframe] Error handling message:", errorMessage);
      MessageChannelResponder.sendError(port, errorMessage, "HANDLER_ERROR");
    }
  }

  /**
   * Log request for monitoring and analytics
   * Non-blocking - errors are caught silently
   */
  private logRequest(origin: string, messageType: string): void {
    try {
      // Simple console logging for now
      // In production, this could send to analytics service
      console.debug(`[Iframe] Request from ${origin}: ${messageType}`);

      // Could extend to track usage patterns:
      // - Count requests per origin
      // - Track authentication success/failure rates
      // - Monitor for suspicious patterns
    } catch {
      // Silently ignore logging errors
    }
  }

  /**
   * Handle CONNECT request
   * Triggers authentication flow and returns user's address
   */
  private async handleConnect(
    port: MessagePort,
    origin: string,
    payload?: ConnectPayload,
  ): Promise<void> {
    try {
      const response = await this.callbacks.onConnect(origin, payload);
      MessageChannelResponder.sendSuccess(port, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Authentication failed";
      MessageChannelResponder.sendError(port, errorMessage, "AUTH_FAILED");
    }
  }

  /**
   * Handle SIGN_TRANSACTION request
   * Shows signing modal and returns signed transaction
   */
  private async handleSignTransaction(
    payload: SignTransactionPayload,
    port: MessagePort,
    origin: string,
  ): Promise<void> {
    if (!payload || !payload.transaction || !payload.signerAddress) {
      MessageChannelResponder.sendError(
        port,
        "Missing transaction data or signerAddress",
        "INVALID_PAYLOAD",
      );
      return;
    }

    try {
      const response = await this.callbacks.onSignTransaction(origin, payload);
      MessageChannelResponder.sendSuccess(port, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Signing failed";
      MessageChannelResponder.sendError(port, errorMessage, "SIGNING_FAILED");
    }
  }

  /**
   * Handle SIGN_AND_BROADCAST request
   * Shows signing modal, signs, and broadcasts transaction
   */
  private async handleSignAndBroadcast(
    payload: SignTransactionPayload,
    port: MessagePort,
    origin: string,
  ): Promise<void> {
    if (!payload || !payload.transaction || !payload.signerAddress) {
      MessageChannelResponder.sendError(
        port,
        "Missing transaction data or signerAddress",
        "INVALID_PAYLOAD",
      );
      return;
    }

    try {
      const response = await this.callbacks.onSignAndBroadcast(origin, payload);
      MessageChannelResponder.sendSuccess(port, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Transaction failed";
      MessageChannelResponder.sendError(
        port,
        errorMessage,
        "TRANSACTION_FAILED",
      );
    }
  }

  /**
   * Handle GET_ADDRESS request
   * Returns current address if authenticated
   */
  private handleGetAddress(port: MessagePort, origin: string): void {
    try {
      const response = this.callbacks.onGetAddress(origin);
      MessageChannelResponder.sendSuccess(port, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get address";
      MessageChannelResponder.sendError(
        port,
        errorMessage,
        "GET_ADDRESS_FAILED",
      );
    }
  }

  /**
   * Handle DISCONNECT request
   * Clears session and returns success
   */
  private async handleDisconnect(
    port: MessagePort,
    origin: string,
  ): Promise<void> {
    try {
      const response = await this.callbacks.onDisconnect(origin);
      MessageChannelResponder.sendSuccess(port, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Disconnect failed";
      MessageChannelResponder.sendError(
        port,
        errorMessage,
        "DISCONNECT_FAILED",
      );
    }
  }

  /**
   * Handle add authenticator request
   */
  private async handleAddAuthenticator(
    payload: AddAuthenticatorPayload,
    port: MessagePort,
    origin: string,
  ): Promise<void> {
    try {
      const response = await this.callbacks.onAddAuthenticator(origin, payload);
      MessageChannelResponder.sendSuccess(port, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add authenticator";
      MessageChannelResponder.sendError(
        port,
        errorMessage,
        "ADD_AUTHENTICATOR_FAILED",
      );
    }
  }

  /**
   * Handle remove authenticator request
   */
  private async handleRemoveAuthenticator(
    payload: RemoveAuthenticatorPayload,
    port: MessagePort,
    origin: string,
  ): Promise<void> {
    try {
      const response = await this.callbacks.onRemoveAuthenticator(
        origin,
        payload,
      );
      MessageChannelResponder.sendSuccess(port, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to remove authenticator";
      MessageChannelResponder.sendError(
        port,
        errorMessage,
        "REMOVE_AUTHENTICATOR_FAILED",
      );
    }
  }

  /**
   * Handle request grant request
   */
  private async handleRequestGrant(
    payload: RequestGrantPayload,
    port: MessagePort,
    origin: string,
  ): Promise<void> {
    try {
      const response = await this.callbacks.onRequestGrant(origin, payload);
      MessageChannelResponder.sendSuccess(port, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to request grant";
      MessageChannelResponder.sendError(
        port,
        errorMessage,
        "REQUEST_GRANT_FAILED",
      );
    }
  }

  /**
   * Cleanup - remove event listeners and clear resources
   */
  destroy(): void {
    window.removeEventListener("message", this.boundHandler);

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Clear rate limiter
    this.rateLimiter.clear();

    // Clear processed requests
    this.processedRequests.clear();
  }
}
