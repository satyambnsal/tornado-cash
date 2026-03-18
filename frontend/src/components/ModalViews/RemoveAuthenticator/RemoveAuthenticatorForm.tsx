import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MsgExecuteContractEncodeObject } from "@cosmjs/cosmwasm-stargate";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { assertIsDeliverTxSuccess } from "@cosmjs/stargate";
import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui";
import { AuthContext, AuthContextProps } from "../../AuthContext";
import { useSigningClient } from "../../../hooks";
import type { Authenticator } from "@burnt-labs/account-management";
import type { authenticatorTypes } from "../../../types";
import { AAAlgo, AUTHENTICATOR_TYPE } from "@burnt-labs/signers";
import { removeRegistration } from "../../../auth/passkey";
import { Loading } from "../../Loading";
import { ZKEmailAuthenticatorStatus } from "../AddAuthenticators/ZKEmailAuthenticatorStatus";
import { useZKEmailSigningStatus } from "../../../hooks/useZKEmailSigningStatus";
import { FEE_GRANTER_ADDRESS } from "../../../config";
import { validateFeeGrant } from "@burnt-labs/account-management";
import { useAuthTypes } from "../../../auth/hooks/useAuthTypes";
import {
  extractUserIdFromAuthenticator,
  getAuthenticatorLogo,
  capitalizeFirstLetter,
  getAuthenticatorLabel,
} from "../../../auth/utils/authenticator-helpers";
import {
  setZKEmailSigningAbortController,
  setZKEmailSigningStatus,
} from "../../../auth/zk-email/zk-email-signing-status";
import { CONNECTION_METHOD } from "../../../auth/useAuthState";
import { useZKEmailTurnstileProvider } from "../../../hooks/useZKEmailTurnstileProvider";

export function RemoveAuthenticatorForm({
  authenticator,
  authType,
  setIsOpen,
}: {
  authenticator?: Authenticator;
  authType?: string;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}) {
  // General UI state
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailWarning, setShowEmailWarning] = useState(
    authenticator?.type === AUTHENTICATOR_TYPE.JWT && authType === "email"
      ? true
      : false,
  );

  // Context state
  const { abstractAccount, setAbstractAccount, chainInfo, connectionMethod } =
    useContext(AuthContext) as AuthContextProps;

  // Hooks
  const { client, getGasCalculation } = useSigningClient();
  const isUsingZKEmail = connectionMethod === CONNECTION_METHOD.ZKEmail;
  const zkEmailSigningStatus = useZKEmailSigningStatus(isUsingZKEmail);
  const { renderTurnstile } = useZKEmailTurnstileProvider(isUsingZKEmail);

  // When modal is open with zk-email, set abort controller so closing modal stops polling
  useEffect(() => {
    if (connectionMethod !== CONNECTION_METHOD.ZKEmail) return;
    const controller = new AbortController();
    setZKEmailSigningStatus(null);
    setZKEmailSigningAbortController(controller);
    return () => {
      controller.abort();
      setZKEmailSigningAbortController(null);
      setZKEmailSigningStatus(null);
    };
  }, [connectionMethod]);

  // Extract userId for JWT authenticators to get auth type
  const userId = useMemo(() => {
    if (!authenticator) return null;
    return extractUserIdFromAuthenticator(
      authenticator.authenticator,
      authenticator.type,
    );
  }, [authenticator]);

  // Fetch auth types for JWT authenticators
  const { authTypesMap } = useAuthTypes(userId ? [userId] : []);

  const handleAuthenticatorLabels = (type: authenticatorTypes) => {
    // For JWT authenticators, use the auth type from the API if available
    if (type === AUTHENTICATOR_TYPE.JWT && userId) {
      const authType = authTypesMap.get(userId);
      if (authType) {
        return capitalizeFirstLetter(authType);
      }
    }

    // Fallback to default labels
    return getAuthenticatorLabel(type);
  };

  const handleAuthenticatorLogos = (type: authenticatorTypes) => {
    // For JWT authenticators, use the auth type from the API if available
    if (type === AUTHENTICATOR_TYPE.JWT && userId) {
      const authType = authTypesMap.get(userId);
      if (authType) {
        return getAuthenticatorLogo(type, authType);
      }
    }

    // Fallback to default logos
    return getAuthenticatorLogo(type);
  };

  const renderAuthenticator = () => {
    if (!authenticator) {
      return (
        <div className="ui-flex ui-items-center ui-px-4 ui-mb-2.5 ui-h-16 ui-bg-surface-page ui-rounded-lg">
          No authenticator found.
        </div>
      );
    }
    return (
      <div
        key={authenticator.authenticator}
        className="ui-flex ui-items-center ui-justify-between ui-px-4 ui-py-4 ui-min-h-16 ui-bg-surface-page ui-rounded-xl ui-w-full"
      >
        <div className="ui-flex ui-flex-1 ui-items-center">
          <div className="ui-flex ui-w-8 ui-h-8 ui-bg-surface-border ui-items-center ui-justify-center ui-rounded-full">
            {handleAuthenticatorLogos(
              authenticator.type.toUpperCase() as authenticatorTypes,
            )}
          </div>
          <div className="ui-flex ui-flex-1 ui-pr-1 ui-items-start md:!ui-items-center ui-flex-col-reverse md:!ui-flex-row">
            <div className="ui-ml-4 ui-flex ui-items-center ui-justify-between">
              <p className="ui-text-body">
                {handleAuthenticatorLabels(
                  authenticator.type.toUpperCase() as authenticatorTypes,
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  async function removeAuthenticator() {
    try {
      setIsLoading(true);

      if (!authenticator) {
        throw new Error("No authenticator found.");
      }

      if (!client) {
        throw new Error("No client found.");
      }

      if (!abstractAccount) {
        throw new Error("No account found.");
      }

      if (abstractAccount.authenticators.length <= 1) {
        throw new Error(
          "You are trying to remove the only authenticator on the account and will lose all access. We cannot allow this operation.",
        );
      }

      if (
        abstractAccount.authenticators.some(
          (a) => a.type === String(AAAlgo.Passkey),
        ) &&
        abstractAccount.authenticators.length === 2
      ) {
        if (authenticator.type !== String(AAAlgo.Passkey)) {
          throw new Error(
            "Passkey cannot be the only authenticator on the account.",
          );
        }
      }

      const msg = {
        remove_auth_method: {
          id: authenticator.authenticatorIndex,
        },
      };

      const removeMsg: MsgExecuteContractEncodeObject = {
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        value: MsgExecuteContract.fromPartial({
          sender: abstractAccount.id,
          contract: abstractAccount.id,
          msg: new Uint8Array(Buffer.from(JSON.stringify(msg), "utf-8")),
          funds: [],
        }),
      };
      // Check if fee grant exists
      const feeGrantResult = await validateFeeGrant(
        chainInfo?.rest || "",
        FEE_GRANTER_ADDRESS,
        abstractAccount.id,
        [
          "/cosmos.authz.v1beta1.MsgGrant",
          "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
          "/cosmwasm.wasm.v1.MsgExecuteContract",
          "/cosmwasm.wasm.v1.MsgMigrateContract",
        ],
        abstractAccount.id,
      );

      const validFeeGranter = feeGrantResult.valid ? FEE_GRANTER_ADDRESS : null;

      const simmedGas = await client.simulate(
        abstractAccount.id,
        [removeMsg],
        "add-authenticator",
      );
      const fee = getGasCalculation(simmedGas);

      const deliverTxResponse = await client.signAndBroadcast(
        abstractAccount.id,
        [removeMsg],
        validFeeGranter && fee
          ? { ...fee, granter: validFeeGranter }
          : fee || "auto",
      );

      assertIsDeliverTxSuccess(deliverTxResponse);

      setAbstractAccount({
        ...abstractAccount,
        authenticators: abstractAccount.authenticators.filter(
          ({ id }) =>
            id != `${abstractAccount.id}-${authenticator.authenticatorIndex}`,
        ),
      });

      if (authenticator.type === String(AAAlgo.Passkey)) {
        removeRegistration(abstractAccount.id, authenticator.authenticator);
      }

      setIsLoading(false);
      setIsOpen(false);

      return deliverTxResponse;
    } catch (error) {
      console.warn(error);
      setErrorTitle("Something went wrong trying to remove authenticator");
      setErrorMessage(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
      setIsLoading(false);
    }
  }

  if (isLoading) {
    if (connectionMethod === CONNECTION_METHOD.ZKEmail) {
      return (
        <div className="ui-animate-scale-in ui-flex ui-flex-col ui-gap-10 ui-items-center ui-w-full">
          <Loading
            header="Removing Authenticator"
            message={
              zkEmailSigningStatus
                ? "Signing with your email. Don't leave the page or close the window."
                : "Preparing... Don't leave the page or close the window."
            }
          />
          {zkEmailSigningStatus && (
            <ZKEmailAuthenticatorStatus
              phase={zkEmailSigningStatus.phase}
              message={zkEmailSigningStatus.message}
              detail={zkEmailSigningStatus.detail}
              className="ui-w-full"
            />
          )}
          {renderTurnstile()}
        </div>
      );
    }

    return (
      <Loading
        header="Removing Authenticator"
        message="We are removing an authenticator from your account. Don't leave the page or close the window. This will take a few seconds..."
      />
    );
  }

  if (showEmailWarning) {
    return (
      <div className="ui-animate-scale-in ui-flex ui-flex-col ui-gap-10 ui-items-center">
        <DialogHeader>
          <DialogTitle>Warning</DialogTitle>
          {errorMessage ? (
            <DialogDescription className="ui-text-destructive-text">
              {errorMessage}
            </DialogDescription>
          ) : (
            <DialogDescription className="ui-text-text-secondary">
              Once you delete your email authenticator, you won&apos;t be able
              to add it back. That feature is coming soon.
            </DialogDescription>
          )}
        </DialogHeader>
        <Button
          onClick={() => setShowEmailWarning(false)}
          variant="destructive"
          className="ui-w-full"
        >
          I ACKNOWLEDGE & WISH TO PROCEED
        </Button>
      </div>
    );
  }

  return (
    <div className="ui-animate-scale-in ui-flex ui-flex-col ui-gap-6 ui-items-center ui-w-full">
      <DialogHeader>
        <DialogTitle>Are you sure?</DialogTitle>
        {errorTitle ? (
          <DialogDescription className="ui-text-destructive">
            {errorTitle}
          </DialogDescription>
        ) : (
          <>
            <div>
              <DialogDescription>
                You are about to delete the authenticator below.
              </DialogDescription>
              <DialogDescription>
                Please click the confirm button to proceed.
              </DialogDescription>
            </div>
          </>
        )}
      </DialogHeader>
      <div className="ui-flex ui-flex-col ui-gap-2.5 ui-w-full">
        {renderAuthenticator()}
        <span className="ui-text-destructive">{errorMessage}</span>
      </div>
      {errorMessage ? (
        <Button className="ui-w-full" onClick={() => setIsOpen(false)}>
          CONTINUE
        </Button>
      ) : (
        <Button className="ui-w-full" onClick={removeAuthenticator}>
          CONFIRM
        </Button>
      )}
    </div>
  );
}
