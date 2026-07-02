/**
 * src/platform/profile.js
 *
 * Returns a normalized profile object regardless of platform.
 *
 * Always returns: { address, displayName, username, avatar }
 *
 * Website   → PuzzleChain profile (editable username, editable avatar)
 * Farcaster → Farcaster profile  (read-only username, read-only avatar)
 */

import { isFarcaster } from "./detect.js";
import { getFarcasterContext } from "./farcasterWallet.js";

/**
 * Build a normalized profile from the given data sources.
 *
 * @param {object|null} puzzleChainUser  The PuzzleChain user record (from localStorage/DB).
 * @returns {{ address: string, displayName: string, username: string, avatar: string }}
 */
export function getNormalizedProfile(puzzleChainUser) {
  if (isFarcaster()) {
    const ctx  = getFarcasterContext();
    const fc   = ctx?.user ?? {};
    const addr = puzzleChainUser?.address ?? "";

    return {
      address:     addr,
      displayName: fc.displayName ?? fc.username ?? "",
      username:    fc.username ?? "",
      avatar:      fc.pfpUrl   ?? "",
      // Flag so UI can prevent editing Farcaster-sourced fields.
      isFarcasterProfile: true,
    };
  }

  // Website: use PuzzleChain profile as-is.
  return {
    address:     puzzleChainUser?.address ?? "",
    displayName: puzzleChainUser?.displayName ?? puzzleChainUser?.username ?? "",
    username:    puzzleChainUser?.username ?? "",
    avatar:      puzzleChainUser?.pfp ?? "",
    isFarcasterProfile: false,
  };
}
