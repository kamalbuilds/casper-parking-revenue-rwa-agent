"use client";

import { useCsprAccount } from "@/lib/useCsprAccount";
import { truncateMiddle } from "@/lib/format";

export function ConnectWallet() {
  const { account, connecting, error, connect, disconnect } = useCsprAccount();

  if (account) {
    return (
      <div className="wallet-chip">
        <span className="wallet-dot" aria-hidden />
        <span className="mono">{truncateMiddle(account.public_key, 6, 4)}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={connect}
        disabled={connecting}
      >
        {connecting ? "Opening wallet..." : "Connect wallet"}
      </button>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
