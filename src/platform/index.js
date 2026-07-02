/**
 * src/platform/index.js
 *
 * Barrel export for the platform module.
 * Import everything from here rather than individual files.
 *
 * Usage:
 *   import { platform }      from "../platform";       // manager
 *   import { usePlatform }   from "../platform";       // hook
 *   import { isFarcaster }   from "../platform";       // detection
 *   import { getNormalizedProfile } from "../platform"; // profile
 */

export { platform }                                  from "./manager.js";
export { usePlatform }                               from "./hooks.js";
export { isFarcaster, isWebsite }                   from "./detect.js";
export { getNormalizedProfile }                      from "./profile.js";
export { getFarcasterContext, isFarcasterReady, farcasterActions } from "./farcasterWallet.js";
