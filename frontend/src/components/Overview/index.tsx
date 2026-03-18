import React, { useState } from "react";
import { WalletActionButton } from "../ui";
import { useAccountBalance } from "../../hooks/useAccountBalance";
import { WalletReceive } from "../WalletReceive";
import { WalletSend } from "../WalletSend/WalletSend";
import {
  OverviewBalanceTable,
  OverviewBalanceTableSkeleton,
} from "./OverviewBalanceRow";
import { FEATURED_ASSETS } from "../../config";
import { SelectedSmartAccount } from "../../types/wallet-account-types";
import { Divider } from "./Divider";
import { CopyAddress } from "../CopyAddress";
import { cn } from "../../utils/classname-util";
import { basicFormatCurrency } from "../../utils";

interface OverviewProps {
  account: SelectedSmartAccount;
}

export function Overview({ account }: OverviewProps) {
  const [showAllBalances, setShowAllBalances] = useState(false);
  const { balances, totalDollarValue } = useAccountBalance();

  const toggleShowAllBalances = () => {
    setShowAllBalances(!showAllBalances);
  };

  const featuredAssetsSet = new Set(FEATURED_ASSETS);
  const splitBalances = balances.reduce(
    (acc, balance) => {
      if (
        featuredAssetsSet.has(
          balance.symbol as (typeof FEATURED_ASSETS)[number],
        )
      ) {
        acc.featuredBalances.push(balance);
      } else {
        acc.otherBalances.push(balance);
      }
      return acc;
    },
    { featuredBalances: [], otherBalances: [] } as {
      featuredBalances: typeof balances;
      otherBalances: typeof balances;
    },
  );

  return (
    <div className="ui-overflow-hidden ui-relative ui-rounded-xl ">
      <div className="ui-w-full ui-p-6 ui-flex ui-flex-col ui-gap-6 ui-z-10 ui-relative">
        <div className="ui-flex ui-flex-col ui-gap-6 md:ui-gap-10">
          <div className="ui-flex ui-flex-col md:ui-flex-row ui-gap-1.5 md:ui-gap-4 ui-items-start md:ui-items-center">
            <h3 className="ui-text-title-lg ui-leading-7">
              Personal Account
            </h3>
            <CopyAddress xionAddress={account?.id} />
          </div>

          <div className="ui-w-full ui-flex ui-flex-col ui-gap-6 ">
            <div className="ui-flex ui-flex-col ui-gap-2.5">
              {balances && (
                <h1 className="ui-text-[28px] sm:ui-text-[32px] md:ui-text-[40px] ui-leading-[36px] ui-font-bold">
                  ${basicFormatCurrency(totalDollarValue)}
                </h1>
              )}
            </div>
            <div className="ui-flex ui-w-full ui-gap-2.5">
              {account?.id && (
                <WalletReceive
                  xionAddress={account.id}
                  trigger={
                    <WalletActionButton
                      type="receive"
                      className="ui-w-full md:ui-w-[150px]"
                    />
                  }
                />
              )}
              <WalletSend
                trigger={
                  <WalletActionButton
                    type="send"
                    className="ui-w-full md:ui-w-[150px]"
                  />
                }
              />
            </div>
          </div>
        </div>

        <Divider className="ui-my-0" />

        <div className="ui-flex ui-flex-col ui-gap-4">
          {splitBalances.featuredBalances.length === 0 && (
            <OverviewBalanceTableSkeleton />
          )}
          <OverviewBalanceTable assets={splitBalances.featuredBalances} />
        </div>
        {splitBalances.otherBalances.length > 0 && (
          <>
            <div>
              {showAllBalances && (
                <OverviewBalanceTable assets={splitBalances.otherBalances} />
              )}
            </div>
            <div className="ui-flex ui-items-center ui-justify-between ui-mt-1.5">
              <div className="ui-text-text-secondary ui-text-body ui-font-normal ui-leading-normal">
                {showAllBalances
                  ? `${balances.length} items`
                  : `+${splitBalances.otherBalances.length} more`}
              </div>
              <div
                onClick={toggleShowAllBalances}
                className="ui-text-right ui-text-text-primary ui-text-body ui-font-normal ui-underline ui-leading-tight hover:ui-cursor-pointer"
              >
                {showAllBalances ? "Show less" : "Show all"}
              </div>
            </div>
          </>
        )}
      </div>
      <div
        className={cn(
          // Positioning and dimensions
          "ui-absolute ui-inset-0 ui-z-0",
          // Visual styling
          "ui-bg-surface ui-border ui-border-surface-border ui-shadow-sm ui-rounded-xl",
        )}
      />
    </div>
  );
}
