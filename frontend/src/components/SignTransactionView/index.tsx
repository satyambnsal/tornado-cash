import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui";
import { Separator } from "../ui/separator";
import { useSmartAccount, useSigningClient } from "../../hooks";
import { useQueryParams } from "../../hooks/useQueryParams";
import SpinnerV2 from "../ui/icons/SpinnerV2";
import AnimatedCheckmark from "../ui/icons/AnimatedCheck";
import AnimatedX from "../ui/icons/AnimatedX";
import { ChevronDownIcon } from "../ui/icons/ChevronDown";
import { truncateAddress, formatXionAmount } from "../../utils";
import { fromBase64 } from "@burnt-labs/signers";
import xionLogo from "../../assets/logo.png";
import { SecuredByXion } from "../ui/SecuredByXion";
import { DashboardMessageType } from "../../messaging/types";

interface DecodedTxPayload {
  messages: Array<{ typeUrl: string; value: unknown }>;
  fee: unknown;
  memo?: string;
}

/**
 * Decode the base64-encoded transaction payload from the URL.
 * Returns null if the payload is missing or malformed.
 */
function decodeTxPayload(encoded: string | null | undefined): DecodedTxPayload | null {
  if (!encoded) return null;
  try {
    const json = fromBase64(encoded);
    const parsed = JSON.parse(json);
    if (!parsed.messages || !Array.isArray(parsed.messages)) return null;
    return parsed as DecodedTxPayload;
  } catch (err) {
    console.error("[SignTransactionView] Failed to decode tx payload:", err);
    return null;
  }
}

/**
 * Produce a human-readable summary for common message types.
 *
 * TODO: Add summaries for more Cosmos SDK / CosmWasm message types as dApps
 * start using them through direct signing. Candidates include:
 * - /cosmos.staking.v1beta1.MsgDelegate / MsgUndelegate / MsgBeginRedelegate
 * - /cosmos.gov.v1beta1.MsgVote
 * - /cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward
 * - /cosmwasm.wasm.v1.MsgInstantiateContract / MsgMigrateContract
 * - /ibc.applications.transfer.v1.MsgTransfer
 * - /cosmos.authz.v1beta1.MsgGrant / MsgRevoke / MsgExec
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cosmos SDK messages are polymorphic
function summarizeMessage(msg: { typeUrl: string; value: any }): string {
  switch (msg.typeUrl) {
    case "/cosmos.bank.v1beta1.MsgSend": {
      const v = msg.value;
      const amount = v?.amount?.[0];
      if (amount) {
        return `Send ${formatXionAmount(amount.amount, amount.denom)} to ${truncateAddress(v.toAddress)}`;
      }
      return `Send tokens to ${truncateAddress(v?.toAddress ?? "unknown")}`;
    }
    case "/cosmwasm.wasm.v1.MsgExecuteContract":
      return `Execute contract ${truncateAddress(msg.value?.contract ?? "unknown")}`;
    default:
      return msg.typeUrl.split(".").pop() ?? msg.typeUrl;
  }
}

interface SignTransactionViewProps {
  /** Transaction data passed directly (iframe mode). Falls back to URL params when absent. */
  transaction?: DecodedTxPayload;
  /** Granter address passed directly (iframe mode). Falls back to URL params when absent. */
  granterAddress?: string;
  /** When provided, results are delivered via this callback instead of postMessage/redirect. */
  onResult?: (data: Record<string, unknown>) => void;
}

/**
 * SignTransactionView
 *
 * Displays transaction details, lets the user approve or deny, signs with
 * the user's meta-account authenticator, broadcasts, and sends the result
 * back to the dApp.
 *
 * Used in popup mode (tx data from URL params, result via postMessage) and
 * inline iframe mode (tx data from props, result via onResult callback).
 */
export function SignTransactionView({ transaction: txProp, granterAddress, onResult }: SignTransactionViewProps = {}) {
  const { tx, granter: granterParam, redirect_uri } = useQueryParams(["tx", "granter", "redirect_uri"]);
  const { client, getGasCalculation } = useSigningClient();
  const { data: account } = useSmartAccount();

  // Props take precedence over URL params (iframe mode vs popup mode)
  const granter = granterAddress ?? granterParam;

  const [inProgress, setInProgress] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);

  const payload = useMemo(() => txProp ?? decodeTxPayload(tx), [txProp, tx]);

  // Fetch meta-account balance once client is available
  useEffect(() => {
    if (!client || !granter) return;
    client
      .getBalance(granter, "uxion")
      .then((b) => setBalance(b.amount))
      .catch((err) => {
        console.warn("[SignTransactionView] Failed to fetch balance:", err);
        setBalance(null);
      });
  }, [client, granter]);

  // Estimate fee via simulation
  useEffect(() => {
    if (!client || !granter || !payload) return;
    client
      .simulate(granter, payload.messages, payload.memo ?? "")
      .then((simmedGas) => {
        const fee = getGasCalculation(simmedGas);
        if (fee) {
          const feeAmount = fee.amount[0];
          if (feeAmount) {
            setEstimatedFee(formatXionAmount(feeAmount.amount, feeAmount.denom));
          }
        }
      })
      .catch((err) => {
        console.warn("[SignTransactionView] Failed to estimate fee:", err);
        setEstimatedFee(null);
      });
  }, [client, granter, payload, getGasCalculation]);

  const balanceDisplay = balance !== null ? formatXionAmount(balance, "uxion") : null;
  const isLowBalance = balance !== null && Number(balance) < 50_000; // < 0.05 XION

  // ----- Result delivery -----
  const sendResult = (data: Record<string, unknown>) => {
    // Callback path (iframe mode): deliver via onResult prop
    if (onResult) {
      onResult(data);
      return;
    }

    // Popup path: opener exists → postMessage + close
    if (window.opener && redirect_uri) {
      try {
        const targetOrigin = new URL(redirect_uri).origin;
        window.opener.postMessage(data, targetOrigin);
      } catch (err) {
        console.warn("[SignTransactionView] postMessage to opener failed:", err);
      }
      setTimeout(
        () => window.close(),
        data.type === DashboardMessageType.SIGN_SUCCESS ? 1200 : 150,
      );
      return;
    }

    // Redirect path: no opener (mobile / redirect mode) → navigate back
    if (redirect_uri) {
      try {
        const url = new URL(redirect_uri);
        if (data.type === DashboardMessageType.SIGN_SUCCESS && data.txHash) {
          url.searchParams.set("tx_hash", data.txHash as string);
        } else if (data.type === DashboardMessageType.SIGN_REJECTED) {
          url.searchParams.set("sign_rejected", "true");
        } else if (data.type === DashboardMessageType.SIGN_ERROR) {
          url.searchParams.set(
            "sign_error",
            (data.message as string) || "Transaction failed",
          );
        }
        window.location.href = url.toString();
      } catch (err) {
        console.error("[SignTransactionView] Failed to redirect after transaction:", err);
      }
    }
  };

  // ----- Approve -----
  const handleApprove = async () => {
    if (!client || !account || !payload || !granter) return;

    setInProgress(true);
    setError(null);

    try {
      // Simulate to get gas estimate
      const simmedGas = await client.simulate(granter, payload.messages, payload.memo ?? "");
      const fee = getGasCalculation(simmedGas);

      const result = await client.signAndBroadcast(
        granter,
        payload.messages,
        fee || "auto",
        payload.memo,
      );

      setTxHash(result.transactionHash);
      setShowSuccess(true);

      sendResult({ type: DashboardMessageType.SIGN_SUCCESS, txHash: result.transactionHash });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setError(message);
      sendResult({ type: DashboardMessageType.SIGN_ERROR, message });
    } finally {
      setInProgress(false);
    }
  };

  // ----- Deny -----
  const handleDeny = () => {
    sendResult({ type: DashboardMessageType.SIGN_REJECTED });
  };

  // ----- Account mismatch guard -----
  const accountMismatch = granter && account && granter !== account.id;

  if (accountMismatch) {
    return (
      <div className="ui-flex ui-flex-col ui-items-center ui-py-16 ui-text-center">
        <AnimatedX />
        <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Account mismatch</h2>
        <p className="ui-mt-1.5 ui-text-body ui-text-text-muted ui-max-w-[360px]">
          The application expects account {truncateAddress(granter)} but your dashboard is
          signed in as {truncateAddress(account.id)}.
        </p>
        <p className="ui-mt-3 ui-text-caption ui-text-text-muted ui-max-w-[360px]">
          Please reconnect from the application to resolve this.
        </p>
        <Button className="ui-w-full ui-mt-6" onClick={handleDeny}>
          Cancel
        </Button>
      </div>
    );
  }

  // ----- Invalid payload -----
  if (!payload) {
    return (
      <div className="ui-flex ui-flex-col ui-items-center ui-py-16 ui-text-center">
        <AnimatedX />
        <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Invalid transaction</h2>
        <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">
          The transaction data is missing or malformed.
        </p>
        <Button className="ui-w-full ui-mt-6" onClick={() => window.close()}>
          Close
        </Button>
      </div>
    );
  }

  // ----- Waiting for signing client -----
  if (!client || !account) {
    return (
      <div className="ui-flex ui-flex-col ui-items-center ui-py-28 ui-text-center">
        <SpinnerV2 size="lg" color="blue" />
        <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Loading...</h2>
        <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">
          Preparing signing session
        </p>
      </div>
    );
  }

  // ----- Success -----
  if (showSuccess) {
    return (
      <div className="ui-flex ui-flex-col ui-items-center ui-py-28 ui-text-center">
        <AnimatedCheckmark />
        <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Transaction sent</h2>
        <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">
          This window will close automatically.
        </p>
        {txHash && (
          <p className="ui-mt-2 ui-text-caption ui-text-text-muted ui-break-all ui-max-w-[360px]">
            {txHash}
          </p>
        )}
        <img src={xionLogo} alt="XION" width="90" height="32" className="ui-mx-auto ui-mt-10 ui-brightness-0" />
      </div>
    );
  }

  // ----- Signing in progress -----
  if (inProgress) {
    return (
      <div className="ui-flex ui-flex-col ui-items-center ui-py-28 ui-text-center">
        <SpinnerV2 size="lg" color="blue" />
        <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Signing transaction...</h2>
        <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">
          Please wait while your transaction is confirmed.
        </p>
      </div>
    );
  }

  // ----- Error -----
  if (error) {
    return (
      <div className="ui-flex ui-flex-col ui-items-center ui-py-16 ui-text-center">
        <AnimatedX />
        <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Transaction failed</h2>
        <p className="ui-mt-1.5 ui-text-body ui-text-text-muted ui-max-w-[360px]">
          {error}
        </p>
        <div className="ui-mt-6 ui-flex ui-flex-col ui-items-center ui-gap-2.5 ui-w-full">
          <Button className="ui-w-full" onClick={() => { setError(null); handleApprove(); }}>
            Try again
          </Button>
          <Button variant="text" size="text" onClick={handleDeny}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ----- Approval UI -----
  return (
    <div className="ui-animate-scale-in ui-flex ui-flex-col ui-min-h-full">
      {/* Header */}
      <div className="ui-flex ui-flex-col ui-items-center ui-text-center">
        <h2 className="ui-text-title ui-text-text-primary">Approve transaction</h2>
        <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">
          An application is requesting you to sign a transaction.
        </p>
      </div>

      <Separator className="ui-my-4" />

      {/* Toggle: Actions / Raw Payload */}
      <button
        type="button"
        onClick={() => setShowRawPayload((v) => !v)}
        className="ui-flex ui-items-center ui-gap-1.5 ui-cursor-pointer ui-group ui-mb-2"
      >
        <p className="ui-text-caption ui-text-text-muted ui-uppercase ui-tracking-wide ui-font-semibold">
          {showRawPayload ? "Raw Payload" : "Actions"}
        </p>
        <ChevronDownIcon
          isUp={showRawPayload}
          className="ui-h-3.5 ui-w-3.5 ui-text-text-muted group-hover:ui-text-text-primary"
        />
      </button>

      {/* Fixed-height region: collapsed content holds size, raw payload overlays */}
      <div className="ui-relative">
        {/* Always rendered (invisible when expanded) to preserve layout height */}
        <div className={showRawPayload ? "ui-invisible" : ""}>
          <div className="ui-rounded-xl ui-border ui-border-surface-border ui-bg-surface-page ui-p-3 ui-space-y-2">
            {payload.messages.map((msg, i) => (
              <div key={i} className="ui-flex ui-items-start ui-gap-2">
                <span className="ui-text-body ui-text-text-primary ui-font-medium">
                  {i + 1}.
                </span>
                <span className="ui-text-body ui-text-text-primary">
                  {summarizeMessage(msg)}
                </span>
              </div>
            ))}
          </div>

          <Separator className="ui-my-4" />

          <div className="ui-flex ui-items-center ui-justify-between">
            <p className="ui-text-caption ui-text-text-muted">Account</p>
            <p className="ui-text-caption ui-text-text-primary ui-font-mono">
              {truncateAddress(granter ?? "")}
            </p>
          </div>
          <div className="ui-mt-1 ui-flex ui-items-center ui-justify-between">
            <p className="ui-text-caption ui-text-text-muted">Balance</p>
            <p className={`ui-text-caption ui-font-mono ${isLowBalance ? "ui-text-accent-error" : "ui-text-text-primary"}`}>
              {balanceDisplay ?? "Loading..."}
            </p>
          </div>
          <div className="ui-mt-1 ui-flex ui-items-center ui-justify-between">
            <p className="ui-text-caption ui-text-text-muted">Est. Fee</p>
            <p className="ui-text-caption ui-text-text-primary ui-font-mono">
              {estimatedFee ?? "Estimating..."}
            </p>
          </div>

          {payload.memo && (
            <div className="ui-mt-1 ui-flex ui-items-center ui-justify-between">
              <p className="ui-text-caption ui-text-text-muted">Memo</p>
              <p className="ui-text-caption ui-text-text-primary ui-truncate ui-max-w-[200px]">
                {payload.memo}
              </p>
            </div>
          )}

          {isLowBalance && (
            <div className="ui-mt-3 ui-p-3 ui-bg-amber-50 ui-border ui-border-amber-400 ui-rounded-xl">
              <p className="ui-text-caption ui-text-amber-700 ui-font-medium">
                Low balance. You may not have enough XION to pay gas fees.
              </p>
            </div>
          )}
        </div>

        {/* Raw payload overlay — fills exact same space */}
        {showRawPayload && (
          <div className="ui-absolute ui-inset-0 ui-rounded-xl ui-border ui-border-surface-border ui-bg-surface-page ui-p-3 ui-overflow-auto">
            <pre className="ui-text-caption ui-leading-relaxed ui-font-mono ui-text-text-muted ui-whitespace-pre-wrap ui-break-all">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <Separator className="ui-my-4" />

      {/* Actions */}
      <div className="ui-flex ui-flex-col ui-items-center ui-gap-2.5">
        <Button className="ui-w-full" onClick={handleApprove} disabled={!client || isLowBalance}>
          Approve
        </Button>
        <Button variant="text" size="text" onClick={handleDeny}>
          Deny
        </Button>
      </div>

      {/* Footer */}
      <div className="ui-mt-auto ui-pt-6">
        <SecuredByXion />
      </div>
    </div>
  );
}
