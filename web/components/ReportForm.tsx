"use client";

import { formatCspr, truncateMiddle } from "@/lib/format";
import { useCsprAccount } from "@/lib/useCsprAccount";
import { useState } from "react";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";
const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH || "";

interface AgentActionResult {
  success: boolean;
  blocked: boolean;
  explanation: string;
  report?: {
    day: string;
    report_hash: string;
    anomaly_ok: boolean;
    stats: { total_revenue_cspr: number; session_count: number };
  };
  transaction?: object;
}

export function ReportForm() {
  const { account } = useCsprAccount();
  const [csvName, setCsvName] = useState("normal.csv");
  const [day, setDay] = useState("2024-07-01");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction() {
    if (!account?.public_key) {
      setError("Connect wallet first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${AGENT_URL}/api/run-agent-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvName,
          day,
          publicKeyHex: account.public_key,
          contractHash: CONTRACT_HASH || undefined,
        }),
      });
      const body = (await res.json()) as AgentActionResult & { error?: string };
      if (!res.ok) {
        setError(body.error || `Agent failed (${res.status})`);
        return;
      }
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Daily revenue report</h2>
        <span className="badge">Agent + anomaly check</span>
      </div>
      <p className="card-sub">
        Ingest parking CSV, run deterministic anomaly checks, then build a{" "}
        <code>report_revenue</code> transaction when the report is clean.
      </p>

      <div className="field">
        <label htmlFor="csv">Sample CSV</label>
        <select
          id="csv"
          className="input"
          value={csvName}
          onChange={(e) => setCsvName(e.target.value)}
        >
          <option value="normal.csv">normal.csv (clean)</option>
          <option value="anomaly.csv">anomaly.csv (flagged)</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="day">Report day</label>
        <input
          id="day"
          className="input mono"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </div>

      <button type="button" className="btn btn-primary" disabled={loading} onClick={runAction}>
        {loading ? "Running agent..." : "Run agent action"}
      </button>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {result ? (
        <div className={`result ${result.blocked ? "result-blocked" : "result-ok"}`}>
          <p>{result.explanation}</p>
          {result.report ? (
            <p className="field-hint mono">
              {result.report.day} · {result.report.stats.session_count} sessions ·{" "}
              {formatCspr(result.report.stats.total_revenue_cspr)} · hash{" "}
              {truncateMiddle(result.report.report_hash, 8, 6)}
            </p>
          ) : null}
          {result.transaction ? (
            <p className="field-hint">
              Unsigned transaction returned. Sign via wallet integration when contract is deployed.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
