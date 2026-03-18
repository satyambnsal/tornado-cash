import React, { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { StytchProvider } from "@stytch/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { stytchClient } from "../../hooks/useStytchClient";
import { AuthContextProvider } from "../AuthContext";

interface RootProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * Shared provider wrapper for both main app and iframe
 * Includes all necessary context providers in the correct order
 */
export function RootProviders({
  children,
  queryClient: customQueryClient,
}: RootProvidersProps) {
  const queryClient = customQueryClient || new QueryClient();

  return (
    <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {stytchClient ? (
            <StytchProvider stytch={stytchClient}>
              <AuthContextProvider>{children}</AuthContextProvider>
            </StytchProvider>
          ) : (
            <div style={{ padding: "20px", color: "red" }}>
              Error: Stytch client failed to initialize. Please check
              VITE_STYTCH_PUBLIC_TOKEN configuration.
            </div>
          )}
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
