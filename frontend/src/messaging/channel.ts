import type { MessageResponse } from "./types";

/**
 * Utility class for sending responses via MessageChannel
 */
export class MessageChannelResponder {
  /**
   * Send a success response
   */
  static sendSuccess<T>(port: MessagePort, data: T): void {
    const response: MessageResponse<T> = {
      success: true,
      data,
    };
    port.postMessage(response);
  }

  /**
   * Send an error response
   */
  static sendError(port: MessagePort, error: string, code?: string): void {
    const response: MessageResponse = {
      success: false,
      error,
      code,
    };
    port.postMessage(response);
  }
}
