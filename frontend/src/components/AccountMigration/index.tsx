import { useContext, useState } from "react";
import { MsgMigrateContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { Uint53 } from "@cosmjs/math";
import { toUtf8 } from "@cosmjs/encoding";
import { Button } from "../ui";
import SpinnerV2 from "../ui/icons/SpinnerV2";
import { AuthContext, AuthContextProps } from "../AuthContext";
import { useSmartAccount, useSigningClient } from "../../hooks";
import { validateFeeGrant } from "@burnt-labs/account-management";
import { assertIsDeliverTxSuccess } from "@cosmjs/stargate";
import { MigrationDialog } from "./MigrationDialog";
import {
  DEFAULT_ACCOUNT_CONTRACT_CODE_ID,
  FEE_GRANTER_ADDRESS,
  XION_API_URL,
} from "../../config";

type AbstraxionMigrateProps = {
  currentCodeId: number;
  updateContractCodeID: (codeId: number) => void;
};

/*
 * This component will need to become more intelligent as we develop and deploy more account contracts.
 * */
const targetCodeId = parseInt(DEFAULT_ACCOUNT_CONTRACT_CODE_ID, 10);

export const AccountMigration = ({
  currentCodeId,
  updateContractCodeID,
}: AbstraxionMigrateProps) => {
  const { setAbstraxionError } = useContext(AuthContext) as AuthContextProps;

  const { client, getGasCalculation } = useSigningClient();
  const { data: account } = useSmartAccount();
  const [inProgress, setInProgress] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const migrateAccount = async () => {
    if (!client || !account) return;
    try {
      setInProgress(true);

      const migrateMsg = {
        typeUrl: "/cosmwasm.wasm.v1.MsgMigrateContract",
        value: MsgMigrateContract.fromPartial({
          sender: account.id,
          contract: account.id,
          codeId: BigInt(new Uint53(targetCodeId).toString()),
          msg: toUtf8(
            JSON.stringify({
              code_id: targetCodeId,
            }),
          ),
        }),
      };

      // Check if fee grant exists
      const feeGrantResult = await validateFeeGrant(
        XION_API_URL,
        FEE_GRANTER_ADDRESS,
        account.id,
        [
          "/cosmos.authz.v1beta1.MsgGrant",
          "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
          "/cosmwasm.wasm.v1.MsgExecuteContract",
          "/cosmwasm.wasm.v1.MsgMigrateContract",
        ],
        account.id,
      );

      const simmedGas = await client.simulate(account.id, [migrateMsg], "");
      const fee = getGasCalculation(simmedGas);

      let stdFee = fee || ("auto" as const);
      if (fee && feeGrantResult.valid) {
        stdFee = { ...fee, granter: FEE_GRANTER_ADDRESS };
      }
      const deliverTxRes = await client.signAndBroadcast(
        account.id,
        [migrateMsg],
        stdFee,
      );

      assertIsDeliverTxSuccess(deliverTxRes);

      void updateContractCodeID(targetCodeId);
    } catch (error) {
      console.log("something went wrong: ", error);
      setAbstraxionError("Failed to migrate account.");
      setFailed(true);
    } finally {
      setInProgress(false);
      setDialogOpen(false);
    }
  };

  if (currentCodeId === targetCodeId) return null;

  if (failed) {
    return null;
  }

  if (inProgress) {
    return (
      <div className="ui-w-full ui-min-h-[100px] ui-flex ui-items-center ui-justify-center ui-text-text-primary">
        <SpinnerV2 size="lg" color="black" />
      </div>
    );
  }

  return (
    <>
      <div className="ui-w-full ui-rounded-xl ui-bg-transparent ui-border ui-border-dashed ui-border-surface-border ui-p-4 ui-flex ui-flex-col sm:ui-flex-row ui-gap-4 sm:ui-justify-between ui-items-center">
        <div>
          <h2 className="ui-text-title">
            Account Migration Available!
          </h2>
          <p className="ui-text-secondary-text ui-text-body">
            New features and security improvements.
          </p>
        </div>
        <Button
          size="small"
          onClick={() => setDialogOpen(true)}
          className="ui-w-full sm:ui-w-auto"
        >
          LEARN MORE
        </Button>
      </div>

      <MigrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentCodeId={currentCodeId}
        targetCodeId={targetCodeId}
        onUpgrade={migrateAccount}
      />
    </>
  );
};
