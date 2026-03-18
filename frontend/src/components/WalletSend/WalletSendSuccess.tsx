import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui";
import type { FormattedAssetAmount } from "../../types/assets";
import { SelectedSmartAccount } from "../../types/wallet-account-types";
import { truncateAddress } from "../../utils";
import { InteractiveTooltip } from "../ui/tooltip";
import { ExternalLinkIcon } from "../ui/icons/ExternalLink";
import { getExplorerTxUrl, getExplorerAddressUrl } from "../../config";

interface WalletSendSuccessProps {
  sendAmount: string;
  selectedCurrency: FormattedAssetAmount;
  userMemo: string;
  account: SelectedSmartAccount;
  recipientAddress: string;
  onFinish: () => void;
  transactionHash: string;
}

export function WalletSendSuccess({
  sendAmount,
  selectedCurrency,
  userMemo,
  account,
  recipientAddress,
  onFinish,
  transactionHash,
}: WalletSendSuccessProps) {
  const handleConfirmClick = () => {
    onFinish();
  };

  return (
    <>
      <div className="ui-p-0 ui-flex ui-flex-col ui-gap-6 max-h-full ui-h-full">
        <DialogHeader>
          <DialogTitle>Success!</DialogTitle>
          <DialogDescription>
            You have initiated the transaction below.
          </DialogDescription>
        </DialogHeader>

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
                    {selectedCurrency.asset.display.toUpperCase()}
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

        <div className="ui-flex ui-flex-col ui-gap-4">
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

          <div className="ui-flex ui-flex-col ui-gap-4 ui-p-4 ui-rounded-lg ui-bg-surface-page">
            <div className="ui-flex ui-justify-between ui-gap-1.5">
              <p className="ui-text-label">Transaction Link</p>
              <a
                href={getExplorerTxUrl(transactionHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-text-body ui-text-cta hover:ui-underline ui-inline-block"
              >
                View on Explorer
                <ExternalLinkIcon
                  size={16}
                  className="ui-inline-block ui-align-text-bottom ui-ml-1"
                />
              </a>
            </div>
          </div>
        </div>

        <Button
          onClick={() => handleConfirmClick()}
          className="ui-mt-1.5"
        >
          CLOSE
        </Button>
      </div>
    </>
  );
}
