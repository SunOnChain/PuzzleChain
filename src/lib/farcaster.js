/**
 * src/lib/farcaster.js
 *
 * All Farcaster Mini App logic is encapsulated here.
 * Nothing in this file is imported by the rest of the app except:
 *   - initFarcaster()  → called once in the App root useEffect
 *   - The useFarcaster hook (src/hooks/useFarcaster.js)
 *
 * The app never calls sdk.* directly anywhere else, so swapping or extending
 * the SDK in future is a single-file change.
 */

import { sdk } from "@farcaster/miniapp-sdk";

// ─── State ────────────────────────────────────────────────────────────────────
// Module-level singletons so the hook can read them synchronously after init.
let _checked   = false;   // whether isInMiniApp() has been awaited yet
let _isMiniApp = false;   // cached result of isInMiniApp()
let _context   = null;    // cached MiniAppContext (populated after init)
let _ready     = false;   // whether sdk.actions.ready() has been called

// ─── Detection ───────────────────────────────────────────────────────────────
/**
 * Returns true if the app is running inside a Farcaster client (Warpcast, etc.).
 * Synchronous after initFarcaster() has been awaited; always false before that.
 *
 * sdk.isInMiniApp() is async (performs a postMessage handshake), so we call it
 * once in initFarcaster() and cache the result here.
 */
export function isFarcaster() {
  return _isMiniApp;
}

/** Returns the full MiniAppContext after init, or null in a normal browser. */
export function getFarcasterContext() {
  return _context;
}

/** True once the SDK has been initialized and sdk.actions.ready() called. */
export function isFarcasterReady() {
  return _ready;
}

// ─── Initialization ───────────────────────────────────────────────────────────
/**
 * Initialize the Farcaster SDK.
 *
 * Call this ONCE, in the App component's first useEffect (no deps).
 * It is a no-op in a normal browser — all SDK calls are gated on the
 * isInMiniApp() check so the regular website is completely unaffected.
 *
 * What this does when running inside Farcaster:
 *  1. Awaits sdk.isInMiniApp() to confirm the environment (postMessage handshake).
 *  2. Bridges sdk.wallet.getEthereumProvider() → window.ethereum so the
 *     existing connectWallet() / SIWE flow works unchanged, without any
 *     modifications to those functions.
 *  3. Calls sdk.actions.ready() to dismiss the Farcaster splash screen.
 *  4. Reads and caches sdk.context for use by the useFarcaster hook.
 *
 * @returns {Promise<MiniAppContext|null>} The Farcaster context, or null.
 */
export async function initFarcaster() {
  if (_checked) return _context; // idempotent
  _checked = true;

  try {
    // sdk.isInMiniApp() does a postMessage handshake with the Farcaster host.
    // It resolves quickly (default 100 ms timeout) and returns false in a normal
    // browser without throwing, so it is always safe to call.
    _isMiniApp = await sdk.isInMiniApp();
  } catch {
    _isMiniApp = false;
  }

  if (!_isMiniApp) return null; // normal browser — nothing further to do

  try {
    // ── Wallet bridge ───────────────────────────────────────────────────────
    // Expose the Farcaster EIP-1193 provider as window.ethereum so the existing
    // connectWallet() / SIWE auth functions work without any modifications.
    // We only replace window.ethereum if it isn't already set (i.e. no injected
    // wallet extension), so users who have MetaMask installed are unaffected.
    const provider = sdk.wallet.getEthereumProvider();
    if (provider) {
      // Always prefer the Farcaster host wallet when inside a mini app.
      window.ethereum = provider;
    }

    // ── Ready signal ────────────────────────────────────────────────────────
    // This dismisses the Farcaster splash screen. Must be called or users see
    // an infinite loading screen. Called before reading context so the app
    // appears as quickly as possible.
    await sdk.actions.ready();
    _ready = true;

    // ── Context ─────────────────────────────────────────────────────────────
    // sdk.context is available synchronously after ready() in the current SDK.
    _context = sdk.context ?? null;

    return _context;
  } catch (err) {
    console.warn("[Farcaster] SDK initialization error:", err);
    return null;
  }
}

// ─── Future action stubs ──────────────────────────────────────────────────────
/**
 * farcasterActions — placeholder implementations for features that will be
 * added later. Each method is a safe no-op today but has the correct signature
 * so callers can be wired up now and the implementation dropped in later.
 *
 * Future features:
 *   shareAchievement  → sdk.actions.composeCast (Cast an NFT achievement)
 *   openUserProfile   → sdk.actions.openUrl     (Open a Warpcast profile)
 *   sendNotification  → webhook call            (Re-engage notification)
 *   openDeepLink      → sdk.actions.openUrl     (Universal / deep link)
 *   closeMiniApp      → sdk.actions.close       (Close the mini app)
 *   onEvent           → sdk.on                  (Subscribe to host events)
 */
export const farcasterActions = {
  /**
   * Share a puzzle achievement as a Warpcast cast.
   * @param {{ puzzleTitle: string, secs: number, tokenId: string|null, txHash: string|null }} opts
   */
  async shareAchievement(opts) {
    if (!_isMiniApp || !_ready) return;
    // TODO: sdk.actions.composeCast({
    //   text: `🧩 I just solved "${opts.puzzleTitle}" in ${fmt(opts.secs)} on PuzzleChain!`,
    //   embeds: [`${window.location.origin}?puzzle=...`],
    // });
    console.info("[Farcaster] shareAchievement (stub):", opts);
  },

  /**
   * Open a Farcaster user profile by FID.
   * @param {number} fid
   */
  async openUserProfile(fid) {
    if (!_isMiniApp || !_ready) return;
    // TODO: sdk.actions.openUrl(`https://warpcast.com/~/profiles/${fid}`);
    console.info("[Farcaster] openUserProfile (stub): fid=", fid);
  },

  /**
   * Send a Farcaster notification via your webhook endpoint.
   * Requires notificationDetails in the Farcaster context (user must have added the app).
   * @param {{ title: string, body: string, targetUrl: string }} opts
   */
  async sendNotification(opts) {
    if (!_isMiniApp || !_ready) return;
    // TODO: POST to your notification webhook using _context.client.notificationDetails
    console.info("[Farcaster] sendNotification (stub):", opts);
  },

  /**
   * Navigate to a URL from within the mini app (opens in Warpcast browser).
   * @param {string} url
   */
  async openDeepLink(url) {
    if (!_isMiniApp || !_ready) return;
    // TODO: sdk.actions.openUrl(url);
    console.info("[Farcaster] openDeepLink (stub):", url);
  },

  /**
   * Close the mini app and return the user to the Farcaster client.
   */
  async closeMiniApp() {
    if (!_isMiniApp || !_ready) return;
    // TODO: sdk.actions.close();
    console.info("[Farcaster] closeMiniApp (stub)");
  },

  /**
   * Subscribe to a Farcaster host event.
   * @param {string} event  e.g. 'miniAppAdded', 'miniAppRemoved', 'notificationsEnabled'
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  onEvent(event, handler) {
    if (!_isMiniApp || !_ready) return () => {};
    // TODO: sdk.on(event, handler); return () => sdk.off(event, handler);
    console.info("[Farcaster] onEvent (stub): event=", event);
    return () => {};
  },
};
