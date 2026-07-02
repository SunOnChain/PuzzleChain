/**
 * src/platform/context.js
 *
 * React context that exposes platform state to the component tree.
 * Populated by <PlatformProvider> in hooks.js.
 */

import { createContext, useContext } from "react";

export const PlatformContext = createContext({
  wallet:     null,   // { address, provider } | null
  profile:    null,   // normalized profile | null
  platform:   "website",  // "website" | "farcaster"
  connect:    async () => {},
  disconnect: () => {},
});

export function usePlatformContext() {
  return useContext(PlatformContext);
}
