import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CsprCloudEvent {
  name?: string;
  event_name?: string;
  timestamp?: string;
  deploy_hash?: string;
  transaction_hash?: string;
  data?: Record<string, unknown>;
}

function pickString(data: Record<string, unknown> | undefined, key: string): string {
  const v = data?.[key];
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

export async function GET() {
  const contractHash = process.env.CONTRACT_HASH;
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
      return NextResponse.json({ configured: true, error: `CSPR.cloud ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const raw: CsprCloudEvent[] = Array.isArray(json?.data) ? json.data : [];
    const events = raw
      .filter((e) => (e.name || e.event_name) === "RevenueDistributed")
      .map((e) => ({
        time: e.timestamp || "",
        day: pickString(e.data, "day"),
        reportHash: pickString(e.data, "report_hash"),
        totalDistributed: pickString(e.data, "total_distributed"),
        deployHash: e.deploy_hash || e.transaction_hash || "",
      }));
    return NextResponse.json({ configured: true, events });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 }
    );
  }
}
