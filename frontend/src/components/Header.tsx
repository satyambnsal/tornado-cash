/**
 * Header Component
 * Displays contract info and connected account
 */

import { abbreviateBigInt } from "../utils/noteFormat";
import { Button } from "./ui/button";
import { CopyAddress } from "./CopyAddress";

interface HeaderProps {
  contractAddress: string;
  denomination: string;
  userAddress: string | null;
  balance: string;
  onDisconnect?: () => void;
}

export function Header({
  contractAddress,
  denomination,
  userAddress,
  balance,
  onDisconnect,
}: HeaderProps) {
  const denominationInXion = (Number(denomination) / 1_000_000).toFixed(2);

  return (
    <header className="ui-border-b ui-bg-background ui-py-4 ui-px-6">
      <div className="ui-max-w-4xl ui-mx-auto">
        {/* Title */}
        <div className="ui-text-center ui-mb-6">
          <h1 className="ui-text-3xl ui-font-bold">Tornado Cash</h1>
          <p className="ui-text-sm ui-text-muted-foreground ui-mt-1">
            Private transactions on XION
          </p>
        </div>

        {/* Contract Info */}
        <div className="ui-bg-muted ui-p-4 ui-rounded-lg ui-space-y-2 ui-text-sm">
          <div className="ui-flex ui-justify-between ui-items-center">
            <span className="ui-text-muted-foreground">Denomination:</span>
            <span className="ui-font-semibold">
              {denominationInXion} XION
            </span>
          </div>

          <div className="ui-flex ui-justify-between ui-items-center">
            <span className="ui-text-muted-foreground">Contract:</span>
            <CopyAddress xionAddress={contractAddress} />
          </div>

          {userAddress && (
            <>
              <div className="ui-border-t ui-pt-2">
                <div className="ui-flex ui-justify-between ui-items-center">
                  <span className="ui-text-muted-foreground">
                    Connected Account:
                  </span>
                  <CopyAddress xionAddress={userAddress} />
                </div>
              </div>

              <div className="ui-flex ui-justify-between ui-items-center">
                <span className="ui-text-muted-foreground">Balance:</span>
                <span className="ui-font-semibold">
                  {(Number(balance) / 1_000_000).toFixed(6)} XION
                </span>
              </div>

              {onDisconnect && (
                <div className="ui-pt-2 ui-border-t">
                  <Button
                    onClick={onDisconnect}
                    variant="outline"
                    size="sm"
                    className="ui-w-full"
                  >
                    Disconnect
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
