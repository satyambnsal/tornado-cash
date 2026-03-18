/**
 * Simplified Tornado Cash Application using @burnt-labs/abstraxion
 */

import { useState, useEffect } from "react";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion";
import { Button } from "@burnt-labs/ui";
import { useTornado } from "../context/TornadoContext";
import { Header } from "./Header";
import { DepositTab } from "./DepositTab";
import { WithdrawTab } from "./WithdrawTab";
import { TransactionHistory } from "./TransactionHistory";
import { LoadingModal } from "./LoadingModal";
import { CHAIN_ID } from "../config";
import type { ProofData } from "../types/tornado";

type Tab = "deposit" | "withdraw" | "history";

export function SimpleTornadoCashApp() {
  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [balance, setBalance] = useState<string>("0");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Simple abstraxion hooks
  const { data: account, login, logout } = useAbstraxionAccount();
  const { client } = useAbstraxionSigningClient();
  const { client: queryClient } = useAbstraxionClient();

  // Get Tornado context
  const {
    contractAddress,
    denomination,
    merkleTreeLevels,
    contractService,
    initializeContract,
  } = useTornado();

  // Initialize contract when client is available
  useEffect(() => {
    if (client && !contractService) {
      console.log("Initializing Tornado contract...");
      initializeContract(client).catch((error) => {
        console.error("Failed to initialize contract:", error);
      });
    }
  }, [client, contractService, initializeContract]);

  // Load balance when client and account are available
  useEffect(() => {
    if (queryClient && account?.bech32Address) {
      loadBalance();
    }
  }, [queryClient, account?.bech32Address]);

  const loadBalance = async () => {
    if (!queryClient || !account?.bech32Address) return;

    try {
      const bal = await queryClient.getBalance(account.bech32Address, "uxion");
      setBalance(bal.amount);
    } catch (error) {
      console.error("Failed to load balance:", error);
    }
  };

  // Contract interaction handlers
  const handleDeposit = async (
    commitment: string,
    amount: readonly { denom: string; amount: string }[]
  ) => {
    if (!contractService || !account?.bech32Address) {
      throw new Error("Contract not initialized or no account");
    }

    const result = await contractService.deposit(
      account.bech32Address,
      commitment,
      amount
    );

    // Reload balance after deposit
    await loadBalance();

    return {
      txHash: result.txHash,
      events: result.events,
    };
  };

  const handleWithdraw = async (
    proof: ProofData,
    publicInputs: string[],
    root: string,
    nullifierHash: string,
    recipient: string,
    relayer?: string,
    fee?: string,
    refund?: string
  ) => {
    if (!contractService || !account?.bech32Address) {
      throw new Error("Contract not initialized or no account");
    }

    const result = await contractService.withdraw(
      account.bech32Address,
      proof,
      publicInputs,
      root,
      nullifierHash,
      recipient,
      relayer,
      fee,
      refund
    );

    // Reload balance after withdrawal
    await loadBalance();

    return {
      txHash: result.txHash,
      events: result.events,
    };
  };

  const handleCheckNullifier = async (nullifierHash: string) => {
    if (!contractService) {
      throw new Error("Contract not initialized");
    }

    return await contractService.isNullifierUsed(nullifierHash);
  };

  const handleGetMerkleRoot = async () => {
    if (!contractService) {
      throw new Error("Contract not initialized");
    }

    return await contractService.getMerkleRoot();
  };

  const handleLogin = async () => {
    if (!account?.bech32Address) {
      setIsLoggingIn(true);
      try {
        await login();
      } catch (error) {
        console.error('Login failed:', error);
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  const handleDisconnect = () => {
    if (logout) {
      logout();
    }
  };

  // If not connected, show connect prompt
  if (!account?.bech32Address) {
    return (
      <>
        <div className="ui-min-h-screen ui-flex ui-items-center ui-justify-center ui-bg-background">
          <div className="ui-text-center ui-p-8">
            <h1 className="ui-text-4xl ui-font-bold ui-mb-4">Tornado Cash</h1>
            <p className="ui-text-muted-foreground ui-mb-6">
              Connect your account to start using Tornado Cash
            </p>
            <Button
              fullWidth
              onClick={handleLogin}
              structure="base"
            >
              CONNECT
            </Button>
          </div>
        </div>
        <LoadingModal isOpen={isLoggingIn} message="Connecting to your wallet..." />
      </>
    );
  }

  // If contract not initialized, show loading
  if (!contractService) {
    return (
      <div className="ui-min-h-screen ui-flex ui-items-center ui-justify-center ui-bg-background">
        <div className="ui-text-center">
          <div className="ui-mb-4">
            <div className="ui-inline-block ui-w-8 ui-h-8 ui-border-4 ui-border-muted ui-border-t-foreground ui-rounded-full ui-animate-spin" />
          </div>
          <p className="ui-text-muted-foreground">
            Initializing Tornado Cash contract...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-min-h-screen ui-bg-background">
      {/* Header */}
      <Header
        contractAddress={contractAddress}
        denomination={denomination}
        userAddress={account.bech32Address}
        balance={balance}
        onDisconnect={handleDisconnect}
      />

      {/* Main Content */}
      <main className="ui-max-w-4xl ui-mx-auto ui-py-8 ui-px-6">
        {/* Tab Navigation */}
        <div className="ui-flex ui-gap-2 ui-mb-8 ui-border-b">
          <TabButton
            label="Deposit"
            active={activeTab === "deposit"}
            onClick={() => setActiveTab("deposit")}
          />
          <TabButton
            label="Withdraw"
            active={activeTab === "withdraw"}
            onClick={() => setActiveTab("withdraw")}
          />
          <TabButton
            label="History"
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
          />
        </div>

        {/* Tab Content */}
        <div className="ui-max-w-2xl ui-mx-auto">
          {activeTab === "deposit" && (
            <DepositTab
              contractAddress={contractAddress}
              denomination={denomination}
              balance={balance}
              userAddress={account.bech32Address}
              chainId={CHAIN_ID}
              onDeposit={handleDeposit}
            />
          )}

          {activeTab === "withdraw" && (
            <WithdrawTab
              contractAddress={contractAddress}
              denomination={denomination}
              merkleTreeLevels={merkleTreeLevels}
              userAddress={account.bech32Address}
              onWithdraw={handleWithdraw}
              onCheckNullifier={handleCheckNullifier}
              onGetMerkleRoot={handleGetMerkleRoot}
            />
          )}

          {activeTab === "history" && <TransactionHistory />}
        </div>
      </main>

      {/* Footer */}
      <footer className="ui-border-t ui-py-6 ui-mt-12">
        <div className="ui-max-w-4xl ui-mx-auto ui-px-6 ui-text-center ui-text-sm ui-text-muted-foreground">
          <p>Tornado Cash - Privacy for the XION blockchain</p>
          <p className="ui-mt-2 ui-text-xs">
            Always verify contract addresses and use at your own risk
          </p>
        </div>
      </footer>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`ui-px-6 ui-py-3 ui-font-medium ui-border-b-2 ui-transition-colors ${
        active
          ? "ui-border-foreground ui-text-foreground"
          : "ui-border-transparent ui-text-muted-foreground hover:ui-text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
