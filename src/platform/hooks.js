/**
 * src/platform/hooks.js
 *
 * usePlatform() — the one hook components use to interact with the platform.
 *
 * Returns:
 *   wallet      → { address, provider } | null
 *   profile     → { address, displayName, username, avatar, isFarcasterProfile }
 *   platform    → "website" | "farcaster"
 *   connect     → async () => string (address)
 *   disconnect  → () => void
 */

import { platform } from "./manager.js";

/**
 * Lightweight hook — reads from the platform manager.
 * Full state (user, wallet) continues to live in App.jsx to avoid
 * duplicating session logic; this hook provides the platform layer's
 * subset of that state.
 *
 * Components that only need platform detection can call this hook
 * without touching App.jsx state at all.
 */
export function usePlatform() {
  return {
    platform:   platform.isFarcaster() ? "farcaster" : "website",
    connect:    platform.connect,
    disconnect: platform.disconnect,
    getProvider: platform.getProvider,
    getSigner:  platform.getSigner,
    isFarcaster: platform.isFarcaster,
    isWebsite:  platform.isWebsite,
  };
}
