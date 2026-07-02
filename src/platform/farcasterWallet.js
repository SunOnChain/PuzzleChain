/**
 * src/platform/farcasterWallet.js
 *
 * All Farcaster SDK wallet and init logic.
 * This is the ONLY file that imports from @farcaster/miniapp-sdk.
 * Never overwrites window.ethereum — the provider is returned explicitly
 * and the rest of the app uses it through provider.js.
 */

import { sdk, isInMiniApp } from "@farcaster/miniapp-sdk";

// ─── Module-level singletons ─────────────────────────────────────────────────

let _checked    = false;
let _isMiniApp  = false;
let _context    = null;
let _ready      = false;
let _provider   = null;   // EIP-1193 provider from Farcaster SDK

// ─── Getters (synchronous after init) ────────────────────────────────────────

export const getFarcasterIsMiniApp   = () => _isMiniApp;
export const getFarcasterContext     = () => _context;
export const isFarcasterReady        = () => _ready;
export const getFarcasterRawProvider = () => _provider;

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Initialize the Farcaster SDK.
 *
 * Idempotent — safe to call multiple times, runs the handshake only once.
 * In a normal browser the isInMiniApp() postMessage handshake returns false
 * in ~100 ms and this function exits early without touching anything.
 *
 * In Farcaster:
 *  1. Confirms the environment via sdk.isInMiniApp().
 *  2. Retrieves the EIP-1193 provider from sdk.wallet.getEthereumProvider().
 *     Provider is stored internally — NOT written to window.ethereum.
 *  3. Calls sdk.actions.ready() to dismiss the splash screen.
 *  4. Caches sdk.context for profile use.
 *
 * @returns {Promise<object|null>} MiniAppContext or null.
 */
export async function initFarcasterWallet() {
  if (_checked) return _context;
  _checked = true;

  try {
    _isMiniApp = await isInMiniApp();
  } catch {
    _isMiniApp = false;
  }

  if (!_isMiniApp) return null;

  try {
    // Grab the EIP-1193 provider — stored privately, never put on window.ethereum.
    _provider = sdk.wallet.getEthereumProvider() ?? null;

    // Dismiss the Farcaster splash screen.
    await sdk.actions.ready();
    _ready = true;

    // Cache context (user, client, location).
    _context = sdk.context ?? null;

    return _context;
  } catch (err) {
    console.warn("[Farcaster] SDK init error:", err);
    return null;
  }
}

// ─── Wallet operations ────────────────────────────────────────────────────────

/**
 * Connect the embedded Farcaster wallet and return the address.
 * Throws if not in Farcaster or provider unavailable.
 * @returns {Promise<string>} connected address
 */
export async function connectFarcasterWallet() {
  if (!_isMiniApp) throw new Error("Not running inside a Farcaster client.");
  if (!_provider)  throw new Error("Farcaster wallet provider not available.");

  const [addr] = await _provider.request({ method: "eth_requestAccounts" });

  // Switch to Monad Mainnet (best-effort; Farcaster embedded wallet may handle this).
  try {
    await _provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x279F" }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await _provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x279F",
          chainName: "Monad Mainnet",
          nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
          rpcUrls: ["https://rpc.monad.xyz"],
          blockExplorerUrls: ["https://explorer.monad.xyz"],
        }],
      });
    }
    // Non-4902 errors: embedded wallets sometimes reject chain-switch silently; continue.
  }

  return addr;
}

/**
 * Sign a message with the Farcaster embedded wallet.
 * @param {string} message
 * @param {string} address
 * @returns {Promise<string>} hex signature
 */
export async function farcasterSign(message, address) {
  if (!_provider) throw new Error("Farcaster wallet provider not available.");
  try {
    return await _provider.request({
      method: "personal_sign",
      params: [message, address],
    });
  } catch (e) {
    if (e?.code === 4001) throw new Error("Signature request was rejected.");
    throw new Error("Failed to sign the verification message.");
  }
}

// ─── Future Farcaster actions (stubs) ────────────────────────────────────────

export const farcasterActions = {
  async shareAchievement(opts) {
    if (!_isMiniApp || !_ready) return;
    // TODO: sdk.actions.composeCast({ text: `...`, embeds: [...] })
    console.info("[Farcaster] shareAchievement (stub):", opts);
  },
  async openUserProfile(fid) {
    if (!_isMiniApp || !_ready) return;
    // TODO: sdk.actions.openUrl(`https://warpcast.com/~/profiles/${fid}`)
    console.info("[Farcaster] openUserProfile (stub): fid=", fid);
  },
  async sendNotification(opts) {
    if (!_isMiniApp || !_ready) return;
    console.info("[Farcaster] sendNotification (stub):", opts);
  },
  async openDeepLink(url) {
    if (!_isMiniApp || !_ready) return;
    // TODO: sdk.actions.openUrl(url)
    console.info("[Farcaster] openDeepLink (stub):", url);
  },
  async closeMiniApp() {
    if (!_isMiniApp || !_ready) return;
    // TODO: sdk.actions.close()
    console.info("[Farcaster] closeMiniApp (stub)");
  },
  onEvent(event, handler) {
    if (!_isMiniApp || !_ready) return () => {};
    console.info("[Farcaster] onEvent (stub): event=", event);
    return () => {};
  },
};
