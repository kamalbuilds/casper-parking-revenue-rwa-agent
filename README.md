# Casper Parking Revenue RWA Agent

**Agent-settled cashflow shares for parking revenue.**

An AI agent that ingests daily parking revenue CSV files, runs anomaly detection, and settles pro-rata revenue distributions to tokenized cashflow holders through an on-chain Odra `RevenueSplitter` contract. Built with the Odra framework for Casper 2.0.

**Repository:** [github.com/kamalbuilds/casper-parking-revenue-rwa-agent](https://github.com/kamalbuilds/casper-parking-revenue-rwa-agent)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Contract Addresses](#contract-addresses)
- [Getting Started](#getting-started)
- [Frontend](#frontend)
- [Contract Functions](#contract-functions)
- [Security](#security)
- [License](#license)
- [Links](#links)

---

## Overview

Casper Parking Revenue RWA Agent automates the settlement pipeline for parking revenue cashflow shares. A lot agent reports daily sessions from CSV data, an anomaly checker approves or blocks the report, and the `RevenueSplitter` contract distributes native CSPR pro-rata to registered holders when the report is clean.

### Key Metrics (Testnet)

| Metric | Value |
|--------|-------|
| **Network** | Casper Testnet |
| **Contract** | RevenueSplitter |
| **Agent Port** | 3001 |
| **Frontend** | Next.js 14 on port 3000 |

### Problem

Parking revenue settlement and audits are slow. Operators and investors need auditable, repeatable revenue distribution with on-chain proof. A focused agent workflow aligns with Casper's real-world asset settlement direction.

### Solution

A lot agent reports daily sessions from CSV data, revenue is attested with anomaly checks, and the Odra splitter distributes yield to tokenized cashflow holders. Each day can be reported exactly once, and flagged anomalies block on-chain settlement.

---

## Features

- **CSV Ingest**: Daily parking session files parsed and summarized by the agent backend
- **AI Anomaly Detection**: OpenRouter-powered checker flags suspicious reports before settlement
- **Pro-Rata Distribution**: `RevenueSplitter` splits attached native CSPR by holder share weights
- **One Report Per Day**: Duplicate day reports revert with `DayAlreadyReported`
- **On-Chain Proofs**: `HolderRegistered` and `RevenueDistributed` events for audit trails
- **CSPR.click Signing**: Frontend builds and signs `report_revenue` payable transactions
- **Investor Dashboard**: Proof table reads `RevenueDistributed` events from CSPR.cloud

---

## Architecture

```
                    +------------------+
                    |   Owner Wallet   |
                    |   (CSPR.click)   |
                    +--------+---------+
                             |
                             v
+----------------------------------------------------------+
|              Frontend (Next.js, port 3000)                |
|  - DailyReportForm: Select CSV, run agent, sign tx        |
|  - ProofTable: View RevenueDistributed events             |
+---------------------------+------------------------------+
                            |
                            v
+----------------------------------------------------------+
|           Agent Backend (Express, port 3001)              |
|  - POST /api/daily-report: Parse CSV, run anomaly check   |
|  - POST /api/run-agent-action: Build signable transaction  |
|  - GET /api/holders: Load holder registry                 |
+---------------------------+------------------------------+
                            |
                            v
+----------------------------------------------------------+
|            RevenueSplitter Contract (Odra)                |
|  - register_holder(): Owner adds cashflow share holders   |
|  - report_revenue(): Payable split across all holders     |
+--------------+-----------------------------+--------------+
               |                             |
               v                             v
    +------------------+          +------------------+
    |  Holder A (60%)  |          |  Holder B (40%)  |
    |  receives payout |          |  receives payout |
    +------------------+          +------------------+
```

---

## Smart Contracts

### RevenueSplitter

Pro-rata parking revenue distribution for RWA cashflow holders. The owner registers holders with a number of shares. A daily revenue report is submitted as a payable call: the attached native token amount is the day's revenue, split pro-rata across all registered holders by `holder_shares / total_shares`.

**Entry Points:**

| Function | Description | Parameters |
|----------|-------------|------------|
| `init` | Initialize contract with deployer as owner | - |
| `register_holder` | Register or top up holder shares (owner only) | `holder: Address`, `shares: u64` |
| `report_revenue` | Report and distribute one day's revenue (payable, owner only) | `day: u64`, `report_hash: String`, `anomaly_ok: bool` |
| `get_owner` | Returns the current contract owner | - |
| `get_total_shares` | Returns total registered shares | - |
| `get_holder_shares` | Returns shares for a holder, or 0 | `holder: Address` |
| `is_day_reported` | Returns true if day already has a report | `day: u64` |

**Events:**

| Event | Fields | When Emitted |
|-------|--------|--------------|
| `HolderRegistered` | `holder`, `shares` | Owner registers or tops up holder shares |
| `RevenueDistributed` | `day`, `amount`, `total_shares`, `report_hash` | Day's revenue successfully distributed |

**Errors:**

| Code | Error | Condition |
|------|-------|-----------|
| 1 | `NotOwner` | Non-owner calls an owner-only entrypoint |
| 2 | `DayAlreadyReported` | Day already has a finalized report |
| 3 | `AnomalyFlagged` | Anomaly checker did not clear the report |
| 4 | `NoHolders` | No shares have been registered |

---

## Contract Addresses

### Casper Testnet

| Item | Value |
|------|-------|
| **Contract** | RevenueSplitter |
| **Package Hash** | `hash-6e4bb9195738936a07026ac90dc1d652b118800ce21144c49c85d54e317c38de` |
| **Deploy Transaction** | `01bf2a6f652671a4da3217c3de97d5ba29c97484c4059e3271c0da2ce237815e` |

### Network Configuration

| Setting | Value |
|---------|-------|
| **Chain Name** | `casper-test` |
| **Node URL** | `https://node.testnet.casper.network` |
| **Explorer** | `https://testnet.cspr.live` |

---

## Getting Started

### Prerequisites

- Rust 1.70+
- [cargo-odra](https://github.com/odradev/cargo-odra)
- Node.js 18+
- OpenRouter API key (for anomaly detection)

### Build Contracts

```bash
cd contract
cargo odra build -b casper
```

### Test Contracts

```bash
cd contract
cargo odra test
```

### Run Agent Backend

```bash
cd agent
cp .env.example .env
# Edit .env with OPENROUTER_API_KEY and CONTRACT_ADDRESS
npm install
npm run dev
```

The agent listens on `http://localhost:3001`.

### Run Frontend

```bash
cd web
npm install
npm run dev
```

The frontend listens on `http://localhost:3000`.

Set environment variables before starting (see Frontend section below).

### Quick Demo

```bash
# Check agent health
curl http://localhost:3001/health

# List registered holders
curl http://localhost:3001/api/holders

# Run daily report on sample CSV
curl -X POST http://localhost:3001/api/daily-report \
  -H "Content-Type: application/json" \
  -d '{"csvName":"parking-day-01.csv"}'

# Full agent action with transaction build
curl -X POST http://localhost:3001/api/run-agent-action \
  -H "Content-Type: application/json" \
  -d '{"csvName":"parking-day-01.csv","publicKeyHex":"02..."}'
```

---

## Frontend

The frontend is a Next.js 14 application with CSPR.click wallet integration.

### Pages and Components

| Component | Purpose |
|-----------|---------|
| **DailyReportForm** | Select a sample CSV, run the agent, and sign the settlement transaction |
| **ProofTable** | Display `RevenueDistributed` events from CSPR.cloud |
| **ConnectWallet** | CSPR.click wallet connection |

### Wallet Integration

Uses CSPR.click for wallet connection supporting:

- Casper Wallet
- Ledger
- Torus Wallet
- CasperDash
- MetaMask Snap

### Environment Variables

**Agent (`agent/.env`):**

```env
OPENROUTER_API_KEY=your-openrouter-api-key
CASPER_NODE_RPC=https://node.testnet.casper.network/rpc
CASPER_CHAIN_NAME=casper-test
CONTRACT_ADDRESS=hash-6e4bb9195738936a07026ac90dc1d652b118800ce21144c49c85d54e317c38de
PORT=3001
```

**Frontend (`web/.env.local`):**

```env
NEXT_PUBLIC_CSPR_CLICK_APP_ID=your-cspr-click-app-id
NEXT_PUBLIC_AGENT_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_HASH=hash-6e4bb9195738936a07026ac90dc1d652b118800ce21144c49c85d54e317c38de
NEXT_PUBLIC_CASPER_CHAIN_NAME=casper-test
CONTRACT_HASH=hash-6e4bb9195738936a07026ac90dc1d652b118800ce21144c49c85d54e317c38de
CSPR_CLOUD_ACCESS_KEY=your-cspr-cloud-access-key
```

---

## Contract Functions

### Daily Settlement Flow

```
+----------+   select CSV    +------------------+
|  Owner   | --------------> | DailyReportForm  |
|          |                 | (Frontend)       |
+----------+                 +--------+---------+
                                      |
                                      v
                               +--------------+
                               | Agent (3001) |
                               | daily-report |
                               +------+-------+
                                      |
                         anomaly_ok?  |
                         +------------+------------+
                         v                         v
                +----------------+          +----------------+
                | Build tx for   |          | Block: return  |
                | report_revenue |          | explanation    |
                +--------+-------+          +----------------+
                         |
                         v
                +----------------+
                | CSPR.click     |
                | sign + send    |
                +--------+-------+
                         |
                         v
                +----------------+
                | RevenueSplitter|
                | distribute CSPR|
                +----------------+
```

### Holder Registration Flow

```
+-----------+                           +----------------+
|   Owner   |                           | RevenueSplitter|
+-----+-----+                           +-------+--------+
      |                                         |
      | register_holder(holder, shares)         |
      | --------------------------------------> |
      |                                         | emit HolderRegistered
      |                                         | update total_shares
      |                                         |
      | get_holder_shares(holder)               |
      | --------------------------------------> |
      |                                         |
      | get_total_shares()                      |
      | --------------------------------------> |
```

### Revenue Distribution Logic

On `report_revenue` success:

1. Verify caller is owner
2. Revert if day already reported
3. Revert if `anomaly_ok` is false
4. Revert if no holders registered
5. Mark day as reported (checks-effects-interactions)
6. For each holder: `payout = attached_value * holder_shares / total_shares`
7. Transfer payout to each holder
8. Emit `RevenueDistributed`

---

## Security

### Access Control

- Owner-only functions: `register_holder`, `report_revenue`
- Deployer becomes owner on `init`
- Agent pipeline calls `report_revenue` through the owner-controlled account in this MVP

### Safety Features

- One report per day enforced on-chain (`DayAlreadyReported`)
- Anomaly flag must be true for settlement (`AnomalyFlagged`)
- Checks-effects-interactions pattern: day marked reported before payouts
- Pro-rata math uses integer division with zero-payout skip
- Holder list deduplication on repeat `register_holder` calls

### Agent Safety

- Anomaly detection runs off-chain before transaction build
- Blocked reports return explanation without a signable transaction
- Report hash recorded on-chain for audit trail

### Scope Note

This MVP uses sample parking CSV data for demonstration. It does not claim integration with real parking operators unless explicitly configured.

### Audits

- [ ] Pending security audit

---

## License

MIT License

---

## Links

- **GitHub**: [casper-parking-revenue-rwa-agent](https://github.com/kamalbuilds/casper-parking-revenue-rwa-agent)
- **Testnet Explorer**: [cspr.live](https://testnet.cspr.live/deploy/01bf2a6f652671a4da3217c3de97d5ba29c97484c4059e3271c0da2ce237815e)
- **Casper Documentation**: [docs.casper.network](https://docs.casper.network)
- **Odra Framework**: [odra.dev](https://odra.dev)
- **CSPR.click**: [cspr.click](https://cspr.click)
- **CSPR.cloud**: [docs.cspr.cloud](https://docs.cspr.cloud)
