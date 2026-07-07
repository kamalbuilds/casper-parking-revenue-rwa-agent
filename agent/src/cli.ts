import { runDailyReport } from "./agent";
import * as fs from "fs";
import "dotenv/config";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: tsx src/cli.ts <csv-path> [day]");
    console.error("Example: tsx src/cli.ts sample-data/normal.csv 2024-07-01");
    process.exit(1);
  }

  const csvPath = args[0];
  const day = args[1];

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  try {
    console.log(`Processing daily report from ${csvPath}...`);
    if (day) {
      console.log(`Report date: ${day}`);
    }
    console.log("");

    const report = await runDailyReport(csvPath, day);

    console.log("=== DAILY PARKING REVENUE REPORT ===");
    console.log(`Date: ${report.day}`);
    console.log("");

    console.log("=== PARKING STATISTICS ===");
    console.log(`Total Revenue: ${report.stats.total_revenue_cspr} CSPR`);
    console.log(`Session Count: ${report.stats.session_count}`);
    console.log(`Average Ticket: ${report.stats.average_ticket_cspr} CSPR`);
    console.log(`Min Revenue: ${report.stats.min_revenue} CSPR`);
    console.log(`Max Revenue: ${report.stats.max_revenue} CSPR`);
    console.log("");

    console.log("=== ANOMALY DETECTION ===");
    console.log(`Status: ${report.anomaly_ok ? "CLEAN" : "FLAGGED"}`);
    console.log(`Report Hash: ${report.report_hash}`);
    console.log("");

    if (report.anomaly_report.reasons.length > 0) {
      console.log("Issues Found:");
      for (const reason of report.anomaly_report.reasons) {
        console.log(`  - ${reason}`);
      }
      console.log("");
    }

    console.log("Summary:");
    console.log(`  ${report.anomaly_report.summary}`);
    console.log("");

    console.log("=== RECOMMENDED DISTRIBUTION ===");
    for (const dist of report.recommended_distribution) {
      console.log(
        `${dist.holder}: ${dist.shares} shares = ${dist.estimated_payout_cspr.toFixed(2)} CSPR`
      );
    }
    console.log("");

    console.log("=== CONTRACT CALL ===");
    if (report.anomaly_ok) {
      console.log("✓ Ready for on-chain settlement");
      console.log(`  report_revenue(day="${report.day}", report_hash="${report.report_hash}", anomaly_ok=true)`);
    } else {
      console.log("✗ Blocked by anomaly detection");
      console.log(`  report_revenue(day="${report.day}", report_hash="${report.report_hash}", anomaly_ok=false)`);
      console.log("  Manual review required before settlement.");
    }
  } catch (error) {
    console.error("Error processing report:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
