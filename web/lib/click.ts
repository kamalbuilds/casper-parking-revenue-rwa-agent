"use client";

import { useEffect, useState } from "react";
import { useClickRef } from "@make-software/csprclick-ui";
import { CSPRCLICK_EVENTS } from "@make-software/csprclick-core-types";
import type { AccountType, ICSPRClickSDK } from "@make-software/csprclick-core-types";

export { useClickRef };
export { WALLET_KEYS } from "@make-software/csprclick-core-types";
export type { AccountType, ICSPRClickSDK };

/**
 * CSPR.click's ClickProvider injects its runtime SDK from a CDN script tag
 * (cdn.cspr.click) after mount. useClickRef() is typed as non-nullable by
 * @make-software/csprclick-ui, but the underlying React context value is
 * `undefined` until that script finishes loading and fires
 * "csprclick:loaded". Every consumer must treat the ref as possibly absent.
 */
export function useActiveAccount(): AccountType | null {
  const clickRef = useClickRef() as ICSPRClickSDK | undefined;
  const [account, setAccount] = useState<AccountType | null>(null);

  useEffect(() => {
    if (!clickRef || typeof clickRef.on !== "function") {
      return;
    }

    try {
      setAccount(clickRef.getActiveAccount());
    } catch (err) {
      console.error("[click] getActiveAccount failed:", err);
    }

    const handleAccount = (evt: { account: AccountType }) => setAccount(evt.account);
    const handleCleared = () => setAccount(null);

    clickRef.on(CSPRCLICK_EVENTS.SIGNED_IN, handleAccount);
    clickRef.on(CSPRCLICK_EVENTS.SWITCHED_ACCOUNT, handleAccount);
    clickRef.on(CSPRCLICK_EVENTS.UNSOLICITED_ACCOUNT_CHANGE, handleAccount);
    clickRef.on(CSPRCLICK_EVENTS.SIGNED_OUT, handleCleared);
    clickRef.on(CSPRCLICK_EVENTS.DISCONNECTED, handleCleared);

    return () => {
      clickRef.off(CSPRCLICK_EVENTS.SIGNED_IN, handleAccount);
      clickRef.off(CSPRCLICK_EVENTS.SWITCHED_ACCOUNT, handleAccount);
      clickRef.off(CSPRCLICK_EVENTS.UNSOLICITED_ACCOUNT_CHANGE, handleAccount);
      clickRef.off(CSPRCLICK_EVENTS.SIGNED_OUT, handleCleared);
      clickRef.off(CSPRCLICK_EVENTS.DISCONNECTED, handleCleared);
    };
  }, [clickRef]);

  return account;
}
