"use client";

import { ConnectWallet } from "@/components/ConnectWallet";
import { DailyReportForm } from "@/components/DailyReportForm";
import { ProofTable } from "@/components/ProofTable";
import { truncateMiddle } from "@/lib/format";
import styles from "./page.module.css";

const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH;

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={styles.brand}>Parking Revenue RWA Agent</span>
            <ConnectWallet />
          </div>
          <h1>Agent-settled parking revenue shares</h1>
          <p className={styles.heroSub}>
            Ingest daily parking CSV, run anomaly checks, and settle pro-rata
            revenue on Casper when the report is clean. Every distribution emits
            on-chain proof.
          </p>
          <div className={styles.metaRow}>
            <span className={styles.metaChip}>Casper testnet</span>
            <span className={styles.metaChip}>
              Contract{" "}
              <span className={styles.metaValue}>
                {CONTRACT_HASH
                  ? truncateMiddle(CONTRACT_HASH, 8, 6)
                  : "not configured"}
              </span>
            </span>
          </div>
        </header>

        <div className={styles.grid}>
          <DailyReportForm />
        </div>

        <ProofTable />

        <footer className={styles.footer}>
          CSV ingest and anomaly detection run in the agent service. On-chain
          settlement calls RevenueSplitter.report_revenue with attached native
          CSPR. Testnet only.
        </footer>
      </div>
    </main>
  );
}
