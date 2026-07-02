/**
 * src/platform/detect.js
 *
 * Single source of truth for environment detection.
 * No component or module should call window.ethereum or sdk.* to detect the
 * platform — everything goes through here.
 *
 * Detection is populated by manager.js once initPlatform() has resolved.
 * Before that, both helpers return false (safe default).
 */

let _isFarcaster = false;

/** Called once by manager.js after the SDK handshake completes. */
export function _setIsFarcaster(value) {
  _isFarcaster = !!value;
}

/** True when running inside a Farcaster client (Warpcast, etc.). */
export function isFarcaster() {
  return _isFarcaster;
}

/** True when running as a normal website (MetaMask / Rabby / etc.). */
export function isWebsite() {
  return !_isFarcaster;
}
