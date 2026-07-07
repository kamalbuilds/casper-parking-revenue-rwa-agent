"use client";

import { useClickRef } from "@make-software/csprclick-ui";
import { CSPRCLICK_EVENTS } from "@make-software/csprclick-core-types";
import type { AccountType } from "@make-software/csprclick-core-types";
import { useCallback, useEffect, useState } from "react";

export function useCsprAccount() {
  const clickRef = useClickRef();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clickRef) return;
    let cancelled = false;
    clickRef
      .getActiveAccountAsync()
      .then((active) => {
        if (!cancelled) setAccount(active ?? null);
      })
      .catch((err) => console.error("[useCsprAccount]", err));

    const onSignedIn = (evt: { account: AccountType }) => {
      setConnecting(false);
      setError(null);
      setAccount(evt.account);
    };
    const onSignedOut = () => setAccount(null);

    clickRef.on(CSPRCLICK_EVENTS.SIGNED_IN, onSignedIn);
    clickRef.on(CSPRCLICK_EVENTS.SIGNED_OUT, onSignedOut);
    return () => {
      cancelled = true;
      clickRef.off(CSPRCLICK_EVENTS.SIGNED_IN, onSignedIn);
      clickRef.off(CSPRCLICK_EVENTS.SIGNED_OUT, onSignedOut);
    };
  }, [clickRef]);

  const connect = useCallback(() => {
    if (!clickRef) return;
    setConnecting(true);
    clickRef.signIn();
  }, [clickRef]);

  const disconnect = useCallback(() => {
    clickRef?.signOut();
    setAccount(null);
  }, [clickRef]);

  return { account, connecting, error, connect, disconnect };
}
