"use client";

import { useClickRef } from "@make-software/csprclick-ui";
import { useCsprAccount } from "@/lib/useCsprAccount";
import { explorerDeployUrl } from "@/lib/cspr";
import type { AgentActionResponse } from "@/lib/types";
import { formatCspr } from "@/lib/format";
import { useState } from "react";
import styles from "./DailyReportForm.module.css";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

type SignState =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "sent"; txHash: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export function DailyReportForm() {
  const { account } = useCsprAccount();
  const clickRef = useClickRef();

  const [csvName, setCsvName] = useState("normal.csv");
  const [day, setDay] = useState("2024-07-01");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentActionResponse | null>(null);
  const [signState, setSignState] = useState<SignState>({ status: "idle" });

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!account) {
      setApiError("Connect a wallet before running the agent action.");
      return;
    }

    setSubmitting(true);
    setApiError(null);
    setResult(null);
    setSignState({ status: "idle" });

    try {
      const res = await fetch(`${AGENT_URL}/api/run-agent-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvName,
          day,
          publicKeyHex: account.public_key,
          contractHash: process.env.NEXT_PUBLIC_CONTRACT_HASH,
        }),
      });

      const body = (await res.json()) as AgentActionResponse & { error?: string };

      if (!res.ok || body.error) {
        setApiError(body.error || `Agent request failed (${res.status})`);
        return;
      }

      setResult(body);
    } catch (err) {
      setApiError(
        `Could not reach agent at ${AGENT_URL}. (${
          err instanceof Error ? err.message : String(err)
        })`
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignAndSubmit() {
    if (!result?.transaction || !account || !clickRef) {
      return;
    }

    setSignState({ status: "signing" });
    try {
      const sendResult = await clickRef.send(
        result.transaction,
        account.public_key
      );

      if (!sendResult || sendResult.cancelled) {
        setSignState({ status: "cancelled" });
        return;
      }
      if (sendResult.error) {
        setSignState({ status: "error", message: sendResult.error });
        return;
      }

      const txHash =
        sendResult.transactionHash || sendResult.deployHash || "";
      setSignState({ status: "sent", txHash });
    } catch (err) {
      setSignState({
        status: "error",
        message: err instanceof Error ? err.message : "Signing failed",
      });
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2>Daily revenue report</h2>
        <span className={styles.badge}>Agent pipeline</span>
      </div>
      <p className={styles.sub}>
        Ingest parking CSV, run anomaly checks, and build a{" "}
        <code>report_revenue</code> transaction when the report is clean.
      </p>

      <form onSubmit={handleAnalyze} className={styles.form}>
        <label className={styles.field}>
          <span>CSV file</span>
          <select
            value={csvName}
            onChange={(e) => setCsvName(e.target.value)}
          >
            <option value="normal.csv">normal.csv (clean day)</option>
            <option value="anomaly.csv">anomaly.csv (flagged)</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Report day</span>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </label>

        <button type="submit" className={styles.primaryBtn} disabled={submitting}>
          {submitting ? "Running agent..." : "Run agent action"}
        </button>
      </form>

      {apiError ? <div className={styles.alertError}>{apiError}</div> : null}

      {result ? (
        <div className={styles.result}>
          <p className={styles.explanation}>{result.explanation}</p>

          <dl className={styles.stats}>
            <div>
              <dt>Sessions</dt>
              <dd>{result.report.stats.session_count}</dd>
            </div>
            <div>
              <dt>Revenue</dt>
              <dd>{formatCspr(result.report.stats.total_revenue_cspr)}</dd>
            </div>
            <div>
              <dt>Report hash</dt>
              <dd className="mono">{result.report.report_hash.slice(0, 16)}...</dd>
            </div>
          </dl>

          {result.blocked ? (
            <div className={styles.alertError}>
              <strong>Blocked on-chain.</strong> Fix anomalies before settlement.
              {result.report.anomaly_report.reasons.length > 0 ? (
                <ul>
                  {result.report.anomaly_report.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className={styles.alertOk}>
              <strong>Ready to settle.</strong> Sign the payable{" "}
              <code>report_revenue</code> call with{" "}
              {formatCspr(result.tx_args.revenue_cspr)} attached.
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleSignAndSubmit}
                disabled={signState.status === "signing"}
              >
                {signState.status === "signing"
                  ? "Confirm in wallet..."
                  : "Sign & submit on testnet"}
              </button>
              {signState.status === "sent" ? (
                <p className={styles.txLink}>
                  Transaction:{" "}
                  <a
                    href={explorerDeployUrl(signState.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono"
                  >
                    {signState.txHash}
                  </a>
                </p>
              ) : null}
              {signState.status === "cancelled" ? (
                <p>Signing cancelled in wallet.</p>
              ) : null}
              {signState.status === "error" ? (
                <p className={styles.alertError}>{signState.message}</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
