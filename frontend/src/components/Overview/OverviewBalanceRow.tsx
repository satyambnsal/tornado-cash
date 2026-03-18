import React from "react";
import { FormattedAssetAmount } from "../../types/assets";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../../utils/classname-util";
import { basicFormatCurrency, basicFormatTokenAmount } from "../../utils";

export const OverviewBalanceTableSkeleton = () => {
  return (
    <table className="ui-w-full ui-border-collapse">
      <tbody>
        {Array.from({ length: 2 }).map((_, index) => (
          <tr
            key={`skeleton-${index}`}
            className="ui-w-full"
            role="row"
            aria-label="skeleton balance information"
          >
            <td
              className={cn("ui-py-2.5 ui-pl-1.5 ui-w-6/12", {
                "ui-pt-0": index === 0,
                "ui-pb-0": index === 1,
              })}
            >
              <div className="ui-flex ui-items-center ui-gap-1.5 sm:ui-gap-2.5">
                <Skeleton className="ui-w-8 ui-h-8 ui-rounded-full" />
                <Skeleton className="ui-h-4 ui-w-16 md:ui-h-6 md:ui-w-24" />
              </div>
            </td>
            <td
              className={cn("ui-hidden md:ui-flex ui-py-2.5 ui-w-3/12", {
                "ui-pt-0": index === 0,
                "ui-pb-0": index === 1,
              })}
            >
              <div
                className="ui-hidden md:ui-flex ui-flex-col ui-items-end ui-gap-1.5"
                aria-label="skeleton current price information"
              >
                <Skeleton
                  className="ui-h-5 ui-w-16"
                  aria-label="Skeleton Current price"
                />
                <Skeleton
                  className="ui-h-3.5 ui-w-24"
                  aria-label="Skeleton Current price"
                />
              </div>
            </td>
            <td
              className={cn("ui-py-2.5 ui-pr-1.5 ui-w-3/12", {
                "ui-pt-0": index === 0,
                "ui-pb-0": index === 1,
              })}
            >
              <div
                className="ui-flex ui-flex-col ui-items-end ui-gap-1.5"
                aria-label="skeleton balance value information"
              >
                <Skeleton
                  className="ui-h-3.5 ui-w-12 md:ui-h-5 md:ui-w-16"
                  aria-label="Skeleton Total value"
                />
                <Skeleton
                  className="ui-h-3 ui-w-16 md:ui-h-3.5 md:ui-w-24"
                  aria-label="Skeleton Balance"
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const OverviewBalanceTable = ({
  assets,
}: {
  assets: FormattedAssetAmount[];
}) => {
  return (
    <table className="ui-w-full ui-border-collapse">
      <tbody>
        {assets.map((asset, index) => (
          <tr
            key={`${asset.symbol}-${index}`}
            className="ui-w-full"
            role="row"
            aria-label={`${asset.symbol} balance information`}
          >
            <td
              className={cn("ui-pl-1.5 ui-w-6/12 ui-py-2.5", {
                "ui-pt-0": index === 0,
                "ui-pb-0": index === assets.length - 1,
              })}
            >
              <div className="ui-flex ui-items-center ui-gap-1.5 sm:ui-gap-2.5">
                {asset.imageUrl && (
                  <img
                    src={asset.imageUrl}
                    alt={`${asset.symbol} icon`}
                    className="ui-w-8 ui-h-8 ui-rounded-full"
                  />
                )}
                <h4 className="ui-text-body sm:ui-text-title-lg">
                  {asset.symbol}
                </h4>
              </div>
            </td>
            <td
              className={cn("ui-hidden md:ui-table-cell ui-w-3/12 ui-py-2.5", {
                "ui-pt-0": index === 0,
                "ui-pb-0": index === assets.length - 1,
              })}
            >
              <div
                className="ui-hidden md:ui-flex ui-flex-col ui-items-end ui-gap-1.5"
                aria-label={`${asset.symbol} current price information`}
              >
                <p
                  className="ui-text-body sm:ui-text-title !ui-leading-none"
                  aria-label={`Current price ${basicFormatCurrency(asset.price)} dollars`}
                >
                  ${basicFormatCurrency(asset.price)}
                </p>
                <p className="ui-text-caption sm:ui-text-body !ui-leading-none ui-text-text-muted">
                  Current Price
                </p>
              </div>
            </td>
            <td
              className={cn("ui-pr-1.5 ui-pl-4 ui-w-3/12 ui-py-2.5", {
                "ui-pt-0": index === 0,
                "ui-pb-0": index === assets.length - 1,
              })}
            >
              <div
                className="ui-flex ui-flex-col ui-items-end ui-gap-1.5"
                aria-label={`${asset.symbol} balance value information`}
              >
                <p
                  className="ui-text-body sm:ui-text-title !ui-leading-none"
                  aria-label={`Total value ${basicFormatCurrency(asset.dollarValue || 0)} dollars`}
                >
                  ${basicFormatCurrency(asset.dollarValue || 0)}
                </p>
                <p
                  className="ui-text-caption sm:ui-text-body !ui-leading-none ui-text-text-muted"
                  aria-label={`Balance ${basicFormatTokenAmount(asset)} ${asset.symbol}`}
                >
                  {basicFormatTokenAmount(asset)} {asset.symbol}
                </p>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
