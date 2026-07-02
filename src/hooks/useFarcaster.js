/**
 * src/hooks/useFarcaster.js
 *
 * React hook for reading Farcaster Mini App state.
 * Delegates to src/platform/ — no SDK calls here.
 */

import { useState, useEffect } from "react";
import {
  isFarcaster,
  isFarcasterReady,
  getFarcasterContext,
  farcasterActions,
} from "../platform/index.js";

export function useFarcaster() {
  const [context, setContext] = useState(getFarcasterContext);
  const [ready,   setReady]   = useState(isFarcasterReady);

  useEffect(() => {
    if (!isFarcaster()) return;

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
    isInFarcaster: isFarcaster(),
    isReady:       ready,
    context,
    user:     context?.user   ?? null,
    fid:      context?.user?.fid ?? null,
    client:   context?.client ?? null,
    location: context?.location ?? null,
    actions:  farcasterActions,
  };
}
