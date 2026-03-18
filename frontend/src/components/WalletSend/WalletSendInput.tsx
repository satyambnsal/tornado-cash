import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  ChevronDownIcon,
  DialogHeader,
  DialogTitle,
  Input,
  WalletIcon,
} from "../ui";
import type { FormattedAssetAmount } from "../../types/assets";
import { useAccountBalance } from "../../hooks/useAccountBalance";
import SpinnerV2 from "../ui/icons/SpinnerV2";

const XION_CONVERSION = 1000000;

interface WalletSendInputProps {
  selectedCurrency: FormattedAssetAmount;
  balances: FormattedAssetAmount[];
  onChangeCurrency: React.Dispatch<React.SetStateAction<string>>;
  selectedCurrencyDenom: string;
  sendAmount: string;
  amountError: string;
  onAmountChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  recipientAddressError: string;
  recipientAddress: string;
  userMemo: string;
  onUpdateRecipientAddress: (address: string) => void;
  onUpdateUserMemo: (memo: string) => void;
  onStart: () => void;
  updateSendAmount: (amount: string) => void;
}

export function WalletSendInput({
  balances,
  selectedCurrency,
  selectedCurrencyDenom,
  sendAmount,
  amountError,
  onAmountChange: handleAmountChange,
  recipientAddressError,
  recipientAddress,
  userMemo,
  onUpdateRecipientAddress,
  onUpdateUserMemo,
  onChangeCurrency,
  onStart,
  updateSendAmount,
}: WalletSendInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { getEstimatedSendFee } = useAccountBalance();
  const [estimatedFee, setEstimatedFee] = useState<{
    denom: string;
    amount: string;
  } | null>(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [estimatingError, setEstimatingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      getFee();
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [recipientAddress, sendAmount, selectedCurrencyDenom]);

  function switchSelectedCurrency(selectedDenom: string) {
    onChangeCurrency(selectedDenom);
    updateSendAmount("");
    setEstimatedFee(null);
    setShowDropdown(false);
    return;
  }

  const getFee = useCallback(async () => {
    if (!recipientAddress) {
      return;
    }
    let feeResult;

    try {
      if (sendAmount) {
        setIsCalculatingFee(true);
        feeResult = await getEstimatedSendFee(
          recipientAddress,
          sendAmount,
          selectedCurrencyDenom,
        );

        if (feeResult === null) {
          setIsCalculatingFee(false);
          return;
        }
      } else {
        setEstimatedFee(null);
      }

      if (feeResult) {
        const xionBalance = balances.find(
          (balance) => balance.symbol === "XION",
        );

        if (!xionBalance || !feeResult.fee) {
          setIsCalculatingFee(false);
          return;
        }

        let amountRequiredToSend: number;
        // When sending XION, we need to be sure there is enough balance to cover gas + amount remitted
        if (selectedCurrency.symbol === "XION") {
          const sendAmountWithoutDecimals =
            parseFloat(sendAmount) * Math.pow(10, xionBalance.decimals);
          amountRequiredToSend =
            parseInt(feeResult.fee.amount[0].amount) +
            sendAmountWithoutDecimals;
        } else {
          amountRequiredToSend = parseInt(feeResult.fee.amount[0].amount);
        }

        if (amountRequiredToSend > parseInt(xionBalance.baseAmount)) {
          setEstimatingError(
            `Insufficient XION balance to cover the transaction fee.`,
          );
          setIsCalculatingFee(false);
          return;
        }

        setEstimatedFee(feeResult.fee.amount[0]);
      }

      setEstimatingError(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage.includes("insufficient funds")) {
        setEstimatingError(
          `Insufficient ${selectedCurrency.symbol.toUpperCase()} balance`,
        );
      } else setEstimatingError("Error estimating fee");
    }

    setIsCalculatingFee(false);
  }, [recipientAddress, sendAmount, selectedCurrencyDenom]);

  const TokenRow = ({
    imageUrl,
    symbol,
    value,
    dollarValue,
  }: {
    imageUrl: string;
    symbol: string;
    value: number | undefined;
    dollarValue: number | undefined;
  }) => {
    return (
      <div className="ui-flex ui-items-center ui-gap-2.5">
        <img className="ui-w-[40px] ui-h-[40px]" src={imageUrl} />

        <div className="ui-flex ui-flex-col ui-items-start ui-gap-1">
          <p className="ui-text-body ui-font-bold">
            {symbol.toUpperCase()}
          </p>
          <p className="ui-text-caption ui-leading-none ui-flex ui-items-center ui-gap-1.5">
            <WalletIcon
              color="currentColor"
              backgroundColor="hsl(var(--background))"
              width={14}
              height={12}
            />
            {(value ?? 0).toFixed(2)}
            <span className="ui-h-[3px] ui-w-[3px] ui-rounded-full ui-bg-text-secondary" />
            <span className="ui-text-secondary-text">
              ${(dollarValue ?? 0).toFixed(2)} USD
            </span>
          </p>
        </div>
      </div>
    );
  };

  const currencyDropdown = () => {
    return (
      <div className="ui-relative">
        <div
          className={`ui-flex ui-items-center ui-justify-between ui-p-4 ui-bg-surface-page hover:ui-cursor-pointer hover:ui-bg-surface-page ui-relative ui-z-10 ui-transition-all ui-duration-300 ${
            showDropdown ? "ui-rounded-tr-lg ui-rounded-tl-lg" : "ui-rounded-lg"
          }`}
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <TokenRow
            imageUrl={selectedCurrency.imageUrl}
            symbol={selectedCurrency.symbol}
            value={selectedCurrency.value}
            dollarValue={selectedCurrency.dollarValue}
          />
          <ChevronDownIcon isUp={showDropdown} className="ui-w-5 ui-h-5" />
        </div>

        {/* Dropdown Values - iterate over balances that are not the selected currency */}
        <div
          className={`${
            showDropdown
              ? "ui-absolute ui-left-0 ui-opacity-100 ui-translate-y-0"
              : "ui-absolute ui-left-0 -ui-translate-y-full ui-opacity-0"
          } ui-w-full ui-rounded-bl-lg ui-rounded-br-lg ui-bg-surface ui-border-t ui-border-surface-border ui-z-0 ui-shadow-[0_6px_12px_4px_rgba(0,0,0,0.1)]
          ui-transition-[opacity_300ms,transform_300ms]`}
        >
          {balances.map((balance, index) => {
            if (balance.symbol === selectedCurrency.symbol) return null;
            const isLast =
              index ===
              balances.filter((b) => b.symbol !== selectedCurrency.symbol)
                .length;

            return (
              <div
                className={`ui-flex ui-items-center ui-p-4 hover:ui-cursor-pointer hover:ui-bg-surface-page ui-transition-all ui-duration-300 ${
                  isLast ? "ui-rounded-b-lg" : ""
                }`}
                key={index + balance.symbol}
                onClick={() => switchSelectedCurrency(balance.asset.base)}
              >
                <TokenRow
                  imageUrl={balance.imageUrl}
                  symbol={balance.symbol}
                  value={balance.value}
                  dollarValue={balance.dollarValue}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  function renderEstimatedFee() {
    if (isCalculatingFee) {
      return (
        <div className="ui-text-secondary-text">Calculating Gas Fee...</div>
      );
    }
    if (estimatingError) {
      return <div className="ui-text-destructive">{estimatingError}</div>;
    }
    if (!estimatedFee) return;

    return (
      <>
        <div className="ui-text-secondary-text">Estimated fee</div>
        <div className="ui-text-secondary-text">
          {(parseInt(estimatedFee.amount) / XION_CONVERSION).toFixed(6)} XION
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ui-flex ui-flex-col ui-p-0 ui-gap-y-6 ui-max-h-full">
        <DialogHeader>
          <DialogTitle>Send</DialogTitle>
        </DialogHeader>
        <div className="ui-flex ui-flex-col ui-gap-6 ui-mt-1.5">
          {currencyDropdown()}
          <div className="ui-flex ui-flex-col ui-gap-2.5 -ui-mb-4">
            <div className="ui-flex ui-justify-between ui-px-1">
              <p className="ui-text-body ui-font-bold">Amount</p>
              <p className="ui-text-secondary-text">
                =$
                {(Number(sendAmount) * selectedCurrency.price).toFixed(2)} USD
              </p>
            </div>
            <div
              className={`ui-flex ui-items-center ui-justify-between ui-gap-1.5 ui-px-6 ui-py-4 ui-border ${
                amountError ? "ui-border-destructive" : "ui-border-border"
              } ui-rounded-[12px]`}
            >
              <input
                className={`ui-w-full ui-bg-transparent ui-no-spinner ${
                  sendAmount === "0" && "!ui-text-secondary-text"
                } ui-font-bold ui-text-5xl !ui-h-[48px] placeholder:ui-text-secondary-text focus:ui-outline-none`}
                onChange={(e) => {
                  handleAmountChange(e);
                }}
                placeholder="0"
                type="number"
                inputMode="decimal"
                value={sendAmount}
              />
              <p className="ui-text-5xl ui-font-bold ui-text-secondary-text">
                {selectedCurrency.symbol.toUpperCase()}
              </p>
            </div>
            <p className="ui-text-destructive ui-h-5 ui-text-caption ui-pl-1">
              {amountError}
            </p>
          </div>
        </div>
        <Input
          data-testid="recipient-input"
          error={recipientAddress ? recipientAddressError : ""}
          onChange={(e) => {
            onUpdateRecipientAddress(e.target.value);
          }}
          placeholder="Recipient Address"
          value={recipientAddress}
        />
        <Input
          data-testid="memo-input"
          onChange={(e) => onUpdateUserMemo(e.target.value)}
          placeholder="Memo (Optional)"
          value={userMemo}
        />
        <div className="ui-flex ui-flex-col ui-gap-2.5 ui-mt-1.5">
          <div className="ui-flex ui-items-center ui-text-body ui-justify-between ui-h-5">
            {renderEstimatedFee()}
          </div>

          <Button
            disabled={
              !!estimatingError ||
              isCalculatingFee ||
              !recipientAddress ||
              !sendAmount
            }
            onClick={() => {
              setIsLoading(true);
              onStart();
            }}
            className=""
          >
            {isLoading ? <SpinnerV2 size="sm" color="black" /> : "REVIEW"}
          </Button>
        </div>
      </div>
    </>
  );
}
