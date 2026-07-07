"use client";

import { deployExplorerUrl, formatTimestamp, truncateMiddle } from "@/lib/format";
import type { ProofEvent } from "@/lib/types";
import { useEffect, useState } from "react";

type LoadState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; events: ProofEvent[] };

export function ProofTable() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error", message: body.error || "Failed to load events" });
          return;
        }
        if (!body.configured) {
          setState({ status: "unconfigured" });
          return;
        }
        setState({ status: "ready", events: body.events ?? [] });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Network error",
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h2>Proof</h2>
        <span className="badge">RevenueDistributed</span>
      </div>
      <p className="card-sub">
        Every successful settlement emits <code>RevenueDistributed</code>{" "}
        on-chain. This table reads events directly from CSPR.cloud.
      </p>
      {state.status === "loading" ? <p className="field-hint">Loading...</p> : null}
      {state.status === "unconfigured" ? (
        <div className="empty-state">
          Set CONTRACT_HASH and CSPR_CLOUD_ACCESS_KEY to read on-chain events.
        </div>
      ) : null}
      {state.status === "error" ? <div className="alert alert-error">{state.message}</div> : null}
      {state.status === "ready" && state.events.length === 0 ? (
        <div className="empty-state">No revenue distributions on-chain yet.</div>
      ) : null}
      {state.status === "ready" && state.events.length > 0 ? (
        <table className="proof-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Day</th>
              <th>Amount</th>
              <th>Report hash</th>
              <th>Deploy</th>
            </tr>
          </thead>
          <tbody>
            {state.events.map((e) => (
              <tr key={`${e.deployHash}-${e.reportHash}`}>
                <td>{e.time ? formatTimestamp(e.time) : "—"}</td>
                <td className="mono">{e.day || "—"}</td>
                <td className="mono">{e.amount || "—"}</td>
                <td className="mono">{truncateMiddle(e.reportHash, 8, 6)}</td>
                <td className="mono">
                  {e.deployHash ? (
                    <a href={deployExplorerUrl(e.deployHash)} target="_blank" rel="noopener noreferrer">
                      {truncateMiddle(e.deployHash, 8, 6)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
