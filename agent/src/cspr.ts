import {
  Args,
  CLValue,
  ContractCallBuilder,
  PublicKey,
  Transaction,
} from "casper-js-sdk";

export const REPORT_REVENUE_ENTRY_POINT = "report_revenue";
export const REPORT_REVENUE_PAYMENT_MOTES = 5_000_000_000;

export function isoDayToU64(day: string): string {
  const normalized = day.trim().replace(/-/g, "");
  if (!/^\d{8}$/.test(normalized)) {
    throw new Error(`Invalid day (expected YYYY-MM-DD): ${day}`);
  }
  return BigInt(normalized).toString();
}

export function csprToMotes(amountCspr: number): bigint {
  return BigInt(Math.round(amountCspr * 1_000_000_000));
}

export interface ReportRevenueTxInput {
  publicKeyHex: string;
  contractHash: string;
  chainName: string;
  day: string;
  reportHash: string;
  anomalyOk: boolean;
  revenueCspr: number;
}

export function buildReportRevenueTransaction(
  input: ReportRevenueTxInput
): Transaction {
  const {
    publicKeyHex,
    contractHash,
    chainName,
    day,
    reportHash,
    anomalyOk,
    revenueCspr,
  } = input;

  const callerPublicKey = PublicKey.fromHex(publicKeyHex);
  const normalizedContractHash = contractHash.replace(/^hash-/, "");
  const revenueMotes = csprToMotes(revenueCspr);

  const args = Args.fromMap({
    day: CLValue.newCLUint64(isoDayToU64(day)),
    report_hash: CLValue.newCLString(reportHash),
    anomaly_ok: CLValue.newCLValueBool(anomalyOk),
  });

  const transaction = new ContractCallBuilder()
    .from(callerPublicKey)
    .byHash(normalizedContractHash)
    .entryPoint(REPORT_REVENUE_ENTRY_POINT)
    .runtimeArgs(args)
    .chainName(chainName)
    .payment(REPORT_REVENUE_PAYMENT_MOTES)
    .build();

  return attachRevenueMotes(transaction, revenueMotes);
}

function attachRevenueMotes(
  transaction: Transaction,
  revenueMotes: bigint
): Transaction {
  const json = transaction.toJSON() as Record<string, unknown>;
  const motes = revenueMotes.toString();

  if (json.transaction && typeof json.transaction === "object") {
    const txn = json.transaction as Record<string, unknown>;
    if (txn.V1 && typeof txn.V1 === "object") {
      const v1 = txn.V1 as Record<string, unknown>;
      if (v1.payload && typeof v1.payload === "object") {
        (v1.payload as Record<string, unknown>).amount = motes;
      }
    }
  }

  return Transaction.fromJSON(json);
}

export function transactionToSignableJson(transaction: Transaction): object {
  return transaction.toJSON() as object;
}
