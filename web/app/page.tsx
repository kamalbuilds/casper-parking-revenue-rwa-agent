import { ConnectWallet } from "@/components/ConnectWallet";
import { ProofTable } from "@/components/ProofTable";
import { ReportForm } from "@/components/ReportForm";

export default function Home() {
  return (
    <main className="page">
      <div className="container">
        <header className="hero">
          <div className="hero-top">
            <span className="brand">Parking Revenue RWA</span>
            <ConnectWallet />
          </div>
          <h1>Agent-settled parking revenue shares</h1>
          <p className="hero-sub">
            Daily parking CSV flows through anomaly detection, then on-chain{" "}
            <code>report_revenue</code> splits proceeds to token holders when the
            report is clean.
          </p>
        </header>
        <ReportForm />
        <ProofTable />
      </div>
    </main>
  );
}
