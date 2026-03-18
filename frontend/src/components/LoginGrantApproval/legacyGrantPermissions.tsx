import React, { useState } from "react";
import { CheckIcon, ChevronDownIcon } from "../ui";
import type { ContractGrantDescription } from "@burnt-labs/account-management";

interface LegacyGrantPermissionsArgs {
  contracts?: ContractGrantDescription[];
  stake?: boolean;
  bank?: { denom: string; amount: string }[];
}

export function LegacyGrantPermissions({
  contracts,
  stake,
  bank,
}: LegacyGrantPermissionsArgs) {
  const [isContractsOpen, setContractsOpen] = useState(false);

  const toggleContractsList = () => setContractsOpen(!isContractsOpen);

  return (
    <>
      {contracts && contracts.length >= 1 ? (
        <li className="ui-flex ui-items-baseline ui-text-body ui-mb-4">
          <span className="ui-mr-1.5">
            <CheckIcon color="currentColor" />
          </span>
          <div className="ui-flex ui-flex-col">
            <div className="ui-flex ui-items-center">
              <span>Permission to execute smart contracts</span>

              <button
                onClick={toggleContractsList}
                className="ui-ml-1.5 ui-cursor-pointer"
              >
                <ChevronDownIcon isUp={isContractsOpen} />
              </button>
            </div>
            <div className="ui-max-h-96 ui-overflow-y-scroll">
              {isContractsOpen && (
                <ul className="ui-list-disc ui-mt-1.5 ui-ml-4 ui-transition-all">
                  {contracts.map((contract, index) => (
                    <li key={index}>
                      <p className="ui-break-words ui-max-w-xs">
                        {typeof contract === "string"
                          ? contract
                          : contract.address}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </li>
      ) : null}
      {stake ? (
        <li className="ui-flex ui-items-baseline ui-text-body ui-mb-4">
          <span className="ui-mr-1.5">
            <CheckIcon color="currentColor" />
          </span>
          <div className="ui-flex ui-flex-col">
            Permission to manage staking operations
            <ul className="ui-list-disc ui-mt-1.5 ui-ml-4">
              <li>Stake Tokens</li>
              <li>Withdraw Staking Rewards</li>
              <li>Manage Unbonding</li>
            </ul>
          </div>
        </li>
      ) : null}
      {bank && bank.length >= 1 ? (
        <li className="ui-flex ui-items-baseline ui-text-body ui-mb-4">
          <span className="ui-mr-1.5">
            <CheckIcon color="currentColor" />
          </span>
          <div>
            Permission to send tokens with a spend limit of{" "}
            {bank.map(({ denom, amount }, index) => (
              <p className="ui-max-w-xs ui-break-words" key={index}>
                {`${amount} ${denom}`}
                {index < bank.length - 1 ? ", " : ""}
              </p>
            ))}
          </div>
        </li>
      ) : null}
      <li className="ui-flex ui-items-baseline ui-text-body">
        <span className="ui-mr-1.5">
          <CheckIcon color="currentColor" />
        </span>
        Log you in to their app
      </li>
    </>
  );
}
