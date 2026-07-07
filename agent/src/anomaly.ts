import { ParkingStats } from "./ingest";
import { summarizeAnomalies } from "./ai";

export interface AnomalyReport {
  anomaly_ok: boolean;
  reasons: string[];
  summary: string;
}

const PLAUSIBILITY_BOUNDS = {
  MAX_SESSION_REVENUE: 1000, // CSPR per session seems unreasonable
  MIN_SESSION_REVENUE: 0.01, // below 0.01 CSPR is suspicious
  MAX_AVG_REVENUE: 100, // avg ticket price
  MAX_SESSION_DURATION_HOURS: 72, // 3 days max parking
};

const BASELINE_SESSION_COUNT = 50; // normal day has ~50 sessions
const SPIKE_THRESHOLD = 1.5; // 50% increase from baseline

export function runDeterministicChecks(stats: ParkingStats): string[] {
  const findings: string[] = [];

  // Check 1: Duplicate session IDs
  const sessionIds = new Set<string>();
  for (const session of stats.sessions) {
    if (sessionIds.has(session.session_id)) {
      findings.push(
        `Duplicate session ID detected: ${session.session_id}`
      );
    }
    sessionIds.add(session.session_id);
  }

  // Check 2: Negative or zero duration sessions
  for (const session of stats.sessions) {
    const entryTime = new Date(session.entry_time).getTime();
    const exitTime = new Date(session.exit_time).getTime();

    if (isNaN(entryTime) || isNaN(exitTime)) {
      findings.push(
        `Invalid timestamp format in session ${session.session_id}`
      );
      continue;
    }

    const durationMs = exitTime - entryTime;
    if (durationMs <= 0) {
      findings.push(
        `Non-positive duration in session ${session.session_id}: ${durationMs}ms`
      );
    }

    const durationHours = durationMs / (1000 * 60 * 60);
    if (durationHours > PLAUSIBILITY_BOUNDS.MAX_SESSION_DURATION_HOURS) {
      findings.push(
        `Unusually long session ${session.session_id}: ${durationHours.toFixed(1)} hours`
      );
    }
  }

  // Check 3: Revenue plausibility
  for (const session of stats.sessions) {
    if (session.amount_cspr < PLAUSIBILITY_BOUNDS.MIN_SESSION_REVENUE) {
      findings.push(
        `Suspiciously low revenue in session ${session.session_id}: ${session.amount_cspr} CSPR`
      );
    }
    if (session.amount_cspr > PLAUSIBILITY_BOUNDS.MAX_SESSION_REVENUE) {
      findings.push(
        `Suspiciously high revenue in session ${session.session_id}: ${session.amount_cspr} CSPR`
      );
    }
  }

  // Check 4: Session count spike
  if (stats.session_count > BASELINE_SESSION_COUNT * SPIKE_THRESHOLD) {
    findings.push(
      `Unexpected spike in session count: ${stats.session_count} vs baseline ${BASELINE_SESSION_COUNT}`
    );
  }

  // Check 5: Average revenue anomaly
  if (stats.average_ticket_cspr > PLAUSIBILITY_BOUNDS.MAX_AVG_REVENUE) {
    findings.push(
      `Average ticket price unusually high: ${stats.average_ticket_cspr.toFixed(2)} CSPR`
    );
  }

  // Check 6: Missing or malformed data
  for (const session of stats.sessions) {
    if (!session.lot_id || !session.session_id) {
      findings.push(`Session with missing lot_id or session_id detected`);
      break;
    }
  }

  return findings;
}

export async function runAnomalyCheck(stats: ParkingStats): Promise<AnomalyReport> {
  const deterministicFindings = runDeterministicChecks(stats);

  let summary = "";
  if (deterministicFindings.length === 0) {
    summary = "No anomalies detected. Revenue report appears clean.";
  } else {
    try {
      summary = await summarizeAnomalies(deterministicFindings);
    } catch (error) {
      summary = `Detected ${deterministicFindings.length} anomaly/anomalies. Manual review recommended.`;
    }
  }

  const anomaly_ok = deterministicFindings.length === 0;

  return {
    anomaly_ok,
    reasons: deterministicFindings,
    summary,
  };
}
