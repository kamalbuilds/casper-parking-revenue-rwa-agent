# Parking Revenue RWA Agent

Agent-settled cashflow shares for parking revenue. This backend service ingests daily parking session data, runs deterministic and AI-powered anomaly detection, computes report hashes, and prepares revenue distribution splits for on-chain settlement.

## Quick Start

### Install

```bash
export PATH="/Users/kamal/.nvm/versions/node/v24.9.0/bin:$PATH"
npm install
```

### Verify TypeScript

```bash
npx tsc --noEmit
```

### Run CLI on Sample Data

Normal parking day (should pass):
```bash
npm run cli sample-data/normal.csv 2024-07-01
```

Anomalous parking day (should be flagged):
```bash
npm run cli sample-data/anomaly.csv 2024-07-02
```

### Start Server

```bash
npm run dev
```

Server listens on port 3001. Health check: `GET http://localhost:3001/health`

Report endpoint: `POST http://localhost:3001/api/daily-report`
```json
{
  "csvName": "normal.csv"
}
```

## Architecture

### Modules

1. **ai.ts** - OpenRouter client via openai SDK. Summarizes anomalies in plain language.
2. **ingest.ts** - CSV parsing and statistics computation (total revenue, avg ticket, min/max).
3. **anomaly.ts** - Deterministic anomaly checks (duplicates, negative durations, revenue bounds, session count spikes, missing data) plus AI summary.
4. **agent.ts** - Daily report orchestrator: ingest, anomaly check, compute SHA256 report hash, calculate revenue distribution across registered holders.
5. **server.ts** - Express server with CORS, health check, and daily-report endpoint.
6. **cli.ts** - CLI interface for testing reports locally.

### Data Flow

```
CSV file
  ↓
ingestCSV() → ParkingStats { sessions, totals, raw_csv_content }
  ↓
runAnomalyCheck() → AnomalyReport { anomaly_ok, reasons, summary }
  ↓
computeReportHash() → SHA256 of normalized CSV
  ↓
computeDistribution() → RevenueDistribution[] for registered holders
  ↓
DailyReport { day, stats, anomaly_report, report_hash, anomaly_ok, distribution }
```

## Anomaly Detection

### Deterministic Checks

- Duplicate session IDs
- Negative or zero-duration sessions
- Sessions exceeding 72-hour max parking
- Revenue below 0.01 CSPR or above 1000 CSPR per session
- Average ticket price above 100 CSPR
- Session count spike (>50% increase from baseline ~50 sessions)
- Missing lot_id or session_id

### AI Summary

If anomalies are found, OpenRouter/Claude Haiku summarizes the findings in plain language for operator review.

## Environment Variables

See `.env.example`. Required for deployment:

- `OPENROUTER_API_KEY` - API key for OpenRouter (AI summaries)
- `PORT` - Server port (default: 3001)
- `CASPER_NODE_RPC` - Casper testnet RPC endpoint
- `CASPER_CHAIN_NAME` - Chain name (casper-test for testnet)
- `CONTRACT_ADDRESS` - Deployed RevenueSplitter contract hash

## Revenue Distribution

Registered holders are defined in `src/holders.json`:
```json
[
  { "holder": "operator_primary", "shares": 60 },
  { "holder": "investor_fund_a", "shares": 25 },
  { "holder": "municipality", "shares": 15 }
]
```

Distribution is computed as:
```
holder_payout = total_revenue * (holder_shares / total_shares)
```

## Contract Interface

When `anomaly_ok` is true, the report can be submitted on-chain:

```rust
pub fn report_revenue(
  &mut self,
  day: String,
  report_hash: String,
  anomaly_ok: bool
) payable
```

The contract emits a `RevenueDistributed` event with distribution details, or reverts with:
- `DayAlreadyReported` - duplicate day
- `AnomalyFlagged` - anomaly_ok=false and contract rejects
- `NoHolders` - no registered holders

## Sample Data

- `sample-data/normal.csv` - 52 parking sessions with realistic revenue (8.75-87.25 CSPR). Passes anomaly checks.
- `sample-data/anomaly.csv` - 70 sessions with intentional anomalies:
  - Duplicate session ID (P001)
  - Negative revenue (P003: -18.75 CSPR)
  - Suspiciously high revenue (P004: 1250.50 CSPR, P015: 999.99 CSPR)
  - Suspiciously low revenue (P042: 0.005 CSPR)
  - Session count spike (70 vs baseline 50)
  - Reversed timestamps (P003 exits before entry)

Flags all these issues.

## Development

Scripts:
- `npm run dev` - Start Express server with auto-reload
- `npm run cli <csv> [day]` - Run CLI against a CSV file
- `npm run typecheck` - Verify TypeScript (no compile)
- `npm run build` - Compile to dist/

No runtime mocks or stubs. All parsing, detection, and hashing is real.
