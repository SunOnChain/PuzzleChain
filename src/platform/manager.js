/**
 * src/platform/manager.js
 *
 * Single public API for all platform operations.
 * The application only ever calls platform.manager — never window.ethereum or sdk.*.
 *
 * Exported object: platform
 *
 *   platform.init()          → call once at app startup (App.jsx useEffect)
 *   platform.connect()       → connect wallet (returns address)
 *   platform.signIn()        → SIWE sign-in  (returns verified address)
 *   platform.disconnect()    → end session
 *   platform.getProvider()   → EIP-1193 provider
 *   platform.getSigner()     → ethers Signer (via BrowserProvider)
 *   platform.getAddress()    → current address or null
 *   platform.getProfile(user)→ normalized profile
 *   platform.isConnected()   → boolean
 *   platform.isWebsite()     → boolean
 *   platform.isFarcaster()   → boolean
 *   platform.onAccountsChanged(fn) → register listener; returns unsub fn
 */

import { _setIsFarcaster, isFarcaster, isWebsite } from "./detect.js";
import { initFarcasterWallet, getFarcasterIsMiniApp } from "./farcasterWallet.js";
import { getProvider }                             from "./provider.js";
import { getNormalizedProfile }                    from "./profile.js";
import { connectPlatformWallet, signInWithPlatformWallet } from "./auth.js";
import { onBrowserAccountsChanged }                from "./browserWallet.js";
import { BrowserProvider }                         from "ethers";

// ─── Init ────────────────────────────────────────────────────────────────────

let _initialized = false;

/**
 * Initialize the platform layer.  Must be called once before anything else,
 * typically in App.jsx's first useEffect (no deps).
 */
async function init() {
  if (_initialized) return;
  _initialized = true;

  await initFarcasterWallet();
  // Detection MUST use the sdk.isInMiniApp() result (surfaced here via
  // getFarcasterIsMiniApp()), never sdk.context — context can be empty/
  // unpopulated even while genuinely running inside a Farcaster client,
  // which would incorrectly fall back to the website/MetaMask flow.
  _setIsFarcaster(getFarcasterIsMiniApp());
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

/** Connect the wallet. Returns the connected address. */
async function connect() {
  return connectPlatformWallet();
}

/** SIWE sign-in. Returns the verified lowercase address. */
async function signIn() {
  return signInWithPlatformWallet();
}

/** End the app session (no-op for the wallet extension). */
function disconnect() {
  // Session management stays in App.jsx (signOutWallet). This is a hook point
  // for any platform-level cleanup needed in future.
}

/** Returns the active EIP-1193 provider, or null. */
function getProviderFn() {
  return getProvider();
}

/**
 * Returns an ethers BrowserProvider-wrapped signer.
 * Works for both MetaMask (browser) and Farcaster embedded wallet.
 */
async function getSigner() {
  const provider = getProvider();
  if (!provider) throw new Error("No wallet provider available.");
  const ethersProvider = new BrowserProvider(provider);
  return ethersProvider.getSigner();
}

/** Returns the first connected account address, or null. */
async function getAddress() {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Returns a normalized profile object. */
function getProfile(puzzleChainUser) {
  return getNormalizedProfile(puzzleChainUser);
}

/** True if a provider is available and we have at least one account. */
async function isConnected() {
  const addr = await getAddress();
  return !!addr;
}

/**
 * Subscribe to account changes (browser wallet only; no-op in Farcaster).
 * @param {(accounts: string[]) => void} handler
 * @returns {() => void} unsubscribe
 */
function onAccountsChanged(handler) {
  if (isFarcaster()) return () => {};
  return onBrowserAccountsChanged(handler);
}

// ─── Public export ────────────────────────────────────────────────────────────

export const platform = {
  init,
  connect,
  signIn,
  disconnect,
  getProvider: getProviderFn,
  getSigner,
  getAddress,
  getProfile,
  isConnected,
  isWebsite,
  isFarcaster,
  onAccountsChanged,
};
