import { useContext } from "react";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui";
import { SelectedSmartAccount } from "../../types/wallet-account-types";
import { FormattedAssetAmount } from "../../types/assets";
import SpinnerV2 from "../ui/icons/SpinnerV2";
import { ChevronRightIcon } from "../ui/icons/ChevronRight";
import { truncateAddress } from "../../utils";
import { cn } from "../../utils/classname-util";
import { InteractiveTooltip } from "../ui/tooltip";
import { ExternalLinkIcon } from "../ui/icons/ExternalLink";
import { WarningIcon } from "../ui/icons";
import { getExplorerAddressUrl } from "../../config";
import { AuthContext, AuthContextProps } from "../AuthContext";
import { ZKEmailAuthenticatorStatus } from "../ModalViews/AddAuthenticators/ZKEmailAuthenticatorStatus";
import { useZKEmailSigningStatus } from "../../hooks/useZKEmailSigningStatus";
import { useZKEmailTurnstileProvider } from "../../hooks/useZKEmailTurnstileProvider";
import { CONNECTION_METHOD } from "../../auth/AuthStateManager";

interface WalletSendReviewProps {
  sendAmount: string;
  selectedCurrency: FormattedAssetAmount;
  account: SelectedSmartAccount;
  userMemo: string;
  recipientAddress: string;
  onBack: () => void;
  triggerSend: () => Promise<void>;
  isLoading: boolean;
}

export function WalletSendReview({
  sendAmount,
  selectedCurrency,
  account,
  userMemo,
  recipientAddress,
  isLoading,
  onBack,
  triggerSend,
}: WalletSendReviewProps) {
  const { connectionMethod } = useContext(AuthContext) as AuthContextProps;
  const isUsingZKEmail = connectionMethod === CONNECTION_METHOD.ZKEmail;
  const zkEmailSigningStatus = useZKEmailSigningStatus(isUsingZKEmail);
  const { renderTurnstile } = useZKEmailTurnstileProvider(isUsingZKEmail);

  const handleBackClick = () => {
    onBack();
  };

  const handleProceedClick = () => {
    triggerSend();
  };

  return (
    <>
      <div className="ui-p-0 ui-flex ui-flex-col ui-gap-6 ui-max-h-full ui-h-full">
        <DialogHeader>
          <DialogTitle>Review</DialogTitle>
          <DialogDescription>
            You are about to make the transaction below.
          </DialogDescription>
        </DialogHeader>

        {zkEmailSigningStatus && (
          <ZKEmailAuthenticatorStatus
            phase={zkEmailSigningStatus.phase}
            message={zkEmailSigningStatus.message}
            detail={zkEmailSigningStatus.detail}
          />
        )}

        <div className="ui-flex ui-flex-col ui-gap-6">
          <div className="ui-h-[1px] ui-w-full ui-bg-border" />

          <div className="ui-flex ui-flex-col ui-gap-6">
            <div className="ui-flex ui-flex-col ui-gap-2.5">
              <p className="ui-w-full ui-text-center ui-text-label ui-text-secondary-text">
                Transfer Amount
              </p>
              <div className="ui-flex ui-flex-col ui-gap-2.5">
                <p className="ui-w-full ui-text-center ui-text-[40px] ui-leading-none ui-font-bold">
                  {sendAmount}{" "}
                  <span className="ui-text-[40px] ui-leading-none">
                    {selectedCurrency.symbol.toUpperCase()}
                  </span>
                </p>
                <p className="ui-w-full ui-text-center ui-text-body ui-text-secondary-text">
                  ${(Number(sendAmount) * selectedCurrency.price).toFixed(2)}{" "}
                  USD
                </p>
              </div>
            </div>
          </div>

          <div className="ui-h-[1px] ui-w-full ui-bg-border" />
        </div>

        <div className="ui-flex ui-flex-col ui-gap-4 ui-p-4 ui-rounded-lg ui-bg-surface-page">
          <div className="ui-flex ui-items-center ui-justify-between ui-gap-1.5">
            <h5 className="ui-text-body">From</h5>
            <InteractiveTooltip
              content={
                <a
                  href={getExplorerAddressUrl(account.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-text-body ui-text-text-secondary hover:ui-underline ui-inline-block"
                >
                  <span className="ui-break-all ui-inline">{account.id}</span>
                  <ExternalLinkIcon
                    size={16}
                    className="ui-inline-block ui-align-text-bottom ui-ml-1"
                  />
                </a>
              }
            >
              <p className="ui-text-label">
                {truncateAddress(account.id, 8, 8)}
              </p>
            </InteractiveTooltip>
          </div>

          <div className="ui-flex ui-items-center ui-justify-between ui-gap-1.5">
            <h5 className="ui-text-body">To</h5>
            <InteractiveTooltip
              content={
                <a
                  href={getExplorerAddressUrl(recipientAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-text-body ui-text-text-secondary hover:ui-underline ui-inline-block"
                >
                  <span className="ui-break-all ui-inline">
                    {recipientAddress}
                  </span>
                  <ExternalLinkIcon
                    size={16}
                    className="ui-inline-block ui-align-text-bottom ui-ml-1"
                  />
                </a>
              }
            >
              <p className="ui-text-label">
                {truncateAddress(recipientAddress, 8, 8)}
              </p>
            </InteractiveTooltip>
          </div>

          {userMemo && (
            <div className="ui-flex ui-items-start ui-justify-between ui-gap-1.5 ui-flex-wrap">
              <h5 className="ui-text-body">Memo</h5>
              <p className="ui-text-label ui-max-w-[50%] ui-break-words ui-text-end">
                {userMemo}
              </p>
            </div>
          )}
        </div>

        {/* USDC on Xion is not supported by exchanges, the below renders a small warning message for the user */}
        {selectedCurrency.symbol === "USDC" && (
          <div className="ui-w-full ui-p-4 ui-bg-amber-50 ui-border ui-border-amber-400 ui-rounded-xl">
            <div className="ui-flex ui-items-center ui-gap-1.5">
              <WarningIcon className="ui-h-5 ui-w-5 ui-text-amber-600 ui-flex-shrink-0" />
              <p className="ui-text-body ui-font-medium ui-text-amber-700 ui-text-center">
                Centralized exchanges may not support this type of asset. Avoid
                transferring to centralized exchanges.
              </p>
            </div>
          </div>
        )}

        {renderTurnstile()}

        <div className="ui-flex ui-gap-2.5">
          <Button
            variant="secondary"
            size="icon-large"
            className={cn("ui-group/basebutton", {
              "ui-opacity-50 ui-cursor-not-allowed": isLoading,
            })}
            onClick={handleBackClick}
            disabled={isLoading}
          >
            <div className="ui-flex ui-items-center ui-justify-center">
              <ChevronRightIcon className="ui-fill-text-secondary ui-rotate-180 group-hover/basebutton:ui-fill-text-primary" />
              <ChevronRightIcon className="ui-fill-text-secondary ui-rotate-180 group-hover/basebutton:ui-fill-text-primary" />
            </div>
          </Button>
          <Button
            disabled={isLoading}
            onClick={handleProceedClick}
            className="ui-w-full"
          >
            {isLoading ? <SpinnerV2 size="sm" color="black" /> : "CONFIRM"}
          </Button>
        </div>
      </div>
    </>
  );
}
