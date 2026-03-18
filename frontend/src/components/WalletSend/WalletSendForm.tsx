import React, {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AnimatedX from "../ui/icons/AnimatedX";
import { Button } from "../ui";
import { useSmartAccount, useSigningClient } from "../../hooks";
import { validateBech32Address } from "../../utils";
import { WalletSendInput } from "./WalletSendInput";
import { WalletSendReview } from "./WalletSendReview";
import { WalletSendSuccess } from "./WalletSendSuccess";
import { useAccountBalance } from "../../hooks/useAccountBalance";
import { WalletSendWarning } from "./WalletSendWarning";
import { AuthContext, AuthContextProps } from "../AuthContext";
import {
  setZKEmailSigningAbortController,
  setZKEmailSigningStatus,
} from "../../auth/zk-email/zk-email-signing-status";
import { CONNECTION_METHOD } from "../../auth/useAuthState";

export function WalletSendForm({
  setIsOpen,
}: {
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { data: account } = useSmartAccount();
  const { balances, sendTokens, getBalanceByDenom } = useAccountBalance();

  const [selectedCurrencyDenom, setSelectedCurrencyDenom] = useState("uxion");
  const selectedCurrency = getBalanceByDenom(selectedCurrencyDenom);

  const [sendAmount, setSendAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientAddressError, setRecipientAddressError] = useState("");
  const [userMemo, setUserMemo] = useState("");

  const [isOnReviewStep, setIsOnReviewStep] = useState(false);
  const [isOnWarningStep, setIsOnWarningStep] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sendTokensError, setSendTokensError] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");

  const { connectionMethod } = useContext(AuthContext) as AuthContextProps;
  const client = useSigningClient();

  // When on review step with zk-email, set abort controller so closing modal or going back stops polling
  useEffect(() => {
    if (!isOnReviewStep || connectionMethod !== CONNECTION_METHOD.ZKEmail)
      return;
    setZKEmailSigningStatus(null);
    const controller = new AbortController();
    setZKEmailSigningAbortController(controller);
    return () => {
      controller.abort();
      setZKEmailSigningAbortController(null);
      setZKEmailSigningStatus(null);
    };
  }, [isOnReviewStep, connectionMethod]);

  const validateAmount = useCallback(() => {
    if (!sendAmount || sendAmount === "0") {
      return;
    }

    if (selectedCurrency?.value === undefined) {
      setAmountError("Selected currency value is undefined");
      return;
    } else if (Number(sendAmount) > selectedCurrency.value) {
      setAmountError("Input is greater than your current balance");
      return;
    } else {
      setAmountError("");
    }
  }, [sendAmount, selectedCurrency?.value]);

  function updateSendAmount(inputValue: string) {
    // replace commas with periods for decimal input
    inputValue = inputValue.replace(/,/g, ".");

    // remove any non-numeric characters except for the decimal point
    inputValue = inputValue.replace(/[^0-9.]/g, "");

    // ensure only one decimal point is present
    const parts = inputValue.split(".");
    if (parts.length > 2) {
      inputValue = parts[0] + "." + parts.slice(1).join("");
    }

    // limit decimal places to the number of decimals for the selected asset
    if (
      parts.length === 2 &&
      selectedCurrency &&
      selectedCurrency.decimals !== undefined
    ) {
      const decimals = selectedCurrency.decimals;
      if (parts[1].length > decimals) {
        parts[1] = parts[1].substring(0, decimals);
        inputValue = parts[0] + (decimals > 0 ? "." + parts[1] : "");
      }
    }

    // If input is empty, set sendAmount to an empty string
    if (!inputValue) {
      setSendAmount("");
      setAmountError("");
    } else {
      setSendAmount(inputValue);
    }
  }

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const inputValue = event.target.value;

    updateSendAmount(inputValue);
  }

  // Debounce the amount validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validateAmount();
    }, 500);

    return () => clearTimeout(timer);
  }, [sendAmount, validateAmount]);

  async function isExistingAddress(address: string) {
    try {
      return await client?.client?.getAccount(address);
    } catch {
      setIsOnWarningStep(true);
      return false;
    }
  }

  function checkSendAmountInput() {
    if (
      selectedCurrency?.value &&
      Number(sendAmount) > selectedCurrency.value &&
      sendAmount !== ""
    ) {
      setAmountError("Input is greater than your current balance");
      return false;
    } else if (
      selectedCurrency?.value &&
      sendAmount &&
      Number(sendAmount) < selectedCurrency.value
    ) {
      setAmountError("");
      return true;
    }

    return true;
  }

  function checkRecipientAddressInput() {
    try {
      validateBech32Address(recipientAddress, "wallet address", "xion");
    } catch {
      setRecipientAddressError("Invalid wallet address");
      return false;
    }

    return true;
  }

  async function handleStart() {
    if (!sendAmount || sendAmount === "0") {
      setAmountError("No amount entered");
      return;
    }

    if (!checkRecipientAddressInput()) {
      return;
    }

    const addressExists = await isExistingAddress(recipientAddress);

    if (!addressExists) {
      setIsOnWarningStep(true);
      return;
    }

    setIsOnReviewStep(true);
  }

  async function triggerSend() {
    try {
      setIsLoading(true);
      await handleStart();

      if (!selectedCurrency?.asset.base) {
        throw new Error("Selected currency asset base is undefined");
      }

      const result = await sendTokens(
        recipientAddress,
        Number(sendAmount),
        selectedCurrency.asset.base,
        userMemo,
      );

      if (result.transactionHash) {
        setTransactionHash(result.transactionHash);
      }

      setIsSuccess(true);
    } catch (error) {
      console.log(error);
      setSendTokensError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    checkSendAmountInput();
  }, [sendAmount]);

  useEffect(() => {
    checkRecipientAddressInput();
  }, [recipientAddress]);

  return (
    <>
      {sendTokensError ? (
        <div className="ui-animate-scale-in ui-flex ui-flex-col ui-items-center ui-py-28 ui-text-center">
          <AnimatedX />
          <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Transaction Failed</h2>
          <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">Please try again later.</p>
          <Button className="ui-w-full ui-mt-6" onClick={() => setIsOpen(false)}>CLOSE</Button>
        </div>
      ) : isSuccess && account && selectedCurrency ? (
        <div className="ui-animate-scale-in">
          <WalletSendSuccess
            account={account}
            onFinish={() => setIsOpen(false)}
            recipientAddress={recipientAddress}
            selectedCurrency={selectedCurrency}
            sendAmount={sendAmount}
            userMemo={userMemo}
            transactionHash={transactionHash}
          />
        </div>
      ) : isSuccess ? (
        <div className="ui-animate-scale-in ui-flex ui-flex-col ui-items-center ui-py-28 ui-text-center">
          <AnimatedX />
          <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Transaction Incomplete</h2>
          <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">Unable to load account or currency data</p>
          <Button className="ui-w-full ui-mt-6" onClick={() => setIsOpen(false)}>CLOSE</Button>
        </div>
      ) : isOnReviewStep && account && selectedCurrency ? (
        <div className="ui-animate-scale-in">
          <WalletSendReview
            isLoading={isLoading}
            account={account}
            recipientAddress={recipientAddress}
            selectedCurrency={selectedCurrency}
            sendAmount={sendAmount}
            userMemo={userMemo}
            triggerSend={triggerSend}
            onBack={() => {
              setIsOnReviewStep(false);
            }}
          />
        </div>
      ) : isOnReviewStep ? (
        <div className="ui-animate-scale-in ui-flex ui-flex-col ui-items-center ui-py-28 ui-text-center">
          <AnimatedX />
          <h2 className="ui-mt-6 ui-text-title ui-text-text-primary">Unable to Review</h2>
          <p className="ui-mt-1.5 ui-text-body ui-text-text-muted">Missing account or currency information</p>
          <Button className="ui-w-full ui-mt-6" onClick={() => setIsOpen(false)}>CLOSE</Button>
        </div>
      ) : isOnWarningStep ? (
        <div className="ui-animate-scale-in">
          <WalletSendWarning
            onContinue={() => {
              setIsOnWarningStep(false);
              setIsOnReviewStep(true);
            }}
            onCancel={() => setIsOnWarningStep(false)}
          />
        </div>
      ) : (
        <div className="ui-animate-scale-in">
          <WalletSendInput
            balances={balances}
            amountError={amountError}
            onChangeCurrency={setSelectedCurrencyDenom}
            selectedCurrencyDenom={selectedCurrencyDenom}
            onAmountChange={handleAmountChange}
            onUpdateRecipientAddress={(e) => {
              setRecipientAddressError("");
              setRecipientAddress(e);
            }}
            onUpdateUserMemo={setUserMemo}
            recipientAddress={recipientAddress}
            recipientAddressError={recipientAddressError}
            selectedCurrency={selectedCurrency!}
            sendAmount={sendAmount}
            userMemo={userMemo}
            onStart={handleStart}
            updateSendAmount={updateSendAmount}
          />
        </div>
      )}
    </>
  );
}
