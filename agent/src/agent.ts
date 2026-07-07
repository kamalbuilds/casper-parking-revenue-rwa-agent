import { createHash } from "crypto";
import { ingestCSV, normalizeCSVForHash, ParkingStats } from "./ingest";
import { runAnomalyCheck, AnomalyReport } from "./anomaly";
import * as fs from "fs";

export interface RevenueDistribution {
  holder: string;
  shares: number;
  estimated_payout_cspr: number;
}

export interface DailyReport {
  day: string;
  stats: ParkingStats;
  anomaly_report: AnomalyReport;
  report_hash: string;
  anomaly_ok: boolean;
  recommended_distribution: RevenueDistribution[];
}

function computeReportHash(stats: ParkingStats): string {
  const normalized = normalizeCSVForHash(stats);
  return createHash("sha256").update(normalized).digest("hex");
}

export function loadHolders(): Array<{ holder: string; shares: number }> {
  const holdersPath = `${__dirname}/holders.json`;
  if (fs.existsSync(holdersPath)) {
    const content = fs.readFileSync(holdersPath, "utf-8");
    return JSON.parse(content);
  }
  return [
    { holder: "operator_primary", shares: 60 },
    { holder: "investor_fund_a", shares: 25 },
    { holder: "municipality", shares: 15 },
  ];
}

function computeDistribution(
  totalRevenue: number,
  holders: Array<{ holder: string; shares: number }>
): RevenueDistribution[] {
  const totalShares = holders.reduce((sum, h) => sum + h.shares, 0);
  return holders.map((holder) => ({
    holder: holder.holder,
    shares: holder.shares,
    estimated_payout_cspr:
      (totalRevenue * holder.shares) / totalShares,
  }));
}

export async function runDailyReport(csvPath: string, day?: string): Promise<DailyReport> {
  const stats = ingestCSV(csvPath);
  const anomalyReport = await runAnomalyCheck(stats);
  const reportHash = computeReportHash(stats);
  const holders = loadHolders();
  const distribution = computeDistribution(stats.total_revenue_cspr, holders);

  const reportDay = day || new Date().toISOString().split("T")[0];

  return {
    day: reportDay,
    stats,
    anomaly_report: anomalyReport,
    report_hash: reportHash,
    anomaly_ok: anomalyReport.anomaly_ok,
    recommended_distribution: distribution,
  };
}
