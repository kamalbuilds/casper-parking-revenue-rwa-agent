import {
  Args,
  CLValue,
  ContractCallBuilder,
  PublicKey,
  Transaction,
} from "casper-js-sdk";
import { csprToMotes } from "./format";

export const REPORT_REVENUE_ENTRY_POINT = "report_revenue";

/** Gas budget for a single contract call (5 CSPR). */
export const REPORT_REVENUE_PAYMENT_MOTES = 5_000_000_000;

/** ISO date "YYYY-MM-DD" → u64 day key (YYYYMMDD). */
export function isoDayToU64(day: string): string {
  const normalized = day.trim().replace(/-/g, "");
  if (!/^\d{8}$/.test(normalized)) {
    throw new Error(`Invalid day (expected YYYY-MM-DD): ${day}`);
  }
  return BigInt(normalized).toString();
}

export interface ReportRevenueArgs {
  publicKeyHex: string;
  contractHash: string;
  chainName: string;
  day: string;
  reportHash: string;
  anomalyOk: boolean;
  /** Revenue attached to the payable entry point, in CSPR. */
  revenueCspr: number;
}

/**
 * Builds an unsigned `report_revenue` call matching RevenueSplitter:
 *   report_revenue(day: u64, report_hash: String, anomaly_ok: bool) #[odra(payable)]
 *
 * Revenue must be attached as native CSPR when signing (see revenueMotes in the
 * returned payload). casper-js-sdk 5.x does not expose attached_value on
 * ContractCallBuilder yet, so the UI/agent patch it into the transaction JSON.
 */
export function buildReportRevenueTransaction(
  input: ReportRevenueArgs
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

/**
 * Patches the built transaction JSON so the payable entry point receives
 * `revenueMotes` as attached native CSPR (Odra attached_value).
 */
export function attachRevenueMotes(
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
        const payload = v1.payload as Record<string, unknown>;
        if (payload.invocation_target && typeof payload.invocation_target === "object") {
          const target = payload.invocation_target as Record<string, unknown>;
          if (target.ByPackageHash && typeof target.ByPackageHash === "object") {
            (target.ByPackageHash as Record<string, unknown>).amount = motes;
          }
        }
        payload.amount = motes;
      }
    }
  }

  if (json.deploy && typeof json.deploy === "object") {
    const deploy = json.deploy as Record<string, unknown>;
    if (deploy.payment && typeof deploy.payment === "object") {
      const payment = deploy.payment as Record<string, unknown>;
      if (payment.ModuleBytes && typeof payment.ModuleBytes === "object") {
        (payment.ModuleBytes as Record<string, unknown>).amount = motes;
      }
    }
    deploy.amount = motes;
  }

  return Transaction.fromJSON(json);
}

export function transactionToSignableJson(transaction: Transaction): object {
  return transaction.toJSON() as object;
}

export function explorerDeployUrl(deployOrTxHash: string): string {
  return `https://testnet.cspr.live/deploy/${deployOrTxHash}`;
}
