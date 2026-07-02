/**
 * src/hooks/useFarcaster.js
 *
 * React hook for reading Farcaster Mini App state.
 * Any component that needs to branch on "are we in Farcaster?" imports this.
 * Nothing in this hook touches the SDK directly — it reads only the module-level
 * cache that initFarcaster() populates, so it is always safe to call from any
 * component in both environments.
 */

import { useState, useEffect } from "react";
import {
  isFarcaster,
  isFarcasterReady,
  getFarcasterContext,
  farcasterActions,
} from "../lib/farcaster.js";

/**
 * @returns {{
 *   isInFarcaster: boolean,
 *   isReady: boolean,
 *   context: import("../lib/farcaster.js").MiniAppContext | null,
 *   user: { fid: number, username?: string, displayName?: string, pfpUrl?: string } | null,
 *   fid: number | null,
 *   client: object | null,
 *   location: object | null,
 *   actions: typeof farcasterActions,
 * }}
 */
export function useFarcaster() {
  const [context, setContext]   = useState(getFarcasterContext);
  const [ready,   setReady]     = useState(isFarcasterReady);

  useEffect(() => {
    if (!isFarcaster()) return; // normal browser — nothing to poll

    // initFarcaster() runs in the App root useEffect before any child mounts,
    // but just in case a component mounts before init completes we poll briefly.
    if (!ready) {
      const interval = setInterval(() => {
        if (isFarcasterReady()) {
          setReady(true);
          setContext(getFarcasterContext());
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [ready]);

  return {
    /** True when running inside a Farcaster client (Warpcast, etc.). */
    isInFarcaster: isFarcaster(),

    /** True once sdk.actions.ready() has been called and the splash is dismissed. */
    isReady: ready,

    /** Full MiniAppContext — null in a normal browser. */
    context,

    /** Farcaster user — null in a normal browser or before init. */
    user: context?.user ?? null,

    /** Farcaster ID — null in a normal browser or before init. */
    fid: context?.user?.fid ?? null,

    /** Farcaster client info (platformType, clientFid, added, etc.) */
    client: context?.client ?? null,

    /** Where the mini app was opened from (cast_embed, launcher, notification, …) */
    location: context?.location ?? null,

    /**
     * Farcaster action stubs.
     * Safe to call in a normal browser — they are all no-ops when not in Farcaster.
     * Future implementations drop in here without touching any call sites.
     */
    actions: farcasterActions,
  };
}
