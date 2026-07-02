/**
 * src/lib/farcaster.js  — COMPATIBILITY SHIM
 *
 * All Farcaster logic has moved to src/platform/.
 * This file re-exports the same surface that the rest of the app used before
 * so that nothing outside of src/platform/ needs to change.
 *
 * NEW CODE should import from "../../platform" (or "../platform") directly.
 */

export {
  getFarcasterContext,
  isFarcasterReady,
  farcasterActions,
} from "../platform/farcasterWallet.js";

export { isFarcaster } from "../platform/detect.js";

// initFarcaster() is now platform.init() — re-exported here so App.jsx
// can keep calling it by the old name without modification.
export { initFarcasterWallet as initFarcaster } from "../platform/farcasterWallet.js";
