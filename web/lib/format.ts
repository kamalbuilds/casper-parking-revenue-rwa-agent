const CSPR_EXPLORER_BASE =
  process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME === "casper"
    ? "https://cspr.live"
    : "https://testnet.cspr.live";

export function truncateMiddle(value: string, head = 6, tail = 6): string {
  if (!value || value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function transactionExplorerUrl(transactionHash: string): string {
  return `${CSPR_EXPLORER_BASE}/transaction/${transactionHash}`;
}

export function deployExplorerUrl(deployHash: string): string {
  return `${CSPR_EXPLORER_BASE}/deploy/${deployHash}`;
}

export function accountExplorerUrl(publicKeyHex: string): string {
  return `${CSPR_EXPLORER_BASE}/account/${publicKeyHex}`;
}

export function formatCspr(amount: number, fractionDigits = 2): string {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} CSPR`;
}

export function csprToMotes(amountCspr: number): bigint {
  // 1 CSPR = 1,000,000,000 motes. Round to the nearest mote to avoid float drift.
  return BigInt(Math.round(amountCspr * 1_000_000_000));
}

export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
