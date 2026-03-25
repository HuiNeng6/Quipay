import { useState, useMemo, useCallback } from "react";
import { SimulationResult } from "../util/simulationUtils";
import TransactionSimulationModal from "../components/TransactionSimulationModal";
import { useWallet } from "../hooks/useWallet";
import { useStreams } from "../hooks/useStreams";
import {
  simulatePayrollStreamWithdrawFee,
  isWithdrawFeeEstimateAvailable,
} from "../util/withdrawFeeEstimate";
import { getWithdrawable, getStreamById } from "../contracts/payroll_stream";

/** Stellar uses 7 decimal places (10^7 stroops = 1 token unit). */
const STROOPS_PER_UNIT = 1e7;

export default function WithdrawPage() {
  const [showSim, setShowSim] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  // Get wallet address from context
  const { address: walletAddress, balances } = useWallet();

  // Get real stream data
  const { streams, isLoading: streamsLoading, error: streamsError } = useStreams(walletAddress);

  // Calculate total withdrawable amount from all streams
  const { totalWithdrawable, selectedStream } = useMemo(() => {
    if (!streams || streams.length === 0) {
      return { totalWithdrawable: 0, selectedStream: null };
    }

    // Use first stream with balance, or the selected one
    const targetStream = selectedStreamId
      ? streams.find(s => s.id === selectedStreamId)
      : streams.find(s => s.totalAmount > s.claimedAmount) || streams[0];

    if (!targetStream) {
      return { totalWithdrawable: 0, selectedStream: null };
    }

    const withdrawable = targetStream.totalAmount - targetStream.claimedAmount;
    return { totalWithdrawable: withdrawable, selectedStream: targetStream };
  }, [streams, selectedStreamId]);

  // Get token symbol from selected stream
  const tokenSymbol = selectedStream?.tokenSymbol || "USDC";

  // Current balance from wallet
  const currentBalance = useMemo(() => {
    if (!balances || !tokenSymbol) return 0;
    const balance = balances[tokenSymbol];
    return balance ? Number(balance) : 0;
  }, [balances, tokenSymbol]);

  // Real simulate function using actual contract calls
  const realSimulate = useCallback(async (): Promise<SimulationResult> => {
    if (!walletAddress) {
      return {
        status: "error",
        estimatedFeeStroops: 0,
        estimatedFeeXLM: 0,
        balanceChanges: [],
        errorMessage: "Wallet not connected",
        restoreRequired: false,
      };
    }

    if (!selectedStream) {
      return {
        status: "error",
        estimatedFeeStroops: 0,
        estimatedFeeXLM: 0,
        balanceChanges: [],
        errorMessage: "No stream available",
        restoreRequired: false,
      };
    }

    setIsSimulating(true);
    setSimulationError(null);

    try {
      // Check if fee estimation is available
      if (!isWithdrawFeeEstimateAvailable()) {
        // Return a basic simulation result without detailed fee estimation
        const result: SimulationResult = {
          status: "success",
          estimatedFeeStroops: 100000, // Default fee estimate
          estimatedFeeXLM: 0.01,
          restoreRequired: false,
          balanceChanges: [
            {
              token: tokenSymbol,
              symbol: tokenSymbol,
              before: currentBalance,
              after: currentBalance + totalWithdrawable,
              delta: totalWithdrawable,
            },
          ],
          resources: {
            instructions: 1_000_000,
            readBytes: 10_000,
            writeBytes: 2_000,
            readEntries: 2,
            writeEntries: 1,
          },
        };
        return result;
      }

      // Get the actual withdrawable amount from the contract
      const streamId = BigInt(selectedStream.id);
      const withdrawableFromContract = await getWithdrawable(streamId);

      const actualWithdrawable = withdrawableFromContract
        ? Number(withdrawableFromContract) / STROOPS_PER_UNIT
        : totalWithdrawable;

      // Run the actual simulation
      const result = await simulatePayrollStreamWithdrawFee(
        walletAddress,
        Number(streamId),
        [{ token: tokenSymbol, symbol: tokenSymbol, amount: currentBalance }]
      );

      // Update the balance changes with actual amounts
      if (result.status === "success") {
        result.balanceChanges = [
          {
            token: tokenSymbol,
            symbol: tokenSymbol,
            before: currentBalance,
            after: currentBalance + actualWithdrawable,
            delta: actualWithdrawable,
          },
        ];
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Simulation failed";
      setSimulationError(errorMsg);
      return {
        status: "error",
        estimatedFeeStroops: 0,
        estimatedFeeXLM: 0,
        balanceChanges: [],
        errorMessage: errorMsg,
        restoreRequired: false,
      };
    } finally {
      setIsSimulating(false);
    }
  }, [walletAddress, selectedStream, tokenSymbol, currentBalance, totalWithdrawable]);

  const handleSign = () => {
    setShowSim(false);
    console.log("Wallet signing triggered for stream:", selectedStreamId);
    // In a real implementation, this would trigger the wallet signing flow
  };

  // Loading state
  if (streamsLoading) {
    return (
      <div className="withdraw-page-loading">
        <p>Loading your streams...</p>
      </div>
    );
  }

  // Error state
  if (streamsError) {
    return (
      <div className="withdraw-page-error">
        <p>Error loading streams: {streamsError}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // No wallet connected
  if (!walletAddress) {
    return (
      <div className="withdraw-page-no-wallet">
        <p>Please connect your wallet to withdraw.</p>
      </div>
    );
  }

  // No streams available
  if (!streams || streams.length === 0) {
    return (
      <div className="withdraw-page-no-streams">
        <p>No payroll streams found for your wallet.</p>
      </div>
    );
  }

  // Nothing to withdraw
  if (totalWithdrawable <= 0) {
    return (
      <div className="withdraw-page-no-balance">
        <p>No withdrawable balance available.</p>
        <p>Current streams: {streams.length}</p>
        <p>Check back later when more funds have vested.</p>
      </div>
    );
  }

  return (
    <>
      <div className="withdraw-page">
        <div className="withdraw-info">
          <h2>Withdraw Salary</h2>
          <p className="withdrawable-amount">
            Available to withdraw: <strong>{totalWithdrawable.toFixed(2)} {tokenSymbol}</strong>
          </p>
          {streams.length > 1 && (
            <p className="stream-count">From {streams.length} active streams</p>
          )}
        </div>

        {simulationError && (
          <div className="simulation-error">
            <p>Warning: {simulationError}</p>
          </div>
        )}

        <button 
          onClick={() => setShowSim(true)}
          disabled={isSimulating || totalWithdrawable <= 0}
        >
          {isSimulating ? "Simulating..." : "Withdraw"}
        </button>
      </div>

      <TransactionSimulationModal
        open={showSim}
        preview={{
          description: `Withdraw ${totalWithdrawable.toFixed(2)} ${tokenSymbol}`,
          contractFunction: "withdraw",
          contractAddress: "PayrollStream",
          currentBalances: [{ token: tokenSymbol, symbol: tokenSymbol, amount: currentBalance }],
        }}
        onSimulate={realSimulate}
        onConfirm={handleSign}
        onCancel={() => setShowSim(false)}
      />

      <style>{`
        .withdraw-page {
          padding: 24px;
          max-width: 400px;
          margin: 0 auto;
        }
        .withdraw-info h2 {
          margin-bottom: 16px;
          color: var(--text, #333);
        }
        .withdrawable-amount {
          font-size: 18px;
          margin-bottom: 8px;
        }
        .stream-count {
          color: var(--muted, #666);
          font-size: 14px;
          margin-bottom: 16px;
        }
        .simulation-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          color: #ef4444;
        }
        .withdraw-page-loading,
        .withdraw-page-error,
        .withdraw-page-no-wallet,
        .withdraw-page-no-streams,
        .withdraw-page-no-balance {
          padding: 40px;
          text-align: center;
          max-width: 400px;
          margin: 0 auto;
        }
        .withdraw-page button {
          width: 100%;
          padding: 12px 24px;
          background: var(--accent, #00e5a0);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .withdraw-page button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .withdraw-page button:hover:not(:disabled) {
          opacity: 0.9;
        }
      `}</style>
    </>
  );
}