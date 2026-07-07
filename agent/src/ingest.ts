import { parse } from "csv-parse/sync";
import * as fs from "fs";

export interface ParkingSession {
  session_id: string;
  lot_id: string;
  entry_time: string;
  exit_time: string;
  amount_cspr: number;
  payment_method: string;
}

export interface ParkingStats {
  total_revenue_cspr: number;
  session_count: number;
  average_ticket_cspr: number;
  min_revenue: number;
  max_revenue: number;
  sessions: ParkingSession[];
  raw_csv_content: string;
}

export function ingestCSV(csvPath: string): ParkingStats {
  const rawContent = fs.readFileSync(csvPath, "utf-8");

  const records = parse(rawContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const sessions: ParkingSession[] = records.map((row) => {
    const amountCspr = parseFloat(row.amount_cspr || "0");
    return {
      session_id: row.session_id || "",
      lot_id: row.lot_id || "",
      entry_time: row.entry_time || "",
      exit_time: row.exit_time || "",
      amount_cspr: amountCspr,
      payment_method: row.payment_method || "unknown",
    };
  });

  const totalRevenue = sessions.reduce((sum, s) => sum + s.amount_cspr, 0);
  const sessionCount = sessions.length;
  const averageTicket = sessionCount > 0 ? totalRevenue / sessionCount : 0;

  const revenueValues = sessions.map((s) => s.amount_cspr);
  const minRevenue = sessionCount > 0 ? Math.min(...revenueValues) : 0;
  const maxRevenue = sessionCount > 0 ? Math.max(...revenueValues) : 0;

  return {
    total_revenue_cspr: parseFloat(totalRevenue.toFixed(2)),
    session_count: sessionCount,
    average_ticket_cspr: parseFloat(averageTicket.toFixed(2)),
    min_revenue: parseFloat(minRevenue.toFixed(2)),
    max_revenue: parseFloat(maxRevenue.toFixed(2)),
    sessions,
    raw_csv_content: rawContent,
  };
}

export function normalizeCSVForHash(stats: ParkingStats): string {
  const lines = [
    "session_id,lot_id,entry_time,exit_time,amount_cspr,payment_method",
  ];
  for (const session of stats.sessions) {
    lines.push(
      `${session.session_id},${session.lot_id},${session.entry_time},${session.exit_time},${session.amount_cspr},${session.payment_method}`
    );
  }
  return lines.join("\n");
}
