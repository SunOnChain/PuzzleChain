/**
 * src/platform/provider.js
 *
 * Returns the correct EIP-1193 provider for the current platform.
 * The rest of the app never touches window.ethereum or sdk.* directly.
 *
 * Website  → window.ethereum (MetaMask / Rabby / any injected wallet)
 * Farcaster → the provider from sdk.wallet.getEthereumProvider()
 */

import { isFarcaster } from "./detect.js";
import { getBrowserProvider } from "./browserWallet.js";
import { getFarcasterRawProvider } from "./farcasterWallet.js";

/**
 * Returns the active EIP-1193 provider, or null if none is available.
 */
export function getProvider() {
  if (isFarcaster()) {
    return getFarcasterRawProvider();
  }
  return getBrowserProvider();
}
