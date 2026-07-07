export interface ProofEvent {
  time: string;
  day: string;
  amount: string;
  reportHash: string;
  deployHash: string;
}

export interface AgentActionResponse {
  success: boolean;
  blocked: boolean;
  explanation: string;
  tx_args: {
    day: string;
    report_hash: string;
    anomaly_ok: boolean;
    revenue_cspr: number;
  };
  transaction: Record<string, unknown> | null;
  report: {
    day: string;
    stats: {
      total_revenue_cspr: number;
      session_count: number;
      average_ticket_cspr: number;
    };
    anomaly_report: {
      anomaly_ok: boolean;
      reasons: string[];
      summary: string;
    };
    report_hash: string;
    anomaly_ok: boolean;
    recommended_distribution: Array<{
      holder: string;
      shares: number;
      estimated_payout_cspr: number;
    }>;
  };
}
