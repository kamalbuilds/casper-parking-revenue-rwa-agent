import express, { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { runDailyReport, loadHolders } from "./agent";
import {
  REPORT_REVENUE_ENTRY_POINT,
  buildReportRevenueTransaction,
  csprToMotes,
  transactionToSignableJson,
} from "./cspr";
import "dotenv/config";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(express.json());

app.use((req: Request, res: Response, next) => {
  const origin = req.get("origin");
  if (origin === "http://localhost:3000" || origin === "http://localhost:3001") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

const RunAgentActionSchema = z.object({
  csvName: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  publicKeyHex: z.string().min(2),
  contractHash: z.string().optional(),
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/holders", (_req: Request, res: Response) => {
  try {
    const holders = loadHolders();
    const totalShares = holders.reduce((sum, h) => sum + h.shares, 0);
    res.json({ holders, total_shares: totalShares });
  } catch (error) {
    console.error("[/api/holders] error:", error);
    res.status(500).json({
      error: "Failed to load holder registry",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/daily-report", async (req: Request, res: Response) => {
  try {
    const { csvName } = req.body;

    if (!csvName) {
      res.status(400).json({ error: "csvName is required" });
      return;
    }

    const csvPath = path.join(__dirname, "..", "sample-data", csvName);

    if (!fs.existsSync(csvPath)) {
      res.status(404).json({ error: `CSV file not found: ${csvName}` });
      return;
    }

    const report = await runDailyReport(csvPath);
    res.json(report);
  } catch (error) {
    console.error("[/api/daily-report] error:", error);
    res.status(500).json({
      error: "Failed to process daily report",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/run-agent-action", async (req: Request, res: Response) => {
  try {
    const parsed = RunAgentActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { csvName, day, publicKeyHex } = parsed.data;
    const contractHash =
      parsed.data.contractHash || process.env.CONTRACT_HASH || process.env.CONTRACT_ADDRESS;
    const chainName = process.env.CASPER_CHAIN_NAME || "casper-test";

    if (!contractHash) {
      res.status(400).json({
        error: "contractHash is required (body or CONTRACT_HASH env)",
      });
      return;
    }

    const csvPath = path.join(__dirname, "..", "sample-data", csvName);
    if (!fs.existsSync(csvPath)) {
      res.status(404).json({ error: `CSV file not found: ${csvName}` });
      return;
    }

    const report = await runDailyReport(csvPath, day);

    const explanation = report.anomaly_ok
      ? `Clean report for ${report.day}: ${report.stats.session_count} sessions, ${report.stats.total_revenue_cspr} CSPR ready to settle on-chain.`
      : `Blocked: ${report.anomaly_report.reasons.length} anomaly issue(s). ${report.anomaly_report.summary}`;

    const txArgs = {
      entrypoint: REPORT_REVENUE_ENTRY_POINT,
      day: report.day,
      report_hash: report.report_hash,
      anomaly_ok: report.anomaly_ok,
      revenue_cspr: report.stats.total_revenue_cspr,
      revenue_motes: csprToMotes(report.stats.total_revenue_cspr).toString(),
    };

    let transaction: object | null = null;
    if (report.anomaly_ok) {
      const built = buildReportRevenueTransaction({
        publicKeyHex,
        contractHash,
        chainName,
        day: report.day,
        reportHash: report.report_hash,
        anomalyOk: report.anomaly_ok,
        revenueCspr: report.stats.total_revenue_cspr,
      });
      transaction = transactionToSignableJson(built);
    }

    res.json({
      success: true,
      report,
      tx_args: txArgs,
      transaction,
      explanation,
      blocked: !report.anomaly_ok,
    });
  } catch (error) {
    console.error("[/api/run-agent-action] error:", error);
    res.status(500).json({
      error: "Failed to run agent action",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Parking Revenue Agent listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Report endpoint: POST http://localhost:${PORT}/api/daily-report`);
  console.log(`Agent action: POST http://localhost:${PORT}/api/run-agent-action`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
