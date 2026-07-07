"use client";

import { WalletProvider } from "@/components/WalletProvider";
import StyledComponentsRegistry from "@/lib/registry";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <StyledComponentsRegistry>
      <WalletProvider>{children}</WalletProvider>
    </StyledComponentsRegistry>
  );
}
