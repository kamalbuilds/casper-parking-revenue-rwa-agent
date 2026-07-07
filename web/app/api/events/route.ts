import { NextResponse } from "next/server";
import type { ProofEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CsprCloudEventEnvelope {
  name?: string;
  event_name?: string;
  contract_event_name?: string;
  timestamp?: string;
  deploy_hash?: string;
  transaction_hash?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function pickString(
  envelope: CsprCloudEventEnvelope,
  keys: string[]
): string {
  for (const key of keys) {
    const fromData = envelope.data?.[key];
    if (typeof fromData === "string") return fromData;
    if (typeof fromData === "number") return String(fromData);

    const fromTop = envelope[key];
    if (typeof fromTop === "string") return fromTop;
    if (typeof fromTop === "number") return String(fromTop);
  }
  return "";
}

function isRevenueDistributed(envelope: CsprCloudEventEnvelope): boolean {
  const name =
    envelope.name || envelope.event_name || envelope.contract_event_name;
  if (name) {
    return name === "RevenueDistributed";
  }
  return Boolean(envelope.data?.report_hash);
}

function toProofEvent(envelope: CsprCloudEventEnvelope): ProofEvent {
  return {
    time: envelope.timestamp || "",
    day: pickString(envelope, ["day"]),
    amount: pickString(envelope, [
      "amount",
      "total_distributed",
      "totalDistributed",
    ]),
    reportHash: pickString(envelope, ["report_hash", "reportHash"]),
    deployHash: envelope.deploy_hash || envelope.transaction_hash || "",
  };
}

export async function GET() {
  const contractHash =
    process.env.CONTRACT_HASH || process.env.NEXT_PUBLIC_CONTRACT_HASH;
  const accessKey = process.env.CSPR_CLOUD_ACCESS_KEY;
  if (!contractHash || !accessKey) {
    return NextResponse.json({ configured: false, events: [] });
  }

  const url = `https://api.testnet.cspr.cloud/contracts/${contractHash.replace(/^hash-/, "")}/events?page=1&limit=25`;
  try {
    const res = await fetch(url, {
      headers: { authorization: accessKey },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { configured: true, error: `CSPR.cloud returned ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const raw: CsprCloudEventEnvelope[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : [];
    const events = raw.filter(isRevenueDistributed).map(toProofEvent);

    return NextResponse.json({ configured: true, events });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : "fetch failed",
      },
      { status: 502 }
    );
  }
}
