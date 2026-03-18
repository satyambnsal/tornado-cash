// Single source of truth — import shared protocol types from the SDK package.
// If the SDK adds a new message type or changes a payload shape, TypeScript
// will surface errors here and in handler.ts until the dashboard is updated.
import { IframeMessageType } from "@burnt-labs/abstraxion-core";
export {
  IframeMessageType,
  DashboardMessageType,
  type ConnectPayload,
  type ConnectResponse,
  type SignTransactionPayload,
  type SignTransactionResponse,
  type SignAndBroadcastResult,
  type GetAddressResponse,
  type AddAuthenticatorPayload,
  type AddAuthenticatorResponse,
  type RemoveAuthenticatorPayload,
  type RemoveAuthenticatorResponse,
  type RequestGrantPayload,
  type RequestGrantResponse,
  type MessageResponse,
} from "@burnt-labs/abstraxion-core";

/**
 * Valid message targets for iframe communication
 */
export const VALID_MESSAGE_TARGETS = ["xion_iframe", "xion_sdk"] as const;
export type MessageTarget = (typeof VALID_MESSAGE_TARGETS)[number];

/**
 * Generic message structure received from SDK
 */
export interface IframeMessage<T = unknown> {
  type: IframeMessageType;
  target?: MessageTarget;
  payload?: T;
  requestId?: string;
}

/**
 * Disconnect response (no data) — not in SDK types, dashboard-specific
 */
export type DisconnectResponse = Record<string, never>;
