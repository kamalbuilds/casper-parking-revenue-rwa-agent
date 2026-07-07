"use client";

import { ClickProvider } from "@make-software/csprclick-ui";
import { CONTENT_MODE, WALLET_KEYS } from "@make-software/csprclick-core-types";
import type { CsprClickInitOptions } from "@make-software/csprclick-core-types";

const CHAIN_NAME = process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test";

const clickOptions: CsprClickInitOptions = {
  appName: "Parking Revenue RWA Agent",
  appId: process.env.NEXT_PUBLIC_CSPR_CLICK_APP_ID || "",
  contentMode: CONTENT_MODE.IFRAME,
  providers: [WALLET_KEYS.CASPER_WALLET, WALLET_KEYS.LEDGER, WALLET_KEYS.METAMASK_SNAP],
  chainName: CHAIN_NAME,
};

/**
 * Wraps the app in CSPR.click's ClickProvider, which injects the CSPR.click
 * runtime SDK from cdn.cspr.click and exposes it through useClickRef().
 * Requires NEXT_PUBLIC_CSPR_CLICK_APP_ID (register an app at cspr.click).
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <ClickProvider options={clickOptions}>{children}</ClickProvider>;
}
