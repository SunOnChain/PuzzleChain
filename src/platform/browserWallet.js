/**
 * src/platform/browserWallet.js
 *
 * Browser wallet implementation (MetaMask, Rabby, any EIP-1193 injected wallet).
 * All window.ethereum usage for the website lives here.
 * Never called when running inside Farcaster.
 */

const MONAD = {
  chainId: "0x279F",           // 10143 decimal — Monad Mainnet
  chainName: "Monad Mainnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://rpc.monad.xyz"],
  blockExplorerUrls: ["https://explorer.monad.xyz"],
};

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Request accounts and switch to Monad Mainnet.
 * Throws a user-visible error string if no wallet is found or user rejects.
 * @returns {Promise<string>} The connected address (checksummed).
 */
export async function connectBrowserWallet() {
  if (!window.ethereum) {
    throw new Error("No EVM wallet found. Install MetaMask or Rabby.");
  }

  const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD.chainId }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MONAD],
      });
    } else {
      throw e;
    }
  }

  return addr;
}

// ─── Provider / Signer ───────────────────────────────────────────────────────

/**
 * Returns the raw EIP-1193 provider (window.ethereum).
 * Returns null if no wallet is installed.
 */
export function getBrowserProvider() {
  return window.ethereum ?? null;
}

/**
 * Sign a message with the browser wallet.
 * @param {string} message
 * @param {string} address
 * @returns {Promise<string>} hex signature
 */
export async function browserSign(message, address) {
  if (!window.ethereum) throw new Error("No EVM wallet found.");
  try {
    return await window.ethereum.request({
      method: "personal_sign",
      params: [message, address],
    });
  } catch (e) {
    if (e?.code === 4001) throw new Error("Signature request was rejected.");
    throw new Error("Failed to sign the verification message.");
  }
}

/**
 * Subscribe to MetaMask account changes.
 * Returns an unsubscribe function.
 * @param {(accounts: string[]) => void} handler
 */
export function onBrowserAccountsChanged(handler) {
  if (!window.ethereum?.on) return () => {};
  window.ethereum.on("accountsChanged", handler);
  return () => window.ethereum.removeListener?.("accountsChanged", handler);
}
