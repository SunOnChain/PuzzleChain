/**
 * src/platform/farcasterWallet.js
 *
 * All Farcaster SDK wallet and init logic.
 * This is the ONLY file that imports from @farcaster/miniapp-sdk.
 * Never overwrites window.ethereum — the provider is returned explicitly
 * and the rest of the app uses it through provider.js.
 */

import { sdk } from "@farcaster/miniapp-sdk";

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
 *  1. Confirms the environment via sdk.isInMiniApp() — the official,
 *     SDK-supported detection method. This (not sdk.context) is the
 *     source of truth for "are we inside a Farcaster client".
 *  2. Calls sdk.actions.ready() to complete the handshake and dismiss the
 *     splash screen — the host does not reliably expose the embedded
 *     wallet until this has happened.
 *  3. Retrieves the EIP-1193 provider from sdk.wallet.getEthereumProvider().
 *     Provider is stored internally — NOT written to window.ethereum.
 *  4. Caches sdk.context for profile use only (never for platform detection).
 *
 * @returns {Promise<boolean>} true if running inside a Farcaster client.
 */
export async function initFarcasterWallet() {
  if (_checked) return _isMiniApp;
  _checked = true;

  try {
    _isMiniApp = await sdk.isInMiniApp();
  } catch {
    _isMiniApp = false;
  }

  if (!_isMiniApp) return false;

  try {
    // Complete SDK initialization / dismiss the splash screen BEFORE asking
    // for the wallet provider — the provider isn't reliably available until
    // the ready() handshake has completed.
    await sdk.actions.ready();
    _ready = true;

    // Grab the EIP-1193 provider — stored privately, never put on window.ethereum.
    // Await defensively: some hosts resolve this asynchronously.
    _provider = (await sdk.wallet.getEthereumProvider()) ?? null;

    // Cache context (user, client, location) for profile display only.
    _context = sdk.context ?? null;

    return true;
  } catch (err) {
    console.warn("[Farcaster] SDK init error:", err);
    // We are still inside a Farcaster client even if provider/context setup
    // failed partway — do not silently demote to "website" mode.
    return _isMiniApp;
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
